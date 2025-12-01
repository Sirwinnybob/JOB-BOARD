const jwt = require('jsonwebtoken');

// Factory function to create auth middleware with access to device sessions
function createAuthMiddleware(deviceSessions) {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if device session is still valid (for tokens with deviceSessionId)
      if (decoded.deviceSessionId) {
        if (!deviceSessions.has(decoded.deviceSessionId)) {
          return res.status(401).json({ error: 'Device session expired or logged out' });
        }
        // Update last activity
        const session = deviceSessions.get(decoded.deviceSessionId);
        session.lastActivity = Date.now();
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

// For backwards compatibility with old tokens (no deviceSessionId)
const basicAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { createAuthMiddleware, basicAuthMiddleware };
