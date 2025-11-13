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
    // First, get the page count
    const pageCountCommand = `pdfinfo "${pdfPath}" | grep Pages: | awk '{print $2}'`;
    const { stdout: pageCountStr } = await execAsync(pageCountCommand);
    const pageCount = parseInt(pageCountStr.trim(), 10);

    if (!pageCount || pageCount < 1) {
      throw new Error('Could not determine PDF page count');
    }

    // Generate high-resolution images for all pages
    // -png: output as PNG
    // -r 300: resolution 300 DPI for high-quality images
    // Without -singlefile, pdftocairo will generate baseFilename-1.png, baseFilename-2.png, etc.
    const outputBase = path.join(outputDir, baseFilename);
    const command = `pdftocairo -png -r 300 "${pdfPath}" "${outputBase}"`;

    await execAsync(command);

    // Verify the files were created
    const firstPagePath = path.join(outputDir, `${baseFilename}-1.png`);
    const fileExists = await fs.access(firstPagePath).then(() => true).catch(() => false);
    if (!fileExists) {
      throw new Error('PDF image generation failed - output files not found');
    }

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
