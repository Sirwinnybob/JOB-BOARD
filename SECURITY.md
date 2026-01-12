# Security Documentation

This document provides detailed information about the security features and best practices for the Job Board application.

## Table of Contents

- [Authentication System](#authentication-system)
- [Password Security](#password-security)
- [Session Management](#session-management)
- [Rate Limiting](#rate-limiting)
- [Security Headers](#security-headers)
- [Best Practices](#best-practices)
- [Security Checklist](#security-checklist)

## Authentication System

The Job Board uses a robust JWT-based authentication system with device-specific session tracking.

### How It Works

1. **Login Process**:
   - User submits username and password
   - Server validates credentials (bcrypt hash comparison)
   - Server generates a unique device session ID
   - Server creates JWT token containing username and device session ID
   - Token is returned to client and stored in localStorage
   - Device session is tracked server-side with activity timestamps

2. **Request Authentication**:
   - Client sends JWT token in Authorization header
   - Server validates token signature and expiration
   - Server checks if device session still exists (prevents logout bypass)
   - Server updates last activity timestamp
   - Request proceeds if all checks pass

3. **Session Validation**:
   - Server-side session state is authoritative
   - Client token is useless if server-side session doesn't exist
   - Periodic validation every 5 minutes on client
   - WebSocket notifications for server-side logout events

### Device-Specific Sessions

Each login creates a unique device session:
- Prevents token sharing across devices
- Allows selective logout (one device doesn't affect others)
- Tracks activity per device
- Enables device-specific notifications

## Password Security

### Bcrypt Password Hashing

The application supports bcrypt password hashing for secure password storage.

#### Why Bcrypt?

- **One-way hashing**: Cannot be reversed to get original password
- **Salted**: Each hash is unique even for same password
- **Adaptive**: Computational cost can be increased over time
- **Industry standard**: Proven and widely trusted

#### Generating Hashed Passwords

Use the provided utility script:

```bash
node backend/scripts/hash-password.js your_secure_password
```

Output:
```
✅ Password hashed successfully!

Copy the following hash to your .env file:

ADMIN_PASSWORD=$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

─────────────────────────────────────────────────────────────
Security Notes:
  • Keep this hash secure - treat it like a password
  • Never commit your .env file to version control
  • The hash uses bcrypt with 10 salt rounds
  • This hash cannot be reversed to get the original password
─────────────────────────────────────────────────────────────
```

#### Password Storage Formats

The system automatically detects password format:

1. **Bcrypt Hash (Recommended)**:
   ```
   ADMIN_PASSWORD=$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
   ```
   - Starts with `$2a$`, `$2b$`, or `$2y$`
   - Server uses `bcrypt.compare()` for validation
   - No security warnings

2. **Plain Text (Legacy, Not Recommended)**:
   ```
   ADMIN_PASSWORD=my_password_123
   ```
   - Server logs security warning on startup
   - Direct string comparison
   - Vulnerable if .env file is compromised

#### Password Requirements

Recommended password characteristics:
- Minimum 12 characters
- Mix of uppercase and lowercase letters
- Include numbers and special characters
- Avoid common words or patterns
- Don't reuse passwords from other services

Example strong password: `K9$mP2wX@vL5qN8t`

## Session Management

### Session Timeout

Sessions automatically expire after **30 minutes of inactivity**.

How it works:
- Server tracks `lastActivity` timestamp for each session
- Every authenticated request updates the timestamp
- Background cleanup runs every 5 minutes
- Expired sessions are removed and clients notified

Configuration:
```javascript
// backend/server.js
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
```

### Token Expiration

JWT tokens expire on **next Friday at 6:00 PM**.

This weekly expiration aligns with typical work schedules but can be modified in `getSecondsUntilFridayEvening()` function.

### Logout Mechanisms

Three ways sessions can end:

1. **Manual Logout**:
   - User clicks logout button
   - Client calls `/api/auth/logout`
   - Server removes device session
   - WebSocket notification sent to device
   - Client clears localStorage

2. **Session Timeout**:
   - 30 minutes of inactivity
   - Server cleanup detects expired session
   - Session removed from server
   - WebSocket notification sent if connected
   - Client automatically logs out

3. **Token Expiration**:
   - JWT token expires (Friday 6 PM)
   - Next request returns 401 Unauthorized
   - Client 401 interceptor clears auth
   - User redirected to login

### Periodic Validation

Client validates token with server every 5 minutes:
- Ensures server-side session still exists
- Detects if session was removed externally
- Prevents "zombie" sessions
- Automatic logout on validation failure

## Rate Limiting

Two levels of rate limiting protect against abuse:

### General Rate Limiting

Protects all endpoints:
- **Window**: 15 minutes
- **Max Requests**: 500 per IP
- **Purpose**: Prevent general API abuse

### Login Rate Limiting

Protects login endpoint specifically:
- **Window**: 15 minutes
- **Max Attempts**: 10 per IP
- **Purpose**: Prevent brute force attacks
- **Applies to**: Both successful and failed logins

Configuration:
```javascript
// backend/server.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
});
```

When rate limit is exceeded:
```json
{
  "error": "Too many login attempts. Please try again later."
}
```

## Security Headers

The application uses [Helmet.js](https://helmetjs.github.io/) for security headers.

Configured headers:
```javascript
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
```

Default Helmet protections include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- Strict Transport Security (when HTTPS enabled)

## Best Practices

### Deployment Security

1. **HTTPS/TLS**:
   - Always use HTTPS in production
   - Configure reverse proxy (Nginx, Caddy, etc.)
   - Use Let's Encrypt for free SSL certificates

2. **Environment Variables**:
   - Never commit `.env` files to Git
   - Add `.env` to `.gitignore`
   - Use different credentials per environment
   - Rotate secrets periodically

3. **Reverse Proxy**:
   - Enable WebSocket support
   - Set appropriate client_max_body_size (50M+)
   - Configure proper proxy headers
   - Enable rate limiting at proxy level

4. **Container Security**:
   - Run container as non-root user (already configured)
   - Keep base images updated
   - Scan images for vulnerabilities
   - Use specific image versions (not `:latest`)

### Monitoring & Logging

Watch for suspicious activity:

1. **Failed Login Attempts**:
   ```
   ❌ Invalid credentials from IP: 192.168.1.100
   ```

2. **Rate Limit Triggers**:
   ```
   ⚠️  Rate limit exceeded for IP: 192.168.1.100
   ```

3. **Plain Text Password Warning**:
   ```
   ⚠️  WARNING: ADMIN_PASSWORD is stored in plain text
   ```

4. **Session Activity**:
   ```
   ✅ Login successful - Device session created: device_1234...
   🚪 Device logout requested: device_1234...
   ⏱️  Session expired: device_1234... (inactive for 35 minutes)
   ```

## Security Checklist

Before deploying to production:

- [ ] Generate and set strong JWT_SECRET (32+ chars)
- [ ] Hash admin password with bcrypt
- [ ] Update ADMIN_PASSWORD in .env with hash
- [ ] Verify `.env` is in `.gitignore`
- [ ] Enable HTTPS via reverse proxy
- [ ] Configure WebSocket support in proxy
- [ ] Test login and logout flows
- [ ] Verify rate limiting works
- [ ] Check security headers with securityheaders.com
- [ ] Set up monitoring/alerting for auth failures
- [ ] Document password recovery procedure
- [ ] Create backup of .env file (stored securely)
- [ ] Test session timeout behavior
- [ ] Verify periodic token validation works
- [ ] Configure firewall rules
- [ ] Keep dependencies updated

### Initial Setup Commands

```bash
# 1. Generate JWT Secret
openssl rand -base64 32

# 2. Hash password
node backend/scripts/hash-password.js YourSecurePassword123

# 3. Update .env
nano .env

# 4. Restart application
docker-compose down
docker-compose up -d

# 5. Verify security
curl https://your-domain.com/api/health
```

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to: [your-security-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work to address the issue promptly.

## Security Updates

Stay informed about security updates:
- Watch the GitHub repository for security releases
- Review CHANGELOG.md for security-related changes
- Keep dependencies updated with `npm audit fix`

---

**Remember**: Security is an ongoing process, not a one-time setup. Regularly review and update your security practices.
