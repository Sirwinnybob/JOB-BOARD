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
const { createAuthMiddleware } = require('./middleware/auth');
const { generateThumbnail, generatePdfImages, generateImageFile, generateDarkModeImages } = require('./utils/thumbnail');
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

// Track admin device sessions - Map: deviceId -> { username, createdAt, lastActivity, websocket }
// Each login creates a unique device session (device-specific, not username-specific)
const deviceSessions = new Map();

// Track the currently editing admin's WebSocket connection
// Only one admin can edit at a time (via edit lock)
let editingAdminConnection = null;

// Helper function to generate a unique device identifier for WebSocket
function getDeviceId(req) {
  const ip = req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';
  // Create a simple hash from IP + User-Agent
  const deviceString = `${ip}|${userAgent}`;
  return deviceString;
}

// Generate a unique device session ID for login
function generateDeviceSessionId() {
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
}

// Calculate seconds until next Friday at 6 PM
function getSecondsUntilFridayEvening() {
  const now = new Date();
  const targetTime = new Date(now);

  // Get current day (0 = Sunday, 5 = Friday)
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  // Friday evening is 6 PM (18:00)
  const FRIDAY = 5;
  const EVENING_HOUR = 18;

  if (currentDay === FRIDAY && currentHour < EVENING_HOUR) {
    // Today is Friday and it's before 6 PM - expire tonight at 6 PM
    targetTime.setHours(EVENING_HOUR, 0, 0, 0);
  } else {
    // Find next Friday
    let daysUntilFriday = FRIDAY - currentDay;
    if (daysUntilFriday <= 0) {
      daysUntilFriday += 7; // Next week's Friday
    }

    targetTime.setDate(now.getDate() + daysUntilFriday);
    targetTime.setHours(EVENING_HOUR, 0, 0, 0);
  }

  const secondsUntilExpiry = Math.floor((targetTime - now) / 1000);
  console.log(`🕐 Token will expire on: ${targetTime.toLocaleString()} (in ${Math.floor(secondsUntilExpiry / 3600)} hours)`);

  return secondsUntilExpiry;
}

