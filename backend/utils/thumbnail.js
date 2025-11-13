const { pdfToPng } = require('pdf-to-png-converter');
const path = require('path');
const fs = require('fs').promises;

async function generateThumbnail(pdfPath, outputDir, baseFilename) {
  try {
    // Convert only the first page with high quality
    const pages = await pdfToPng(pdfPath, {
      disableFontFace: false,
      useSystemFonts: false,
      viewportScale: 2.0,
      outputFilesFolder: outputDir,
      strictPagesToProcess: true,
      pagesToProcess: [1]
    });

    if (!pages || pages.length === 0) {
      throw new Error('No pages generated from PDF');
    }

    // The library returns page data, we need to write it to file
    const finalName = `${baseFilename}.png`;
    const finalPath = path.join(outputDir, finalName);

    // Write the PNG buffer to file
    await fs.writeFile(finalPath, pages[0].content);

    return finalName;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}

module.exports = { generateThumbnail };
