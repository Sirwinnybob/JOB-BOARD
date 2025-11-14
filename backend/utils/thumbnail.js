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
    console.log(`Total page count: ${pageCount}`);

    if (!pageCount || pageCount < 1) {
      throw new Error('Could not determine PDF page count');
    }

    // Generate high-resolution image for FIRST PAGE ONLY
    // -png: output as PNG
    // -r 300: resolution 300 DPI for high-quality images
    // -f 1 -l 1: first page to last page (page 1 only)
    // -singlefile: don't add page numbers to filename
    const outputBase = path.join(outputDir, baseFilename);
    const command = `pdftocairo -png -f 1 -l 1 -singlefile -r 300 "${pdfPath}" "${outputBase}"`;
    console.log(`Running pdftocairo command (first page only): ${command}`);

    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(`pdftocairo stdout: ${stdout}`);
    if (stderr) console.log(`pdftocairo stderr: ${stderr}`);

    // Verify the file was created
    // With -singlefile flag, it creates baseFilename.png (no page number)
    // We need to rename it to baseFilename-1.png to match frontend expectations
    const generatedPath = path.join(outputDir, `${baseFilename}.png`);
    const targetPath = path.join(outputDir, `${baseFilename}-1.png`);

    const fileExists = await fs.access(generatedPath).then(() => true).catch(() => false);

    if (!fileExists) {
      // List files in output directory for debugging
      const files = await fs.readdir(outputDir);
      console.error(`Files in output directory:`, files.filter(f => f.includes(baseFilename)));
      throw new Error(`PDF image generation failed - output file not found: ${generatedPath}`);
    }

    console.log(`Generated file found at: ${generatedPath}`);

    // Rename to match frontend expectations (baseFilename-1.png)
    try {
      await fs.rename(generatedPath, targetPath);
      console.log(`Renamed: ${baseFilename}.png -> ${baseFilename}-1.png`);
    } catch (renameErr) {
      console.error(`Error renaming ${generatedPath}:`, renameErr);
      throw renameErr;
    }

    console.log(`Successfully generated first page image`);
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
