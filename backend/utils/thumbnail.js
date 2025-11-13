const Poppler = require('node-poppler').default;
const path = require('path');
const fs = require('fs').promises;

async function generateThumbnail(pdfPath, outputDir, baseFilename) {
  try {
    const poppler = new Poppler();
    const finalName = `${baseFilename}.png`;
    const finalPath = path.join(outputDir, finalName);

    // Options for pdftocairo (converts PDF to PNG)
    const options = {
      firstPageToConvert: 1,
      lastPageToConvert: 1,
      pngFile: true,
      singleFile: true,
      resolutionXYAxis: 150  // DPI resolution instead of scale
    };

    // Convert PDF to PNG using system poppler-utils
    // Note: pdfToCairo outputs to finalPath without extension, then adds .png
    const outputBase = finalPath.replace('.png', '');
    await poppler.pdfToCairo(pdfPath, outputBase, options);

    // With singleFile:true, it creates outputBase.png directly
    const generatedPath = `${outputBase}.png`;

    // Verify the file was created
    const fileExists = await fs.access(generatedPath).then(() => true).catch(() => false);
    if (!fileExists) {
      throw new Error('Thumbnail generation failed - output file not found');
    }

    // If outputBase differs from finalPath, rename it
    if (generatedPath !== finalPath) {
      await fs.rename(generatedPath, finalPath);
    }

    return finalName;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}

module.exports = { generateThumbnail };
