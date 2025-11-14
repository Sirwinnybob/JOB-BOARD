const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const db = require('../db');

const execAsync = promisify(exec);

/**
 * Extract text from PDF using OCR (tesseract)
 * @param {string} pdfPath - Path to the PDF file
 * @param {Object} region - Optional region coordinates {x, y, width, height}
 * @returns {Promise<string>} Extracted text
 */
async function extractTextWithOCR(pdfPath, region = null) {
  try {
    // First convert PDF to images using pdftocairo
    const tempDir = '/tmp';
    const timestamp = Date.now();
    const imageBase = `${tempDir}/ocr-temp-${timestamp}`;

    // Convert PDF to PNG images (first page only, high resolution for OCR)
    await execAsync(`pdftocairo -png -f 1 -l 1 -r 300 "${pdfPath}" "${imageBase}"`);

    const imagePath = `${imageBase}-1.png`;

    let ocrText;
    if (region && region.width > 0 && region.height > 0) {
      // Extract from specific region using ImageMagick crop + tesseract
      const croppedImage = path.join(tempDir, `ocr-crop-${timestamp}.png`);
      const cropCommand = `magick "${imagePath}" -crop ${region.width}x${region.height}+${region.x}+${region.y} "${croppedImage}"`;
      console.log(`Cropping image: ${cropCommand}`);
      await execAsync(cropCommand);

      const ocrCommand = `tesseract "${croppedImage}" stdout`;
      console.log(`Running region OCR: ${ocrCommand}`);
      const { stdout } = await execAsync(ocrCommand);
      ocrText = stdout;

      // Clean up cropped image
      try {
        await fs.unlink(croppedImage);
      } catch (unlinkError) {
        console.error('Error deleting cropped image:', unlinkError);
      }
    } else {
      // Full page OCR
      const ocrCommand = `tesseract "${imagePath}" stdout`;
      console.log(`Running full-page OCR: ${ocrCommand}`);
      const { stdout } = await execAsync(ocrCommand);
      ocrText = stdout;
    }

    // Clean up temporary image
    try {
      await fs.unlink(imagePath);
    } catch (unlinkError) {
      console.error('Error deleting temporary OCR image:', unlinkError);
    }

    return ocrText;
  } catch (error) {
    console.error('Error extracting text with OCR:', error);
    return null;
  }
}

/**
 * Extract text from PDF using OCR only
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<string>} Extracted text
 */
async function extractText(pdfPath) {
  console.log(`Starting OCR text extraction from: ${pdfPath}`);

  const text = await extractTextWithOCR(pdfPath);

  if (text && text.trim().length >= 10) {
    console.log(`OCR succeeded, extracted ${text.length} characters`);
    return text;
  }

  console.log('OCR failed or returned minimal text');
  return text || '';
}

/**
 * Extract job number from text
 * Matches patterns like: JOB# 123, JOB# 123a, JOB# 123-2, JOB# 25-123, JOB# 25-123a
 * @param {string} text - Text to search
 * @returns {string|null} Extracted job number or null
 */
