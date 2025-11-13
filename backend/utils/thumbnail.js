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
    // -r 150: resolution 150 DPI
    const outputBase = finalPath.replace('.png', '');
    const command = `pdftocairo -png -f 1 -l 1 -singlefile -r 150 "${pdfPath}" "${outputBase}"`;

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

module.exports = { generateThumbnail };
