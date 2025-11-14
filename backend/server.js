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
const { exec } = require('child_process');
const { promisify } = require('util');
const db = require('./db');
const authMiddleware = require('./middleware/auth');
const { generateThumbnail, generatePdfImages, generateDarkModeImages } = require('./utils/thumbnail');
const { extractMetadata } = require('./utils/textExtraction');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server with optimized settings for multiple connections
const wss = new WebSocket.Server({
  server,
  perMessageDeflate: false, // Disable compression for better performance with many clients
  maxPayload: 1024 * 1024, // 1MB max message size
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected. Total clients:', wss.clients.size);

  ws.isAlive = true;

  // Handle pong responses
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected. Total clients:', wss.clients.size);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Heartbeat to detect broken connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating inactive WebSocket connection');
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Check every 30 seconds

// Clean up on server shutdown
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Optimized broadcast function to send updates to all connected clients
function broadcastUpdate(type, data = {}) {
  const message = JSON.stringify({ type, data, timestamp: Date.now() });
  let successCount = 0;
  let failCount = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        successCount++;
      } catch (error) {
        console.error('Error sending to WebSocket client:', error);
        failCount++;
      }
    }
  });

  console.log(`Broadcast: ${type} (sent to ${successCount} clients, ${failCount} failed)`);
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

// Rate limiting - Increased for multiple devices on same network
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased to support 20+ devices on same IP
  standardHeaders: true,
  legacyHeaders: false,
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

