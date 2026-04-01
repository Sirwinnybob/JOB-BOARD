// Mock dependencies to avoid side effects and external tool requirements
jest.mock('../db', () => ({
  all: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
  serialize: jest.fn(),
  configure: jest.fn(),
}));

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn(),
    rename: jest.fn(),
  },
}));

const { extractJobNumber, extractMetadata } = require('./textExtraction');
const db = require('../db');
const { execFile } = require('child_process');
const fs = require('fs').promises;

describe('extractJobNumber', () => {
  // Mock console.log to keep test output clean
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
  });

  test('should extract simple job number', () => {
    expect(extractJobNumber('JOB# 123')).toBe('123');
  });

  test('should extract job number with letter', () => {
    expect(extractJobNumber('JOB# 123a')).toBe('123a');
  });

  test('should extract job number with hyphen', () => {
    expect(extractJobNumber('JOB# 123-2')).toBe('123-2');
  });

  test('should extract job number with prefix hyphen', () => {
    expect(extractJobNumber('JOB# 25-123')).toBe('25-123');
  });

  test('should extract job number with prefix hyphen and letter', () => {
    expect(extractJobNumber('JOB# 25-123a')).toBe('25-123a');
  });

  test('should handle JOB NUMBER: prefix', () => {
    expect(extractJobNumber('JOB NUMBER: 123')).toBe('123');
  });

  test('should handle JOB NO. prefix', () => {
    expect(extractJobNumber('JOB NO. 123')).toBe('123');
  });

  test('should handle JOB: prefix', () => {
    expect(extractJobNumber('JOB: 123')).toBe('123');
  });

  test('should handle extra whitespace', () => {
    expect(extractJobNumber('  JOB  #   :  123  ')).toBe('123');
  });

  test('should be case insensitive', () => {
    expect(extractJobNumber('job# 123')).toBe('123');
  });

  test('should skip date-like patterns', () => {
    expect(extractJobNumber('JOB# 10/13/25')).toBe(null);
  });

  test('should find job number near JOB keyword (standalone pattern)', () => {
    // This tests the /JOB[^0-9]{0,20}(\d+(?:-\d+)?[a-zA-Z]?)/i pattern
    expect(extractJobNumber('JOB: some text 123')).toBe('123');
    expect(extractJobNumber('JOB 123')).toBe('123');
  });

  test('should find potential job number near JOB keyword (full text search)', () => {
    // This tests the /JOB[^]*?(\d+(?:-\d+)?[a-zA-Z]?)(?=\s|$|[^0-9a-zA-Z-])/i pattern
    expect(extractJobNumber('This is the JOB for 123 project')).toBe('123');
  });

  test('should return null when no job number is found', () => {
    expect(extractJobNumber('No information here')).toBe(null);
  });
});

describe('extractMetadata', () => {
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test('should log an error when failing to delete cropped image during region OCR', async () => {
    // 1. Mock db.all to return a job_number region
    db.all.mockImplementation((query, params, callback) => {
      callback(null, [{ field_name: 'job_number', x: 10, y: 10, width: 100, height: 100 }]);
    });

    // 2. Mock child_process.execFile to succeed for magick and tesseract
    execFile.mockImplementation((cmd, args, callback) => {
      callback(null, { stdout: 'JOB# 123', stderr: '' });
    });

    // 3. Mock fs.unlink to throw an error when called for a path containing 'ocr-crop-'
    fs.unlink.mockImplementation((filePath) => {
      if (filePath.includes('ocr-crop-')) {
        return Promise.reject(new Error('Unlink failed'));
      }
      return Promise.resolve();
    });

    // 4. Mock fs.rename to succeed (needed for extractTextWithOCR if no existing image)
    fs.rename.mockResolvedValue();

    const result = await extractMetadata('test.pdf', 'test-image.png');

    // 5. Assertions
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting cropped image:', expect.any(Error));
    expect(result).toEqual({
      job_number: '123',
      construction_method: null
    });
  });
});
