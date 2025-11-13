require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('./db');
const authMiddleware = require('./middleware/auth');
const { generateThumbnail } = require('./utils/thumbnail');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast function to send updates to all connected clients
function broadcastUpdate(type, data = {}) {
  const message = JSON.stringify({ type, data, timestamp: Date.now() });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });

  console.log(`Broadcast: ${type}`);
}

// Middleware
// Configure helmet with relaxed settings for local network access
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false, // Disable COOP to avoid HTTP issues
  crossOriginEmbedderPolicy: false, // Disable COEP
  contentSecurityPolicy: false // Disable CSP for now
}));
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Ensure directories exist - use /app/data for persistent storage (mounted as volume)
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const uploadDir = path.join(dataDir, 'uploads');
const thumbnailDir = path.join(dataDir, 'thumbnails');

(async () => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(thumbnailDir, { recursive: true });
})();

// Serve static files
app.use('/uploads', express.static(uploadDir));
app.use('/thumbnails', express.static(thumbnailDir));

// Frontend static files (in Docker: /app/frontend/dist, in dev: ../frontend/dist)
const frontendPath = process.env.FRONTEND_PATH || path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Compare with environment variables
    if (username !== process.env.ADMIN_USERNAME) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // For production, you should hash the password in .env and use bcrypt.compare
    // For simplicity, we're doing direct comparison (you can enhance this)
    const isValid = password === process.env.ADMIN_PASSWORD;

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PDF Routes
app.get('/api/pdfs', async (req, res) => {
  try {
    db.all(
      'SELECT * FROM pdfs ORDER BY position ASC',
      [],
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Fetch labels for each PDF
        const pdfsWithLabels = [];
        let completed = 0;

        if (rows.length === 0) {
          return res.json([]);
        }

        rows.forEach(pdf => {
          db.all(
            `SELECT l.* FROM labels l
             INNER JOIN pdf_labels pl ON l.id = pl.label_id
             WHERE pl.pdf_id = ?`,
            [pdf.id],
            (err, labels) => {
              if (err) {
                console.error('Error fetching labels:', err);
                labels = [];
              }
              pdfsWithLabels.push({ ...pdf, labels: labels || [] });
              completed++;

              if (completed === rows.length) {
                // Sort by position
                pdfsWithLabels.sort((a, b) => a.position - b.position);
                res.json(pdfsWithLabels);
              }
            }
          );
        });
      }
    );
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/pdfs', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const pdfPath = path.join(uploadDir, filename);
    const baseFilename = path.parse(filename).name;

    // Generate thumbnail
    const thumbnailName = await generateThumbnail(pdfPath, thumbnailDir, baseFilename);

    // Get the highest position
    db.get('SELECT MAX(position) as maxPos FROM pdfs', [], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const newPosition = (row.maxPos || 0) + 1;

      db.run(
        'INSERT INTO pdfs (filename, original_name, thumbnail, position) VALUES (?, ?, ?, ?)',
        [filename, originalName, thumbnailName, newPosition],
        function (err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          // Broadcast update to all clients
          broadcastUpdate('pdf_uploaded', {
            id: this.lastID,
            filename,
            original_name: originalName,
            thumbnail: thumbnailName,
            position: newPosition
          });

          res.json({
            id: this.lastID,
            filename,
            original_name: originalName,
            thumbnail: thumbnailName,
            position: newPosition
          });
        }
      );
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

app.delete('/api/pdfs/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    db.get('SELECT * FROM pdfs WHERE id = ?', [id], async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'PDF not found' });
      }

      // Delete files only if it's not a placeholder
      if (!row.is_placeholder) {
        try {
          await fs.unlink(path.join(uploadDir, row.filename));
          await fs.unlink(path.join(thumbnailDir, row.thumbnail));
        } catch (fileErr) {
          console.error('Error deleting files:', fileErr);
        }
      }

      db.run('DELETE FROM pdfs WHERE id = ?', [id], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Broadcast update to all clients
        broadcastUpdate('pdf_deleted', { id });

        res.json({ success: true });
      });
    });
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/pdfs/reorder', authMiddleware, async (req, res) => {
  try {
    const { pdfs } = req.body; // Array of {id, position}

    if (!Array.isArray(pdfs)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    const stmt = db.prepare('UPDATE pdfs SET position = ? WHERE id = ?');

    pdfs.forEach(({ id, position }) => {
      stmt.run(position, id);
    });

    stmt.finalize((err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Broadcast update to all clients
      broadcastUpdate('pdfs_reordered', { pdfs });

      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error reordering PDFs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/pdfs/placeholder', authMiddleware, async (req, res) => {
  try {
    const { position } = req.body;

    if (position === undefined || position === null) {
      return res.status(400).json({ error: 'Position is required' });
    }

    db.run(
      'INSERT INTO pdfs (filename, original_name, thumbnail, position, is_placeholder) VALUES (?, ?, ?, ?, ?)',
      [null, null, null, position, 1],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        const placeholder = {
          id: this.lastID,
          filename: null,
          original_name: null,
          thumbnail: null,
          position: position,
          is_placeholder: 1
        };

        // Broadcast update to all clients
        broadcastUpdate('pdf_uploaded', placeholder);

        res.json(placeholder);
      }
    );
  } catch (error) {
    console.error('Error creating placeholder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Label Routes
app.get('/api/labels', async (req, res) => {
  try {
    db.all('SELECT * FROM labels ORDER BY name ASC', [], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/labels', authMiddleware, async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Name and color required' });
    }

    db.run(
      'INSERT INTO labels (name, color) VALUES (?, ?)',
      [name.toUpperCase(), color],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Label already exists' });
          }
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Broadcast update to all clients
        broadcastUpdate('label_created', {
          id: this.lastID,
          name: name.toUpperCase(),
          color
        });

        res.json({
          id: this.lastID,
          name: name.toUpperCase(),
          color
        });
      }
    );
  } catch (error) {
    console.error('Error creating label:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/labels/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    db.run('DELETE FROM labels WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Broadcast update to all clients
      broadcastUpdate('label_deleted', { id });

      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error deleting label:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PDF Label Management
app.put('/api/pdfs/:id/labels', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { labelIds } = req.body; // Array of label IDs

    if (!Array.isArray(labelIds)) {
      return res.status(400).json({ error: 'labelIds must be an array' });
    }

    // First, remove all existing labels for this PDF
    db.run('DELETE FROM pdf_labels WHERE pdf_id = ?', [id], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Then, add the new labels
      if (labelIds.length === 0) {
        // Broadcast update to all clients
        broadcastUpdate('pdf_labels_updated', { pdfId: id, labelIds: [] });
        return res.json({ success: true });
      }

      const stmt = db.prepare('INSERT INTO pdf_labels (pdf_id, label_id) VALUES (?, ?)');

      labelIds.forEach(labelId => {
        stmt.run(id, labelId);
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Broadcast update to all clients
        broadcastUpdate('pdf_labels_updated', { pdfId: id, labelIds });

        res.json({ success: true });
      });
    });
  } catch (error) {
    console.error('Error updating PDF labels:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Settings Routes
app.get('/api/settings', async (req, res) => {
  try {
    db.all('SELECT * FROM settings', [], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const settings = {};
      rows.forEach(row => {
        settings[row.key] = row.value;
      });

      res.json(settings);
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/settings', authMiddleware, async (req, res) => {
  try {
    const { grid_rows, grid_cols } = req.body;

    if (!grid_rows || !grid_cols) {
      return res.status(400).json({ error: 'grid_rows and grid_cols required' });
    }

    const rows = parseInt(grid_rows);
    const cols = parseInt(grid_cols);

    if (rows < 1 || rows > 20 || cols < 1 || cols > 20) {
      return res.status(400).json({ error: 'Rows and columns must be between 1 and 20' });
    }

    db.run('UPDATE settings SET value = ? WHERE key = ?', [rows, 'grid_rows']);
    db.run('UPDATE settings SET value = ? WHERE key = ?', [cols, 'grid_cols'], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Broadcast update to all clients
      broadcastUpdate('settings_updated', { grid_rows: rows, grid_cols: cols });

      res.json({ grid_rows: rows, grid_cols: cols });
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Job Board server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