// Serve static files (images only - PDFs are converted and discarded)
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
    const { includePending } = req.query;
    const shouldIncludePending = includePending === 'true';

    // Build query based on whether to include pending PDFs
    const query = shouldIncludePending
      ? 'SELECT * FROM pdfs ORDER BY position ASC'
      : 'SELECT * FROM pdfs WHERE is_pending = 0 OR is_pending IS NULL ORDER BY position ASC';

    db.all(query, [], (err, rows) => {
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
    });
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

    // Get is_pending from request body (default to 1 if not provided)
    const isPending = req.body.is_pending !== undefined ? parseInt(req.body.is_pending) : 1;
    const targetPosition = req.body.position !== undefined ? parseInt(req.body.position) : null;

    // Generate thumbnail (fast)
    const thumbnailName = await generateThumbnail(pdfPath, thumbnailDir, baseFilename);

    // Generate full PDF images for viewing (light mode only - fast)
    const imagesBase = `${baseFilename}-pages`;
    const { pageCount } = await generatePdfImages(pdfPath, thumbnailDir, imagesBase);

    // Keep PDF for background processing (dark mode and OCR)
    // Will be deleted after background processing completes

    // Determine position
    let newPosition;
    if (targetPosition !== null) {
      // Use specified position
      newPosition = targetPosition;
    } else {
      // Get the highest position
      const row = await new Promise((resolve, reject) => {
        db.get('SELECT MAX(position) as maxPos FROM pdfs', [], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      newPosition = (row.maxPos || 0) + 1;
    }

    // Store null for filename since we no longer keep the PDF
    // Initially store with null job_number, construction_method, and dark_mode_images_base
    // Dark mode will be generated in background
    db.run(
      'INSERT INTO pdfs (filename, original_name, thumbnail, position, is_pending, page_count, images_base, dark_mode_images_base, job_number, construction_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [null, originalName, thumbnailName, newPosition, isPending, pageCount, imagesBase, null, null, null],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        const pdfId = this.lastID;

        // Broadcast update to all clients
        broadcastUpdate('pdf_uploaded', {
          id: pdfId,
          filename: null,
          original_name: originalName,
          thumbnail: thumbnailName,
          position: newPosition,
          is_pending: isPending,
          page_count: pageCount,
          images_base: imagesBase,
          dark_mode_images_base: null, // Will be generated in background
          job_number: null,
          construction_method: null
        });

        // Send immediate response to client (fast upload)
        res.json({
          id: pdfId,
          filename: null,
          original_name: originalName,
          thumbnail: thumbnailName,
          position: newPosition,
          is_pending: isPending,
          page_count: pageCount,
          images_base: imagesBase,
          dark_mode_images_base: null, // Will be generated in background
          job_number: null,
          construction_method: null
        });

        // Process OCR and Dark Mode in background (don't wait for response)
        setImmediate(async () => {
          // Track completion of both background tasks
          let ocrComplete = false;
          let darkModeComplete = false;

          // OCR extraction
          (async () => {
            try {
              console.log(`[OCR] Starting background extraction for PDF ${pdfId}...`);
              const metadata = await extractMetadata(pdfPath);
              console.log(`[OCR] Complete for PDF ${pdfId}:`, metadata);

              // Update database with extracted metadata
              db.run(
                'UPDATE pdfs SET job_number = ?, construction_method = ? WHERE id = ?',
                [metadata.job_number, metadata.construction_method, pdfId],
                (updateErr) => {
                  if (updateErr) {
                    console.error('[OCR] Error updating metadata:', updateErr);
                    return;
                  }

                  // Broadcast metadata update to all clients
                  broadcastUpdate('pdf_metadata_updated', {
                    id: pdfId,
                    job_number: metadata.job_number,
                    construction_method: metadata.construction_method
                  });

                  console.log(`[OCR] Metadata updated for PDF ${pdfId}`);
                }
              );
            } catch (extractErr) {
              console.error(`[OCR] Error in background extraction for PDF ${pdfId}:`, extractErr);
            } finally {
              ocrComplete = true;
              checkAndCleanup();
            }
          })();

          // Dark mode generation
          (async () => {
            try {
              const darkModeBaseFilename = await generateDarkModeImages(pdfPath, thumbnailDir, imagesBase);

              if (darkModeBaseFilename) {
                // Update database with dark mode image path
                db.run(
                  'UPDATE pdfs SET dark_mode_images_base = ? WHERE id = ?',
                  [darkModeBaseFilename, pdfId],
                  (updateErr) => {
                    if (updateErr) {
                      console.error('[Dark Mode] Error updating database:', updateErr);
                      return;
                    }

                    // Broadcast dark mode update to all clients
                    broadcastUpdate('pdf_dark_mode_ready', {
                      id: pdfId,
                      dark_mode_images_base: darkModeBaseFilename
                    });

                    console.log(`[Dark Mode] Database updated for PDF ${pdfId}`);
                  }
                );
              }
            } catch (darkModeErr) {
              console.error(`[Dark Mode] Error in background generation for PDF ${pdfId}:`, darkModeErr);
            } finally {
              darkModeComplete = true;
              checkAndCleanup();
            }
          })();

          // Cleanup function - delete PDF after both tasks complete
          const checkAndCleanup = async () => {
            if (ocrComplete && darkModeComplete) {
              try {
                await fs.unlink(pdfPath);
                console.log(`[Cleanup] Deleted original PDF file: ${filename}`);
              } catch (unlinkErr) {
                console.error('[Cleanup] Error deleting PDF file:', unlinkErr);
              }
            }
          };
        });
      }
    );
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

      // Delete image files only if it's not a placeholder
      if (!row.is_placeholder) {
        try {
          // Delete thumbnail image
          await fs.unlink(path.join(thumbnailDir, row.thumbnail));

          // Delete all generated page images if they exist
          if (row.images_base && row.page_count) {
            for (let i = 1; i <= row.page_count; i++) {
              try {
                await fs.unlink(path.join(thumbnailDir, `${row.images_base}-${i}.png`));
              } catch (pageErr) {
                // Ignore if page image doesn't exist
                console.error(`Error deleting page ${i}:`, pageErr);
              }
            }
          }
        } catch (fileErr) {
          console.error('Error deleting image files:', fileErr);
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
      'INSERT INTO pdfs (filename, original_name, thumbnail, position, is_placeholder, is_pending) VALUES (?, ?, ?, ?, ?, ?)',
      [null, null, null, position, 1, 0],
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
          is_placeholder: 1,
          is_pending: 0
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

app.put('/api/pdfs/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_pending } = req.body;

    if (is_pending === undefined || is_pending === null) {
      return res.status(400).json({ error: 'is_pending is required' });
    }

    db.run(
      'UPDATE pdfs SET is_pending = ? WHERE id = ?',
      [is_pending ? 1 : 0, id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'PDF not found' });
        }

        // Broadcast update to all clients
        broadcastUpdate('pdf_status_updated', { id, is_pending: is_pending ? 1 : 0 });

        res.json({ success: true, id, is_pending: is_pending ? 1 : 0 });
      }
    );
  } catch (error) {
    console.error('Error updating PDF status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/pdfs/:id/metadata', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { job_number, construction_method } = req.body;

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];

    if (job_number !== undefined) {
      updates.push('job_number = ?');
      values.push(job_number);
    }

    if (construction_method !== undefined) {
      updates.push('construction_method = ?');
      values.push(construction_method);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'At least one field required' });
    }

    values.push(id); // Add id for WHERE clause

    db.run(
      `UPDATE pdfs SET ${updates.join(', ')} WHERE id = ?`,
      values,
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'PDF not found' });
        }

        // Fetch updated PDF to broadcast
        db.get('SELECT * FROM pdfs WHERE id = ?', [id], (err, pdf) => {
          if (err || !pdf) {
            console.error('Error fetching updated PDF:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          // Broadcast update to all clients
          broadcastUpdate('pdf_metadata_updated', {
            id: pdf.id,
            job_number: pdf.job_number,
            construction_method: pdf.construction_method
          });

          res.json({
            success: true,
            id: pdf.id,
            job_number: pdf.job_number,
            construction_method: pdf.construction_method
          });
        });
      }
    );
  } catch (error) {
    console.error('Error updating PDF metadata:', error);
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

app.put('/api/labels/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Name and color required' });
    }

    db.run(
      'UPDATE labels SET name = ?, color = ? WHERE id = ?',
      [name.toUpperCase(), color, id],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Label name already exists' });
          }
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Label not found' });
        }

        // Broadcast update to all clients
        broadcastUpdate('label_updated', {
          id: parseInt(id),
          name: name.toUpperCase(),
          color
        });

        res.json({
          id: parseInt(id),
          name: name.toUpperCase(),
          color
        });
      }
    );
  } catch (error) {
    console.error('Error updating label:', error);
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

// OCR Region Routes
app.get('/api/ocr-regions', async (req, res) => {
  try {
    db.all('SELECT * FROM ocr_regions ORDER BY field_name ASC', [], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  } catch (error) {
    console.error('Error fetching OCR regions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/ocr-regions/:field_name', authMiddleware, async (req, res) => {
  try {
    const { field_name } = req.params;
    const { x, y, width, height, description } = req.body;

    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      return res.status(400).json({ error: 'x, y, width, and height required' });
    }

    db.run(
      'UPDATE ocr_regions SET x = ?, y = ?, width = ?, height = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE field_name = ?',
      [parseInt(x), parseInt(y), parseInt(width), parseInt(height), description || null, field_name],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'OCR region not found' });
        }

        // Broadcast update to all clients
        broadcastUpdate('ocr_region_updated', {
          field_name,
          x: parseInt(x),
          y: parseInt(y),
          width: parseInt(width),
          height: parseInt(height),
          description
        });

        res.json({
          field_name,
          x: parseInt(x),
          y: parseInt(y),
          width: parseInt(width),
          height: parseInt(height),
          description
        });
      }
    );
  } catch (error) {
    console.error('Error updating OCR region:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test OCR on a specific region of an uploaded image
app.post('/api/ocr-test', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file && !req.body.imagePath) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const { x, y, width, height } = req.body;

    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      return res.status(400).json({ error: 'Region coordinates required' });
    }

    // Use provided image or uploaded file
    let imagePath;
    if (req.file) {
      imagePath = req.file.path;
    } else {
      imagePath = path.join(thumbnailDir, req.body.imagePath);
    }

    // Run OCR on specific region using ImageMagick crop + tesseract
    const tempDir = '/tmp';
    const timestamp = Date.now();
    const croppedImage = path.join(tempDir, `ocr-crop-${timestamp}.png`);

    // Check if input is a PDF - if so, convert to PNG first
    let processedImagePath = imagePath;
    const isPdf = imagePath.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const pdfToPngPath = path.join(tempDir, `ocr-pdf-${timestamp}`);
      const convertPdfCommand = `pdftocairo -png -f 1 -l 1 -singlefile -r 300 "${imagePath}" "${pdfToPngPath}"`;
      console.log(`Converting PDF to PNG: ${convertPdfCommand}`);
      await execAsync(convertPdfCommand);
      processedImagePath = `${pdfToPngPath}.png`;
    }

    // Crop the image to the specified region
    const cropCommand = `magick "${processedImagePath}" -crop ${width}x${height}+${x}+${y} "${croppedImage}"`;
    console.log(`Cropping image: ${cropCommand}`);
    await execAsync(cropCommand);

    // Run OCR on cropped image
    const { stdout } = await execAsync(`tesseract "${croppedImage}" stdout`);

    // Clean up temporary files
    try {
      await fs.unlink(croppedImage);
      if (isPdf && processedImagePath !== imagePath) {
        await fs.unlink(processedImagePath); // Delete temporary PNG from PDF conversion
      }
      if (req.file) {
        await fs.unlink(imagePath);
      }
    } catch (unlinkErr) {
      console.error('Error deleting temporary files:', unlinkErr);
    }

    res.json({
      text: stdout.trim(),
      region: { x: parseInt(x), y: parseInt(y), width: parseInt(width), height: parseInt(height) }
    });
  } catch (error) {
    console.error('Error testing OCR:', error);
    res.status(500).json({ error: 'Failed to test OCR', details: error.message });
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
