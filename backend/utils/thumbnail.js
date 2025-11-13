const poppler = require('pdf-poppler');
const path = require('path');
const fs = require('fs').promises;

async function generateThumbnail(pdfPath, outputDir, baseFilename) {
  const opts = {
    format: 'png',
    out_dir: outputDir,
    out_prefix: baseFilename,
    page: 1,
    scale: 200
  };

  try {
    await poppler.convert(pdfPath, opts);

    // pdf-poppler generates files with pattern: baseFilename-1.png
    const thumbnailName = `${baseFilename}-1.png`;
    const generatedPath = path.join(outputDir, thumbnailName);

    // Rename to simpler format
    const finalName = `${baseFilename}.png`;
    const finalPath = path.join(outputDir, finalName);

    await fs.rename(generatedPath, finalPath);

    return finalName;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}

module.exports = { generateThumbnail };
