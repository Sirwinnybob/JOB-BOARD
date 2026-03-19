// Mock the database to avoid sqlite3 dependency and initialization
jest.mock('../db', () => ({
  all: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
  serialize: jest.fn(),
  configure: jest.fn(),
}));

const { extractJobNumber } = require('./textExtraction');

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
