const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

async function generateThumbnail(pdfPath, outputDir, baseFilename) {
  try {
    const finalName = `${baseFilename}.png`;
    const finalPath = path.join(outputDir, finalName);

    // Use pdftocairo directly - it's already installed in the Docker image
    // -png: output as PNG
    // -f 1 -l 1: first page to last page (page 1 only)
    // -singlefile: don't add page numbers to filename
    // -r 200: resolution 200 DPI for better thumbnail quality
    const outputBase = finalPath.replace('.png', '');
    const command = `pdftocairo -png -f 1 -l 1 -singlefile -r 200 "${pdfPath}" "${outputBase}"`;

    await execAsync(command);

    // Verify the file was created
    const fileExists = await fs.access(finalPath).then(() => true).catch(() => false);
    if (!fileExists) {
      throw new Error('Thumbnail generation failed - output file not found');
    }

    return finalName;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}

async function generatePdfImages(pdfPath, outputDir, baseFilename) {
  try {
    console.log(`Generating PDF images for: ${pdfPath}`);
    console.log(`Output directory: ${outputDir}`);
    console.log(`Base filename: ${baseFilename}`);

    // First, get the page count
    const pageCountCommand = `pdfinfo "${pdfPath}" | grep Pages: | awk '{print $2}'`;
    console.log(`Running page count command: ${pageCountCommand}`);
    const { stdout: pageCountStr } = await execAsync(pageCountCommand);
    const pageCount = parseInt(pageCountStr.trim(), 10);
    console.log(`Page count: ${pageCount}`);

    if (!pageCount || pageCount < 1) {
      throw new Error('Could not determine PDF page count');
    }

    // Generate high-resolution images for all pages
    // -png: output as PNG
    // -r 300: resolution 300 DPI for high-quality images
    // Without -singlefile, pdftocairo will generate baseFilename-1.png, baseFilename-2.png, etc.
    const outputBase = path.join(outputDir, baseFilename);
    const command = `pdftocairo -png -r 300 "${pdfPath}" "${outputBase}"`;
    console.log(`Running pdftocairo command: ${command}`);

    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(`pdftocairo stdout: ${stdout}`);
    if (stderr) console.log(`pdftocairo stderr: ${stderr}`);

    // Verify the files were created and rename if zero-padded
    // pdftocairo uses zero-padding for page numbers when there are 10+ pages
    // We need to rename them to match what the frontend expects (no zero-padding)
    let firstPagePath = path.join(outputDir, `${baseFilename}-1.png`);
    let fileExists = await fs.access(firstPagePath).then(() => true).catch(() => false);
    let isZeroPadded = false;

    if (!fileExists) {
      // Try zero-padded format
      firstPagePath = path.join(outputDir, `${baseFilename}-01.png`);
      fileExists = await fs.access(firstPagePath).then(() => true).catch(() => false);
      if (fileExists) {
        isZeroPadded = true;
      }
    }

    if (!fileExists) {
      // List files in output directory for debugging
      const files = await fs.readdir(outputDir);
      console.error(`Files in output directory:`, files.filter(f => f.includes(baseFilename)));
      throw new Error(`PDF image generation failed - no output files found for: ${baseFilename}`);
    }

    console.log(`First page found at: ${firstPagePath}`);

    // If files are zero-padded, rename them to match frontend expectations
    if (isZeroPadded) {
      console.log('Files are zero-padded, renaming to non-padded format...');
      for (let i = 1; i <= pageCount; i++) {
        const paddedNum = i.toString().padStart(2, '0');
        const oldPath = path.join(outputDir, `${baseFilename}-${paddedNum}.png`);
        const newPath = path.join(outputDir, `${baseFilename}-${i}.png`);
        try {
          await fs.rename(oldPath, newPath);
          console.log(`Renamed: ${baseFilename}-${paddedNum}.png -> ${baseFilename}-${i}.png`);
        } catch (renameErr) {
          console.error(`Error renaming ${oldPath}:`, renameErr);
        }
      }
      console.log('File renaming complete');
    }

    console.log(`Successfully generated ${pageCount} page images`);
    return {
      pageCount,
      baseFilename,
    };
  } catch (error) {
    console.error('Error generating PDF images:', error);
    throw error;
  }
}

module.exports = { generateThumbnail, generatePdfImages };