function extractJobNumber(text) {
  // Clean up text - remove excessive whitespace and normalize
  const cleanText = text.replace(/\s+/g, ' ').trim();

  console.log('Searching for job number in text (first 1000 chars):', cleanText.substring(0, 1000));

  // Pattern to match JOB# followed by various formats
  // Matches: 123, 123a, 123-2, 25-123, 25-123a, etc.
  const patterns = [
    // Direct patterns (JOB# immediately followed by number)
    /JOB\s*#\s*:?\s*(\d+(?:-\d+)?[a-zA-Z]?)/i,
    /JOB\s*NUMBER\s*:?\s*(\d+(?:-\d+)?[a-zA-Z]?)/i,
    /JOB\s*NO\.?\s*:?\s*(\d+(?:-\d+)?[a-zA-Z]?)/i,
    /JOB:\s*(\d+(?:-\d+)?[a-zA-Z]?)/i,

    // Look for standalone numbers that might be job numbers
    // Search for patterns like "25-123" or "123a" that appear near "Job" or after it
    /JOB[^0-9]{0,20}(\d+(?:-\d+)?[a-zA-Z]?)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      // Validate that it looks like a job number (not a date or other number)
      const potentialJobNum = match[1].trim();
      // Skip if it looks like a date (e.g., 10/13/25)
      if (!potentialJobNum.includes('/')) {
        console.log(`Found job number with pattern ${pattern}:`, potentialJobNum);
        return potentialJobNum;
      }
    }
  }

  // Also try to find any number patterns that look like job numbers in the full text
  // Look for patterns like "25-123", "123a", etc. near the word "Job"
  const jobSectionMatch = cleanText.match(/JOB[^]*?(\d+(?:-\d+)?[a-zA-Z]?)(?=\s|$|[^0-9a-zA-Z-])/i);
  if (jobSectionMatch && jobSectionMatch[1]) {
    const potentialJobNum = jobSectionMatch[1].trim();
    if (!potentialJobNum.includes('/') && potentialJobNum.length >= 1) {
      console.log('Found potential job number near "Job" keyword:', potentialJobNum);
      return potentialJobNum;
    }
  }

  console.log('No job number found in text');
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

  console.log('Searching for construction method in text');

  // Look for construction method keywords
  // Check for "BOTH" first as it's most specific
  if (normalizedText.includes('BOTH')) {
    console.log('Found construction method: Both');
    return 'Both';
  }

  // Check for face-frame variants
  if (normalizedText.includes('FACE-FRAME') ||
      normalizedText.includes('FACE FRAME') ||
      normalizedText.includes('FACEFRAME')) {
    console.log('Found construction method: Face Frame');
    return 'Face Frame';
  }

  // Check for frameless variants
  if (normalizedText.includes('FRAMELESS') ||
      normalizedText.includes('FRAME-LESS') ||
      normalizedText.includes('FRAME LESS')) {
    console.log('Found construction method: Frameless');
    return 'Frameless';
  }

  console.log('No construction method found in text');
  return null;
}

/**
 * Get saved OCR regions from database
 * @returns {Promise<Object>} Object with field_name as keys and region objects as values
 */
async function getOcrRegions() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ocr_regions', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const regions = {};
      rows.forEach(row => {
        regions[row.field_name] = {
          x: row.x,
          y: row.y,
          width: row.width,
          height: row.height
        };
      });
      resolve(regions);
    });
  });
}

/**
 * Extract metadata (job number and construction method) from PDF using OCR
 * Uses saved region configurations if available, otherwise full-page OCR
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<{job_number: string|null, construction_method: string|null}>}
 */
async function extractMetadata(pdfPath) {
  try {
    // Get saved OCR regions
    const regions = await getOcrRegions();
    console.log('Loaded OCR regions:', regions);

    let job_number = null;
    let construction_method = null;

    // Extract job number using region if configured
    if (regions.job_number && regions.job_number.width > 0 && regions.job_number.height > 0) {
      console.log('Using configured region for job_number');
      const text = await extractTextWithOCR(pdfPath, regions.job_number);
      if (text) {
        job_number = extractJobNumber(text);
      }
    }

    // Extract construction method using region if configured
    if (regions.construction_method && regions.construction_method.width > 0 && regions.construction_method.height > 0) {
      console.log('Using configured region for construction_method');
      const text = await extractTextWithOCR(pdfPath, regions.construction_method);
      if (text) {
        construction_method = extractConstructionMethod(text);
      }
    }

    // Fallback to full-page OCR if regions not configured or extraction failed
    if (!job_number || !construction_method) {
      console.log('Falling back to full-page OCR');
      const fullText = await extractText(pdfPath);
      if (fullText) {
        if (!job_number) {
          job_number = extractJobNumber(fullText);
        }
        if (!construction_method) {
          construction_method = extractConstructionMethod(fullText);
        }
      }
    }

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
