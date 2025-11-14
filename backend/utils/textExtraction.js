const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

const execAsync = promisify(exec);

/**
 * Extract text from PDF using pdf-parse library
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<string>} Extracted text
 */
async function extractTextWithPdfParse(pdfPath) {
  try {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text with pdf-parse:', error);
    return null;
  }
}

/**
 * Extract text from PDF using pdftotext (poppler-utils)
 * Fallback method if pdf-parse fails
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<string>} Extracted text
 */
async function extractTextWithPdfToText(pdfPath) {
  try {
    const { stdout } = await execAsync(`pdftotext "${pdfPath}" -`);
    return stdout;
  } catch (error) {
    console.error('Error extracting text with pdftotext:', error);
    return null;
  }
}

/**
 * Extract text from PDF using OCR (tesseract)
 * Used for image-based PDFs
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<string>} Extracted text
 */
async function extractTextWithOCR(pdfPath) {
  try {
    // First convert PDF to images using pdftocairo
    const tempDir = '/tmp';
    const timestamp = Date.now();
    const imageBase = `${tempDir}/ocr-temp-${timestamp}`;

    // Convert PDF to PNG images
    await execAsync(`pdftocairo -png -f 1 -l 1 -r 300 "${pdfPath}" "${imageBase}"`);

    // Run OCR on the first page
    const imagePath = `${imageBase}-1.png`;
    const { stdout } = await execAsync(`tesseract "${imagePath}" stdout`);

    // Clean up temporary image
    try {
      await fs.unlink(imagePath);
    } catch (unlinkError) {
      console.error('Error deleting temporary OCR image:', unlinkError);
    }

    return stdout;
  } catch (error) {
    console.error('Error extracting text with OCR:', error);
    return null;
  }
}

/**
 * Extract text from PDF using multiple methods
 * Tries pdf-parse first, then pdftotext, then OCR
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<string>} Extracted text
 */
async function extractText(pdfPath) {
  // Try pdf-parse first (works for text-based PDFs)
  let text = await extractTextWithPdfParse(pdfPath);

  if (!text || text.trim().length < 10) {
    console.log('pdf-parse failed or returned minimal text, trying pdftotext...');
    text = await extractTextWithPdfToText(pdfPath);
  }

  if (!text || text.trim().length < 10) {
    console.log('pdftotext failed or returned minimal text, trying OCR...');
    text = await extractTextWithOCR(pdfPath);
  }

  return text || '';
}

/**
 * Extract job number from text
 * Matches patterns like: JOB# 123, JOB# 123a, JOB# 123-2, JOB# 25-123, JOB# 25-123a
 * @param {string} text - Text to search
 * @returns {string|null} Extracted job number or null
 */
function extractJobNumber(text) {
  // Pattern to match JOB# followed by various formats
  // Matches: 123, 123a, 123-2, 25-123, 25-123a, etc.
  const patterns = [
    /JOB#\s*(\d+(?:-\d+)?[a-zA-Z]?)/i,
    /JOB\s*#\s*(\d+(?:-\d+)?[a-zA-Z]?)/i,
    /JOB\s*NUMBER\s*:?\s*(\d+(?:-\d+)?[a-zA-Z]?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract construction method from text
 * Matches: FACE-FRAME, FRAMELESS, BOTH (case insensitive)
 * @param {string} text - Text to search
 * @returns {string|null} Extracted construction method or null
 */
function extractConstructionMethod(text) {
  // Normalize text for searching
  const normalizedText = text.toUpperCase();

  // Look for construction method keywords
  // Check for "BOTH" first as it's most specific
  if (normalizedText.includes('BOTH')) {
    return 'Both';
  }

  // Check for face-frame variants
  if (normalizedText.includes('FACE-FRAME') ||
      normalizedText.includes('FACE FRAME') ||
      normalizedText.includes('FACEFRAME')) {
    return 'Face Frame';
  }

  // Check for frameless variants
  if (normalizedText.includes('FRAMELESS') ||
      normalizedText.includes('FRAME-LESS') ||
      normalizedText.includes('FRAME LESS')) {
    return 'Frameless';
  }

  return null;
}

/**
 * Extract metadata (job number and construction method) from PDF
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<{job_number: string|null, construction_method: string|null}>}
 */
async function extractMetadata(pdfPath) {
  try {
    const text = await extractText(pdfPath);

    if (!text) {
      console.log('No text extracted from PDF');
      return { job_number: null, construction_method: null };
    }

    const job_number = extractJobNumber(text);
    const construction_method = extractConstructionMethod(text);

    console.log('Extracted metadata:', { job_number, construction_method });

    return { job_number, construction_method };
  } catch (error) {
    console.error('Error extracting metadata from PDF:', error);
    return { job_number: null, construction_method: null };
  }
}

module.exports = {
  extractText,
  extractJobNumber,
  extractConstructionMethod,
  extractMetadata,
};
