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
const webpush = require('web-push');
const db = require('./db');
const authMiddleware = require('./middleware/auth');
const { generateThumbnail, generatePdfImages, generateDarkModeImages } = require('./utils/thumbnail');
const { extractMetadata } = require('./utils/textExtraction');

const execAsync = promisify(exec);

// Configure Web Push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✅ Web Push configured with VAPID keys');
} else {
  console.warn('⚠️  Web Push not configured: Missing VAPID keys in .env');
  console.warn('   Run: node generate-vapid-keys.js to generate keys');
}

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

// Track device connections to prevent duplicates
// Map: deviceId -> WebSocket connection
const deviceConnections = new Map();

// Helper function to generate a unique device identifier
function getDeviceId(req) {
  const ip = req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';
  // Create a simple hash from IP + User-Agent
  const deviceString = `${ip}|${userAgent}`;
  return deviceString;
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const deviceId = getDeviceId(req);

  // Check if this device already has a connection
  if (deviceConnections.has(deviceId)) {
    const oldWs = deviceConnections.get(deviceId);
    console.log(`🔄 Device reconnecting (closing old connection): ${deviceId.substring(0, 50)}...`);

    // Only close the old connection if it's still open
    if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
      try {
        oldWs.close(1000, 'New connection from same device');
      } catch (error) {
        console.error('Error closing old WebSocket:', error);
      }
    }
  }

  // Store the new connection
  deviceConnections.set(deviceId, ws);
  console.log('✅ WebSocket client connected. Total unique devices:', deviceConnections.size);

  ws.isAlive = true;
  ws.deviceId = deviceId; // Store deviceId on the WebSocket object

  // Handle pong responses
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    // Remove from device connections map
    if (ws.deviceId && deviceConnections.get(ws.deviceId) === ws) {
      deviceConnections.delete(ws.deviceId);
    }
    console.log('🔌 WebSocket client disconnected. Total unique devices:', deviceConnections.size);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  // Handle incoming messages from clients
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Relay edit lock messages to all clients
      if (data.type === 'edit_lock_acquired' || data.type === 'edit_lock_released') {
        console.log(`📢 Relaying ${data.type} from ${data.data?.sessionId?.substring(0, 10)}...`);
        broadcastUpdate(data.type, data.data);
      }
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  });
});

// Heartbeat to detect broken connections (increased to 60s for better stability)
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('⏱️  Terminating inactive WebSocket connection (no pong received)');
      // Remove from device connections map before terminating
      if (ws.deviceId && deviceConnections.get(ws.deviceId) === ws) {
        deviceConnections.delete(ws.deviceId);
      }
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 60000); // Check every 60 seconds (was 30s, increased for stability)

// Clean up on server shutdown
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Optimized broadcast function to send updates to all connected clients via WebSocket and Push
async function broadcastUpdate(type, data = {}) {
  const message = JSON.stringify({ type, data, timestamp: Date.now() });
  let wsSuccessCount = 0;
  let wsFailCount = 0;

  // Send via WebSocket to active connections
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        wsSuccessCount++;
      } catch (error) {
        console.error('Error sending to WebSocket client:', error);
        wsFailCount++;
      }
    }
  });

  console.log(`Broadcast: ${type} (WS: ${wsSuccessCount} sent, ${wsFailCount} failed)`);

  // Send Push notifications for important events
  const pushNotificationTypes = ['pdf_uploaded', 'job_activated', 'pdfs_reordered', 'custom_alert'];
  if (pushNotificationTypes.includes(type)) {
    sendPushNotifications(type, data).catch(err => {
      console.error('Error sending push notifications:', err.message);
    });
  }
}

// Send push notifications to all subscribed clients
async function sendPushNotifications(type, data) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM push_subscriptions', [], async (err, subscriptions) => {
      if (err) {
        console.error('Error fetching push subscriptions:', err);
        return reject(err);
      }

      if (subscriptions.length === 0) {
        return resolve();
      }

      // Determine notification content based on type
      let title = 'Job Board Update';
      let body = 'New update available';
      let tag = 'job-board-notification';
      let requireInteraction = false;

      if ((type === 'pdf_uploaded' && data.is_pending === 0) || type === 'job_activated') {
        title = 'Job Board Update';
        body = 'NEW JOB';
        tag = 'new-job';
      } else if (type === 'pdfs_reordered') {
        title = 'Job Board Update';
        body = 'JOB(S) MOVED';
        tag = 'jobs-moved';
      } else if (type === 'custom_alert') {
        title = 'Admin Alert';
        body = data.message || 'Important announcement';
        tag = 'admin-alert';
        requireInteraction = true;
      }

      const payload = JSON.stringify({
        title,
        body,
        tag,
        requireInteraction,
        icon: '/icon-192.png',
        badge: '/favicon-96x96.png',
        timestamp: Date.now()
      });

      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys_p256dh,
              auth: sub.keys_auth
            }
          };

          try {
            await webpush.sendNotification(pushSubscription, payload);
            // Update last_used_at
            db.run('UPDATE push_subscriptions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [sub.id]);
            return { success: true };
          } catch (error) {
            // If subscription is invalid (410 Gone), remove it
            if (error.statusCode === 410 || error.statusCode === 404) {
              console.log(`Removing invalid push subscription: ${sub.endpoint.substring(0, 50)}...`);
              db.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
            }
            return { success: false, error: error.message };
          }
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      console.log(`Push notifications: ${successful} sent, ${failed} failed`);
      resolve();
    });
  });
}

