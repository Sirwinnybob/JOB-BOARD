const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  // PDFs table
  db.run(`
    CREATE TABLE IF NOT EXISTS pdfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      thumbnail TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
    VALUES ('grid_rows', '4'), ('grid_cols', '6')
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
});

module.exports = db;