// Create auth middleware with access to device sessions
const authMiddleware = createAuthMiddleware(deviceSessions);

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

    // Remove websocket from device session if this was an admin
    if (ws.deviceSessionId && deviceSessions.has(ws.deviceSessionId)) {
      const session = deviceSessions.get(ws.deviceSessionId);
      if (session.websocket === ws) {
        session.websocket = null;
        console.log(`👤 WebSocket disconnected for device session: ${ws.deviceSessionId.substring(0, 20)}...`);
      }
    }

    // Clear editing admin connection if this was the editing admin
    if (editingAdminConnection === ws) {
      editingAdminConnection = null;
      console.log('🔓 Editing admin disconnected - edit lock released');
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

      // Register device session with websocket for logout notifications
      if (data.type === 'device_register') {
        const deviceSessionId = data.data?.deviceSessionId;
        if (deviceSessionId && deviceSessions.has(deviceSessionId)) {
          const session = deviceSessions.get(deviceSessionId);
          session.websocket = ws;
          session.lastActivity = Date.now();
          ws.deviceSessionId = deviceSessionId; // Store on WebSocket object
          console.log(`👤 Device session registered: ${deviceSessionId.substring(0, 20)}... (user: ${session.username})`);
        } else {
          console.warn(`⚠️  Device session not found: ${deviceSessionId?.substring(0, 20)}...`);
        }
      }
      // Relay edit lock messages to all clients
      else if (data.type === 'edit_lock_acquired') {
        console.log(`📢 Relaying ${data.type} from ${data.data?.sessionId?.substring(0, 10)}...`);
        // Store this connection as the editing admin
        editingAdminConnection = ws;
        broadcastUpdate(data.type, data.data);
      } else if (data.type === 'edit_lock_released') {
        console.log(`📢 Relaying ${data.type} from ${data.data?.sessionId?.substring(0, 10)}...`);
        // Clear the editing admin connection
        editingAdminConnection = null;
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
async function broadcastUpdate(type, data = {}, adminOnly = false) {
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
  const pushNotificationTypes = ['pdf_uploaded', 'job_uploaded_to_pending', 'job_activated', 'pdfs_reordered', 'custom_alert'];
  if (pushNotificationTypes.includes(type)) {
    sendPushNotifications(type, data, adminOnly).catch(err => {
      console.error('Error sending push notifications:', err.message);
    });
  }
}

// Send push notifications to all subscribed clients
async function sendPushNotifications(type, data, adminOnly = false) {
  return new Promise((resolve, reject) => {
    // Filter query based on admin status
    const query = adminOnly
      ? 'SELECT * FROM push_subscriptions WHERE is_admin = 1'
      : 'SELECT * FROM push_subscriptions';

    db.all(query, [], async (err, subscriptions) => {
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
      } else if (type === 'job_uploaded_to_pending') {
        title = 'Admin Notification';
        body = 'NEW PENDING JOB';
        tag = 'pending-job';
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

// Helper function to send updates only to the currently editing admin
// Used for board uploads during edit mode - updates are sent to the editing admin
// but not broadcast to other clients until Save is clicked
function sendToEditingAdmin(type, data = {}) {
  if (editingAdminConnection && editingAdminConnection.readyState === WebSocket.OPEN) {
    try {
      const message = JSON.stringify({ type, data, timestamp: Date.now() });
      editingAdminConnection.send(message);
      console.log(`Sent ${type} to editing admin only (board upload in edit mode)`);
      return true;
    } catch (error) {
      console.error('Error sending to editing admin:', error);
      return false;
    }
  }
  return false;
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
    // Determine extension based on mimetype
    let ext = '.pdf';
    if (file.mimetype === 'image/png') ext = '.png';
    else if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') ext = '.jpg';

    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (PNG, JPG) are allowed'));
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

    // Generate unique device session ID for this login
    const deviceSessionId = generateDeviceSessionId();

    // Calculate expiration time (next Friday evening at 6 PM)
    const expiresInSeconds = getSecondsUntilFridayEvening();

    // Create JWT with deviceSessionId
    const token = jwt.sign(
      { username, deviceSessionId },
      process.env.JWT_SECRET,
      { expiresIn: expiresInSeconds }
    );

    // Store device session
    deviceSessions.set(deviceSessionId, {
      username,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      websocket: null
    });

    console.log(`✅ Login successful - Device session created: ${deviceSessionId.substring(0, 20)}...`);
    console.log(`   Total active sessions: ${deviceSessions.size}`);

    res.json({ token, username, deviceSessionId });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token is still valid
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  // If we got here, the token is valid (authMiddleware passed)
  res.json({ valid: true, username: req.user.username });
});

// Logout endpoint - logs out only this specific device
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  try {
    const deviceSessionId = req.user.deviceSessionId;
    const username = req.user.username;

    if (!deviceSessionId) {
      // Old token without deviceSessionId - just return success
      console.log(`🚪 Logout for old token (no device session): ${username}`);
      return res.json({ success: true, message: 'Logged out successfully' });
    }

    console.log(`🚪 Device logout requested: ${deviceSessionId.substring(0, 20)}... (user: ${username})`);

    // Get the device session
    const session = deviceSessions.get(deviceSessionId);

    if (session) {
      // Send logout message to this specific device's websocket
      if (session.websocket && session.websocket.readyState === WebSocket.OPEN) {
        console.log(`📢 Notifying device of logout via websocket`);
        session.websocket.send(JSON.stringify({
          type: 'device_logged_out',
          data: {
            deviceSessionId,
            message: 'You have been logged out',
            timestamp: new Date().toISOString()
          }
        }));
      }

      // Remove the device session
      deviceSessions.delete(deviceSessionId);
      console.log(`✅ Device session removed. Remaining sessions: ${deviceSessions.size}`);
    } else {
      console.log(`⚠️  Device session not found (may already be logged out)`);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
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
           AND (pl.expires_at IS NULL OR datetime(pl.expires_at) > datetime('now'))`,
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
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const filePath = path.join(uploadDir, filename);
    const baseFilename = path.parse(filename).name;
    const isImage = req.file.mimetype.startsWith('image/');

    // Get is_pending from request body (default to 1 if not provided)
    const isPending = req.body.is_pending !== undefined ? parseInt(req.body.is_pending) : 1;
    const targetPosition = req.body.position !== undefined ? parseInt(req.body.position) : null;
    const skipOcr = req.body.skip_ocr === '1' || req.body.skip_ocr === 'true';

    // Generate thumbnail (fast)
    const thumbnailName = await generateThumbnail(filePath, thumbnailDir, baseFilename, isImage);

    // Generate display images
    // For images: convert/resize to PNG
    // For PDFs: extract pages as PNG
    // For custom uploads, use lower resolution to reduce file size
    const imagesBase = `${baseFilename}-pages`;
    const { pageCount } = isImage
      ? await generateImageFile(filePath, thumbnailDir, imagesBase, skipOcr)
      : await generatePdfImages(filePath, thumbnailDir, imagesBase, skipOcr);

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

        // Only broadcast immediately for pending uploads
        // Board uploads (isPending === 0) should not broadcast until Save is clicked
        if (isPending === 1) {
          // Broadcast WebSocket update to all clients (no push notification)
          // This updates the UI but doesn't send notifications
          const message = JSON.stringify({
            type: 'pdf_uploaded',
            data: {
              id: pdfId,
              filename: null,
              original_name: originalName,
              thumbnail: thumbnailName,
              position: newPosition,
              is_pending: isPending,
              page_count: pageCount,
              images_base: imagesBase,
              dark_mode_images_base: null,
              job_number: null,
              construction_method: null
            },
            timestamp: Date.now()
          });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });

          // Send push notification ONLY to admins for pending uploads
          broadcastUpdate('job_uploaded_to_pending', {
            id: pdfId,
            original_name: originalName
          }, true); // adminOnly = true
        }

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
        // Skip both for images - they don't need OCR or dark mode
        setImmediate(async () => {
          // Track completion of both background tasks
          let ocrComplete = false;
          let darkModeComplete = false;

          // Cleanup function - delete file after both tasks complete (or immediately for images)
          const checkAndCleanup = async () => {
            if (ocrComplete && darkModeComplete) {
              try {
                await fs.unlink(filePath);
                console.log(`[Cleanup] Deleted original file: ${filename}`);
              } catch (unlinkErr) {
                console.error('[Cleanup] Error deleting file:', unlinkErr);
              }
            }
          };

          // OCR extraction (skip for images and custom uploads)
          if (isImage || skipOcr) {
            console.log(`[OCR] Skipping OCR extraction for ${pdfId} (${isImage ? 'image file' : 'custom upload'})`);
            ocrComplete = true;
            checkAndCleanup();
          } else {
            (async () => {
              try {
                console.log(`[OCR] Starting background extraction for PDF ${pdfId}...`);

                // Use existing converted image (300 DPI) instead of converting again
                const existingImagePath = path.join(thumbnailDir, `${imagesBase}-1.png`);
                console.log(`[OCR] Using existing image at: ${existingImagePath}`);

                const metadata = await extractMetadata(filePath, existingImagePath);
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
                      const updateData = {
                        id: pdfId,
                        job_number: metadata.job_number,
                        construction_method: metadata.construction_method
                      };

                      if (isPending === 1) {
                        // Pending uploads: broadcast to all clients immediately
                        broadcastUpdate('pdf_metadata_updated', updateData);
                        console.log(`[OCR] Metadata updated and broadcast for PDF ${pdfId}`);
                      } else {
                        // Board uploads: send only to editing admin (not broadcast to all)
                        // This allows the editing admin to see OCR results while editing
                        // Other clients will receive the update when Save is clicked
                        sendToEditingAdmin('pdf_metadata_updated', updateData);
                        console.log(`[OCR] Metadata updated for PDF ${pdfId} (sent to editing admin only)`);
                      }
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
          }

          // Dark mode generation (skip for images and custom uploads)
          if (isImage || skipOcr) {
            console.log(`[Dark Mode] Skipping dark mode generation for ${pdfId} (${isImage ? 'image file' : 'custom upload'})`);
            darkModeComplete = true;
            checkAndCleanup();
          } else {
            (async () => {
              try {
                const darkModeBaseFilename = await generateDarkModeImages(filePath, thumbnailDir, imagesBase);

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

                      const updateData = {
                        id: pdfId,
                        dark_mode_images_base: darkModeBaseFilename
                      };

                      if (isPending === 1) {
                        // Pending uploads: broadcast to all clients immediately
                        broadcastUpdate('pdf_dark_mode_ready', updateData);
                        console.log(`[Dark Mode] Images ready and broadcast for PDF ${pdfId}`);
                      } else {
                        // Board uploads: send only to editing admin (not broadcast to all)
                        // This allows the editing admin to see dark mode images while editing
                        // Other clients will receive the update when Save is clicked
                        sendToEditingAdmin('pdf_dark_mode_ready', updateData);
                        console.log(`[Dark Mode] Images ready for PDF ${pdfId} (sent to editing admin only)`);
                      }
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
          }
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

    // Determine if user is admin by checking for valid auth token
    let isAdmin = 0;
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.username) {
          isAdmin = 1;
        }
      }
    } catch (authErr) {
      // No valid token = non-admin viewer
      isAdmin = 0;
    }

    // Insert or update subscription with admin status
    db.run(
      `INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth, user_agent, is_admin)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         keys_p256dh = excluded.keys_p256dh,
         keys_auth = excluded.keys_auth,
         user_agent = excluded.user_agent,
         is_admin = excluded.is_admin,
         last_used_at = CURRENT_TIMESTAMP`,
      [endpoint, keys.p256dh, keys.auth, userAgent, isAdmin],
      (err) => {
        if (err) {
          console.error('Error saving push subscription:', err);
          return res.status(500).json({ error: 'Failed to save subscription' });
        }

        console.log(`✅ Push subscription saved (${isAdmin ? 'Admin' : 'Viewer'}):`, endpoint.substring(0, 50) + '...');
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

      // Add company branding from environment variables
      settings.companyName = process.env.COMPANY_NAME || 'Job Board';
      settings.companyShortName = process.env.COMPANY_SHORT_NAME || 'Job Board';

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

        // Broadcast the update to all connected clients
        broadcastUpdate('delivery_schedule_updated', { schedule: currentSchedule });

        res.json({ schedule: currentSchedule });
      }
    );
  });
});

app.post('/api/delivery-schedule/reset', authMiddleware, async (req, res) => {
  // Reset the schedule to empty
  const emptySchedule = {};

  db.run(
    'UPDATE delivery_schedule SET schedule_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT MAX(id) FROM delivery_schedule)',
    [JSON.stringify(emptySchedule)],
    function(err) {
      if (err) {
        console.error('Error resetting delivery schedule:', err);
        return res.status(500).json({ error: 'Failed to reset delivery schedule' });
      }

      // Broadcast the reset to all connected clients
      broadcastUpdate('delivery_schedule_updated', { schedule: emptySchedule });

      res.json({ schedule: emptySchedule, message: 'Schedule reset successfully' });
    }
  );
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