// Middleware
// Trust proxy - needed for accurate rate limiting behind reverse proxies
app.set('trust proxy', 1); // Trust first proxy (nginx, load balancer, etc.)

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
          `SELECT l.*, pl.expires_at as label_expires_at FROM labels l
           INNER JOIN pdf_labels pl ON l.id = pl.label_id
           WHERE pl.pdf_id = ?
           AND (pl.expires_at IS NULL OR pl.expires_at > datetime('now'))`,
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

              // Use existing converted image (300 DPI) instead of converting again
              const existingImagePath = path.join(thumbnailDir, `${imagesBase}-1.png`);
              console.log(`[OCR] Using existing image at: ${existingImagePath}`);

              const metadata = await extractMetadata(pdfPath, existingImagePath);
              console.log(`[OCR] Complete for PDF ${pdfId}:`, metadata);

              // Update database with extracted metadata (only if not manually set)
              db.run(
                'UPDATE pdfs SET job_number = ?, construction_method = ? WHERE id = ? AND (job_number IS NULL OR job_number = \'\') AND (construction_method IS NULL OR construction_method = \'\')',
                [metadata.job_number, metadata.construction_method, pdfId],
                (updateErr) => {
                  if (updateErr) {
                    console.error('[OCR] Error updating metadata:', updateErr);
                    return;
                  }

                  // Only broadcast if we actually updated something
                  if (this.changes > 0) {
                    // Broadcast metadata update to all clients
                    broadcastUpdate('pdf_metadata_updated', {
                      id: pdfId,
                      job_number: metadata.job_number,
                      construction_method: metadata.construction_method
                    });

                    console.log(`[OCR] Metadata updated for PDF ${pdfId}`);
                  } else {
                    console.log(`[OCR] Skipped update for PDF ${pdfId} (already has manual values)`);
                  }
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
                // Silently ignore if page image doesn't exist (only page 1 is generated initially)
                if (pageErr.code !== 'ENOENT') {
                  console.error(`Error deleting page ${i}:`, pageErr);
                }
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
      'INSERT INTO pdfs (filename, original_name, thumbnail, position, is_placeholder, is_pending, placeholder_text) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [null, null, null, position, 1, 0, 'PLACEHOLDER'],
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
          is_pending: 0,
          placeholder_text: 'PLACEHOLDER'
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

    // First, get the current status to check if we're activating a pending job
    db.get('SELECT is_pending FROM pdfs WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'PDF not found' });
      }

      const oldIsPending = row.is_pending;
      const newIsPending = is_pending ? 1 : 0;

      db.run(
        'UPDATE pdfs SET is_pending = ? WHERE id = ?',
        [newIsPending, id],
        function (err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: 'PDF not found' });
          }

          // If moving from pending to active, send job_activated event
          if (oldIsPending === 1 && newIsPending === 0) {
            broadcastUpdate('job_activated', { id, is_pending: newIsPending });
          } else {
            // Otherwise, send regular status update
            broadcastUpdate('pdf_status_updated', { id, is_pending: newIsPending });
          }

          res.json({ success: true, id, is_pending: newIsPending });
        }
      );
    });
  } catch (error) {
    console.error('Error updating PDF status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/pdfs/:id/metadata', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { job_number, construction_method, placeholder_text } = req.body;

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

    if (placeholder_text !== undefined) {
      updates.push('placeholder_text = ?');
      values.push(placeholder_text);
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
            construction_method: pdf.construction_method,
            placeholder_text: pdf.placeholder_text
          });

          res.json({
            success: true,
            id: pdf.id,
            job_number: pdf.job_number,
            construction_method: pdf.construction_method,
            placeholder_text: pdf.placeholder_text
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
    const { labels } = req.body; // Array of {labelId, expiresAt} objects

    if (!Array.isArray(labels)) {
      return res.status(400).json({ error: 'labels must be an array' });
    }

    // First, remove all existing labels for this PDF
    db.run('DELETE FROM pdf_labels WHERE pdf_id = ?', [id], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Then, add the new labels with expiration
      if (labels.length === 0) {
        // Broadcast update to all clients
        broadcastUpdate('pdf_labels_updated', { pdfId: id, labels: [] });
        return res.json({ success: true });
      }

      const stmt = db.prepare('INSERT INTO pdf_labels (pdf_id, label_id, expires_at) VALUES (?, ?, ?)');

      labels.forEach(label => {
        stmt.run(id, label.labelId, label.expiresAt || null);
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Broadcast update to all clients
        broadcastUpdate('pdf_labels_updated', { pdfId: id, labels });

        res.json({ success: true });
      });
    });
  } catch (error) {
    console.error('Error updating PDF labels:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Custom Alert Route - Send notification to all connected clients
app.post('/api/alerts/broadcast', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message must be 500 characters or less' });
    }

    // Broadcast custom alert to all connected clients
    broadcastUpdate('custom_alert', { message: message.trim() });

    res.json({ success: true, message: 'Alert sent to all connected clients' });
  } catch (error) {
    console.error('Error broadcasting alert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Push Subscription Routes

// Get VAPID public key
app.get('/api/push/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    const { endpoint, keys } = subscription;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Insert or update subscription
    db.run(
      `INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth, user_agent)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         keys_p256dh = excluded.keys_p256dh,
         keys_auth = excluded.keys_auth,
         user_agent = excluded.user_agent,
         last_used_at = CURRENT_TIMESTAMP`,
      [endpoint, keys.p256dh, keys.auth, userAgent],
      (err) => {
        if (err) {
          console.error('Error saving push subscription:', err);
          return res.status(500).json({ error: 'Failed to save subscription' });
        }

        console.log('✅ Push subscription saved:', endpoint.substring(0, 50) + '...');
        res.json({ success: true });
      }
    );
  } catch (error) {
    console.error('Error handling push subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint], (err) => {
      if (err) {
        console.error('Error removing push subscription:', err);
        return res.status(500).json({ error: 'Failed to remove subscription' });
      }

      console.log('🗑️  Push subscription removed:', endpoint.substring(0, 50) + '...');
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error handling push unsubscribe:', error);
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
    const { grid_rows, grid_cols, aspect_ratio_width, aspect_ratio_height } = req.body;

    if (!grid_rows || !grid_cols) {
      return res.status(400).json({ error: 'grid_rows and grid_cols required' });
    }

    const rows = parseInt(grid_rows);
    const cols = parseInt(grid_cols);
    const aspectWidth = aspect_ratio_width ? parseFloat(aspect_ratio_width) : null;
    const aspectHeight = aspect_ratio_height ? parseFloat(aspect_ratio_height) : null;

    if (rows < 1 || rows > 20 || cols < 1 || cols > 20) {
      return res.status(400).json({ error: 'Rows and columns must be between 1 and 20' });
    }

    if (aspectWidth !== null && (aspectWidth < 1 || aspectWidth > 50)) {
      return res.status(400).json({ error: 'Aspect ratio width must be between 1 and 50' });
    }

    if (aspectHeight !== null && (aspectHeight < 1 || aspectHeight > 50)) {
      return res.status(400).json({ error: 'Aspect ratio height must be between 1 and 50' });
    }

    const updates = [];
    const responseData = { grid_rows: rows, grid_cols: cols };

    updates.push(new Promise((resolve, reject) => {
      db.run('UPDATE settings SET value = ? WHERE key = ?', [rows, 'grid_rows'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    }));

    updates.push(new Promise((resolve, reject) => {
      db.run('UPDATE settings SET value = ? WHERE key = ?', [cols, 'grid_cols'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    }));

    if (aspectWidth !== null) {
      updates.push(new Promise((resolve, reject) => {
        db.run('UPDATE settings SET value = ? WHERE key = ?', [aspectWidth, 'aspect_ratio_width'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      }));
      responseData.aspect_ratio_width = aspectWidth;
    }

    if (aspectHeight !== null) {
      updates.push(new Promise((resolve, reject) => {
        db.run('UPDATE settings SET value = ? WHERE key = ?', [aspectHeight, 'aspect_ratio_height'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      }));
      responseData.aspect_ratio_height = aspectHeight;
    }

    Promise.all(updates)
      .then(() => {
        // Broadcast update to all clients
        broadcastUpdate('settings_updated', responseData);
        res.json(responseData);
      })
      .catch((err) => {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
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

// OCR Test Image Routes
const OCR_TEST_DIR = path.join(__dirname, 'data', 'ocr-test');
const OCR_TEST_IMAGE = path.join(OCR_TEST_DIR, 'test-image.png');

// Ensure OCR test directory exists
(async () => {
  try {
    await fs.mkdir(OCR_TEST_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating OCR test directory:', error);
  }
})();

// Upload OCR test PDF (will be converted to image)
const ocrTestUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await fs.mkdir(OCR_TEST_DIR, { recursive: true });
        cb(null, OCR_TEST_DIR);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      cb(null, 'test-upload.pdf');
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

app.post('/api/ocr-test-image', authMiddleware, ocrTestUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const pdfPath = req.file.path;
    console.log('Converting PDF to image for OCR testing:', pdfPath);

    // Convert PDF to PNG using pdftocairo (same DPI as job board display images: 300dpi)
    const outputBase = path.join(OCR_TEST_DIR, 'test-image');

    // Use same DPI as job board display images (300dpi) for consistency with OCR regions
    const command = `pdftocairo -png -f 1 -l 1 -singlefile -r 300 "${pdfPath}" "${outputBase}"`;
    console.log(`Running pdftocairo command: ${command}`);

    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(`pdftocairo stdout: ${stdout}`);
    if (stderr) console.log(`pdftocairo stderr: ${stderr}`);

    // Verify the output file exists
    const outputPath = `${outputBase}.png`;
    try {
      await fs.access(outputPath);
      console.log('OCR test image generated successfully at:', outputPath);

      // Clean up the uploaded PDF
      await fs.unlink(pdfPath);

      res.json({
        message: 'Test PDF converted to image successfully',
        filename: 'test-image.png',
        path: '/api/ocr-test-image'
      });
    } catch (err) {
      throw new Error('Failed to generate image from PDF');
    }
  } catch (error) {
    console.error('Error processing OCR test PDF:', error);
    res.status(500).json({ error: error.message || 'Failed to process test PDF' });
  }
});

app.get('/api/ocr-test-image', async (req, res) => {
  try {
    // Check if test image exists
    try {
      await fs.access(OCR_TEST_IMAGE);
    } catch {
      return res.status(404).json({ error: 'No test image found' });
    }

    res.sendFile(OCR_TEST_IMAGE);
  } catch (error) {
    console.error('Error fetching OCR test image:', error);
    res.status(500).json({ error: 'Failed to fetch test image' });
  }
});

app.delete('/api/ocr-test-image', authMiddleware, async (req, res) => {
  try {
    // Check if test image exists
    try {
      await fs.access(OCR_TEST_IMAGE);
    } catch {
      return res.status(404).json({ error: 'No test image found' });
    }

    // Delete the test image
    await fs.unlink(OCR_TEST_IMAGE);

    res.json({ message: 'Test image deleted successfully' });
  } catch (error) {
    console.error('Error deleting OCR test image:', error);
    res.status(500).json({ error: 'Failed to delete test image' });
  }
});

// Delivery Schedule endpoints
app.get('/api/delivery-schedule', async (req, res) => {
  db.get('SELECT schedule_data FROM delivery_schedule ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      console.error('Error fetching delivery schedule:', err);
      return res.status(500).json({ error: 'Failed to fetch delivery schedule' });
    }

    const scheduleData = row ? JSON.parse(row.schedule_data) : {};
    res.json({ schedule: scheduleData });
  });
});

app.put('/api/delivery-schedule', authMiddleware, async (req, res) => {
  const { slot, data } = req.body;

  if (!slot || !data) {
    return res.status(400).json({ error: 'Slot and data are required' });
  }

  // Get current schedule
  db.get('SELECT schedule_data FROM delivery_schedule ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      console.error('Error fetching current schedule:', err);
      return res.status(500).json({ error: 'Failed to fetch current schedule' });
    }

    const currentSchedule = row ? JSON.parse(row.schedule_data) : {};
    currentSchedule[slot] = data;

    // Update schedule
    db.run(
      'UPDATE delivery_schedule SET schedule_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT MAX(id) FROM delivery_schedule)',
      [JSON.stringify(currentSchedule)],
      function(err) {
        if (err) {
          console.error('Error updating delivery schedule:', err);
          return res.status(500).json({ error: 'Failed to update delivery schedule' });
        }

        res.json({ schedule: currentSchedule });
      }
    );
  });
});

// Health check with database connectivity test
app.get('/api/health', (req, res) => {
  // Quick database check
  db.get('SELECT 1', [], (err) => {
    if (err) {
      console.error('Health check failed - database error:', err);
      return res.status(503).json({ status: 'error', error: 'database unavailable' });
    }
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      connections: deviceConnections.size
    });
  });
});

// Serve React app for all other routes (Express 5 compatible)
// Using app.use() instead of app.get() to avoid path-to-regexp issues
app.use((req, res, next) => {
  // Only handle GET requests for non-API routes
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    next();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Job Board server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
