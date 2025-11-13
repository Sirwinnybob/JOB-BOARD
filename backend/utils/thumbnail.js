const Poppler = require('node-poppler');
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
      scale: 2.0
    };

    // Convert PDF to PNG using system poppler-utils
    await poppler.pdfToCairo(pdfPath, finalPath, options);

    // pdftocairo adds -1 suffix, rename to clean name
    const generatedPath = `${finalPath}-1.png`;
    const fileExists = await fs.access(generatedPath).then(() => true).catch(() => false);

    if (fileExists) {
      await fs.rename(generatedPath, finalPath);
    } else {
      throw new Error('Thumbnail generation failed - output file not found');
    }

    return finalName;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}

module.exports = { generateThumbnail };
