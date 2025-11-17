const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use /app/data directory for persistent storage (mounted as volume)
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Optimize SQLite for concurrent reads (important for 20+ connected devices)
db.configure('busyTimeout', 10000); // Wait up to 10 seconds when database is locked
db.run('PRAGMA journal_mode = WAL'); // Write-Ahead Logging for better concurrent reads
db.run('PRAGMA synchronous = NORMAL'); // Faster writes, still safe
db.run('PRAGMA cache_size = 10000'); // Increase cache for better performance
db.run('PRAGMA temp_store = MEMORY'); // Store temp tables in memory

// Initialize database tables
db.serialize(() => {
  // PDFs table
  db.run(`
    CREATE TABLE IF NOT EXISTS pdfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      original_name TEXT,
      thumbnail TEXT,
      position INTEGER NOT NULL,
      is_placeholder INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add is_placeholder column to existing tables (migration)
  db.run(`
    ALTER TABLE pdfs ADD COLUMN is_placeholder INTEGER DEFAULT 0
  `, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding is_placeholder column:', err);
    }
  });

  // Add is_pending column to existing tables (migration)
  db.run(`
    ALTER TABLE pdfs ADD COLUMN is_pending INTEGER DEFAULT 1
  `, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding is_pending column:', err);
    }
  });

  // Add page_count column to existing tables (migration)
  db.run(`
    ALTER TABLE pdfs ADD COLUMN page_count INTEGER
  `, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding page_count column:', err);
    }
  });

  // Add images_base column to existing tables (migration)
  db.run(`
    ALTER TABLE pdfs ADD COLUMN images_base TEXT
  `, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding images_base column:', err);
    }
  });

  // Add job_number column to existing tables (migration)
  db.run(`
    ALTER TABLE pdfs ADD COLUMN job_number TEXT
  `, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding job_number column:', err);
    }
  });

  // Add construction_method column to existing tables (migration)
  db.run(`
    ALTER TABLE pdfs ADD COLUMN construction_method TEXT
  `, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding construction_method column:', err);
    }
  });

  // Add dark_mode_images_base column to existing tables (migration)
  db.run(`
    ALTER TABLE pdfs ADD COLUMN dark_mode_images_base TEXT
  `, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding dark_mode_images_base column:', err);
    }
  });

  // Add placeholder_text column to existing tables (migration)
  db.run(`
    ALTER TABLE pdfs ADD COLUMN placeholder_text TEXT DEFAULT 'PLACEHOLDER'
  `, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding placeholder_text column:', err);
    }
  });

  // Settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default settings if they don't exist
  db.run(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('grid_rows', '6'), ('grid_cols', '4')
  `);

  // Add aspect ratio settings (landscape with header space)
  db.run(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('aspect_ratio_width', '11'), ('aspect_ratio_height', '10')
  `);

  // Labels table
  db.run(`
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // PDF-Labels junction table (many-to-many)
  db.run(`
    CREATE TABLE IF NOT EXISTS pdf_labels (
      pdf_id INTEGER NOT NULL,
      label_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (pdf_id, label_id),
      FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
      FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
    )
  `);

  // Insert default labels if they don't exist
  db.run(`INSERT OR IGNORE INTO labels (name, color) VALUES ('NEW', '#10b981')`);
  db.run(`INSERT OR IGNORE INTO labels (name, color) VALUES ('MOVED', '#3b82f6')`);
  db.run(`INSERT OR IGNORE INTO labels (name, color) VALUES ('PENDING', '#f59e0b')`);
  db.run(`INSERT OR IGNORE INTO labels (name, color) VALUES ('URGENT', '#ef4444')`);
  db.run(`INSERT OR IGNORE INTO labels (name, color) VALUES ('COMPLETED', '#8b5cf6')`);

  // OCR Regions table for configurable extraction
  db.run(`
    CREATE TABLE IF NOT EXISTS ocr_regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_name TEXT UNIQUE NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default OCR regions if they don't exist
  db.run(`INSERT OR IGNORE INTO ocr_regions (field_name, x, y, width, height, description)
          VALUES ('job_number', 0, 0, 0, 0, 'Region where job number is located')`);
  db.run(`INSERT OR IGNORE INTO ocr_regions (field_name, x, y, width, height, description)
          VALUES ('construction_method', 0, 0, 0, 0, 'Region where construction method is located')`);

  // Create indexes for better query performance with multiple concurrent reads
  db.run(`CREATE INDEX IF NOT EXISTS idx_pdfs_position ON pdfs(position)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pdf_labels_pdf_id ON pdf_labels(pdf_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pdf_labels_label_id ON pdf_labels(label_id)`);
});

console.log('Database initialized with optimizations for concurrent connections');

module.exports = db;
