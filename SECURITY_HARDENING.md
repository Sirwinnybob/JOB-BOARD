# Security Hardening Guide

This document outlines the security hardening measures implemented in the Job Board application and provides additional recommendations for production deployments.

## Table of Contents

- [Container Security](#container-security)
- [File System Permissions](#file-system-permissions)
- [Network Security](#network-security)
- [Application Security](#application-security)
- [Monitoring & Auditing](#monitoring--auditing)
- [Deployment Checklist](#deployment-checklist)

## Container Security

### Non-Root User Execution

**Status**: ✅ Implemented

The application now runs as a non-root user (`appuser`, UID 1000) inside the container, following the **principle of least privilege**.

#### What This Protects Against:

1. **Container Breakout**: Even if an attacker compromises the application, they have limited privileges
2. **File System Tampering**: Cannot modify system files or install packages
3. **Privilege Escalation**: Reduces attack surface significantly

#### Implementation Details:

**Dockerfile**:
```dockerfile
# Create non-root user
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

# Set proper ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser
```

**docker-compose.yml**:
```yaml
services:
  job-board:
    user: "1000:1000"  # Enforce non-root execution
```

### File System Access Restrictions

**Status**: ✅ Implemented

The application has read/write access **only** to:
- `/app/data` - Database, uploads, thumbnails
- `/app` - Application code (read-only after setup)

#### Directory Structure:

```
/app
├── data/                    # Read/Write (UID 1000)
│   ├── uploads/            # Uploaded PDFs (temporary)
│   ├── thumbnails/         # Generated images
│   ├── ocr-test/           # OCR test images
│   └── database.sqlite     # SQLite database
├── frontend/               # Read-only
├── middleware/             # Read-only
├── utils/                  # Read-only
├── scripts/                # Read-only (password hashing utility)
├── node_modules/           # Read-only
└── server.js               # Read-only
```

### Volume Permissions

When using Docker volumes, ensure host directories have correct permissions:

```bash
# Create data directory on host
mkdir -p ./data/{uploads,thumbnails,ocr-test}

# Set ownership to UID 1000 (matches container user)
sudo chown -R 1000:1000 ./data

# Or allow your current user and UID 1000
sudo chown -R $USER:1000 ./data
chmod -R 775 ./data
```

### Read-Only Root Filesystem (Optional)

For **maximum security**, you can mount the root filesystem as read-only:

```yaml
services:
  job-board:
    user: "1000:1000"
    read_only: true
    tmpfs:
      - /tmp:size=100M,mode=1777
      - /app/data:size=5G,uid=1000,gid=1000
```

⚠️ **Note**: This requires tmpfs for writable directories and may complicate database persistence.

## File System Permissions

### Current Permissions

| Path | Owner | Permissions | Purpose |
|------|-------|-------------|---------|
| `/app` | appuser:appuser | 755 | Application root |
| `/app/data` | appuser:appuser | 755 | Data directory |
| `/app/data/uploads` | appuser:appuser | 755 | PDF uploads |
| `/app/data/thumbnails` | appuser:appuser | 755 | Generated images |
| `/app/server.js` | appuser:appuser | 644 | Server code |
| `/app/scripts/*.js` | appuser:appuser | 755 | Utility scripts |

### Principle of Least Privilege

The application can:
- ✅ Read application code
- ✅ Write to `/app/data` subdirectories
- ✅ Execute Node.js and installed binaries
- ✅ Listen on port 3000

The application cannot:
- ❌ Modify application code
- ❌ Install system packages
- ❌ Access other containers
- ❌ Bind to privileged ports (<1024) without mapping
- ❌ Access host filesystem outside mounted volumes

## Network Security

### Port Binding

**Default**: Application listens on port 3000

```yaml
ports:
  - "3000:3000"  # Host:Container
```

**Recommended**: Use a reverse proxy and don't expose port directly:

```yaml
# Don't expose port to host
# expose:
#   - "3000"  # Only accessible within Docker network

# Use with Nginx Proxy Manager or similar
networks:
  - reverse-proxy-network
```

### Network Isolation

Create isolated networks for better security:

```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No internet access

services:
  job-board:
    networks:
      - frontend  # Reverse proxy can reach
      - backend   # Can reach database if needed
```

### Firewall Rules

If exposing port directly, restrict access with firewall:

```bash
# Allow only from reverse proxy IP
sudo ufw allow from 192.168.1.100 to any port 3000

# Or allow from local network only
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

## Application Security

### Environment Variables

**Never expose sensitive environment variables**:

```yaml
# ❌ BAD - Don't expose secrets
environment:
  - JWT_SECRET=abc123...

# ✅ GOOD - Use Docker secrets or .env file
environment:
  - JWT_SECRET=${JWT_SECRET}
secrets:
  - jwt_secret
```

### Secrets Management

**Docker Secrets** (Swarm mode):
```yaml
secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  admin_password:
    file: ./secrets/admin_password_hash.txt

services:
  job-board:
    secrets:
      - jwt_secret
      - admin_password
```

**Environment File** (.env):
```bash
# Create secure .env file
touch .env
chmod 600 .env  # Only owner can read/write

# Add secrets
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ADMIN_PASSWORD=\$2b\$10\$..." >> .env
```

### Security Headers

Currently implemented via Helmet.js:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

**Additional headers** (configure in reverse proxy):
```nginx
# Nginx configuration
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### CORS Configuration

**Current**: Wide open (allows all origins)
```javascript
app.use(cors());
```

**Recommended**: Restrict to specific origins in production:
```javascript
app.use(cors({
  origin: ['https://your-domain.com'],
  credentials: true,
  optionsSuccessStatus: 200
}));
```

Add to backend/server.js (around line 423):
```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : '*',
  credentials: true
};
app.use(cors(corsOptions));
```

## Monitoring & Auditing

### Security Logging

**What to monitor**:
```javascript
// Login attempts (already logged)
✅ Login successful - Device session created
❌ Invalid credentials from IP: x.x.x.x

// Rate limiting
⚠️  Rate limit exceeded for IP: x.x.x.x

// Session management
⏱️  Session expired: device_xxx (inactive for 35 minutes)
🚪 Device logout requested

// Security warnings
⚠️  WARNING: ADMIN_PASSWORD is stored in plain text
```

### Log Aggregation

**Recommended setup**:
```yaml
services:
  job-board:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "app=job-board"
```

**Send logs to external service**:
```yaml
logging:
  driver: "syslog"
  options:
    syslog-address: "tcp://logs.example.com:514"
    tag: "job-board"
```

### Intrusion Detection

Monitor for suspicious patterns:
- Multiple failed login attempts from same IP
- Login attempts from unusual locations/times
- Rapid file uploads
- Excessive API requests
- WebSocket connection spam

## Deployment Checklist

### Pre-Deployment

- [ ] Generate secure JWT secret (32+ characters)
- [ ] Hash admin password with bcrypt
- [ ] Update `.env` with hashed password
- [ ] Set restrictive file permissions on `.env` (chmod 600)
- [ ] Remove `.env` from version control (.gitignore)
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Build Docker image as non-root user
- [ ] Test application with non-root user locally
- [ ] Verify volume permissions (UID 1000)

### Network Security

- [ ] Configure reverse proxy (Nginx/Caddy)
- [ ] Enable HTTPS/TLS with valid certificate
- [ ] Configure WebSocket support in proxy
- [ ] Set up firewall rules (UFW/iptables)
- [ ] Restrict CORS to specific origins
- [ ] Disable direct port exposure if using proxy
- [ ] Configure rate limiting at proxy level

### Container Security

- [ ] Run container as non-root user (UID 1000)
- [ ] Verify `USER appuser` in Dockerfile
- [ ] Add `user: "1000:1000"` to docker-compose.yml
- [ ] Use specific image tags (not `:latest`)
- [ ] Scan container image for vulnerabilities
- [ ] Enable Docker security options (AppArmor/SELinux)
- [ ] Configure resource limits (memory/CPU)
- [ ] Enable health checks

### Application Security

- [ ] Use bcrypt-hashed passwords
- [ ] Verify session timeout (30 min) is appropriate
- [ ] Test login rate limiting (10 attempts/15 min)
- [ ] Configure security headers (CSP, HSTS)
- [ ] Disable unnecessary features/endpoints
- [ ] Validate file upload restrictions (50MB, PDF only)
- [ ] Test WebSocket authentication
- [ ] Verify database file permissions

### Monitoring

- [ ] Set up log aggregation
- [ ] Configure alerting for failed logins
- [ ] Monitor rate limit triggers
- [ ] Track session expirations
- [ ] Set up health check monitoring
- [ ] Configure backup system for database
- [ ] Document incident response procedures

## Additional Hardening (Advanced)

### Security Scanning

```bash
# Scan Docker image for vulnerabilities
docker scan winnybob/job-board:latest

# Or use Trivy
trivy image winnybob/job-board:latest

# Scan for secrets in code
trufflehog filesystem ./

# Check for dependency vulnerabilities
npm audit
```

### Container Security Profile

**AppArmor profile** (security/apparmor/job-board):
```
#include <tunables/global>

profile job-board flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>

  # Allow network
  network inet stream,
  network inet6 stream,

  # Allow reading application files
  /app/** r,

  # Allow writing to data directory only
  /app/data/** rw,

  # Deny everything else
  deny /** w,
}
```

Apply with:
```yaml
services:
  job-board:
    security_opt:
      - apparmor=job-board
```

### Resource Limits

Prevent DoS via resource exhaustion:

```yaml
services:
  job-board:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
```

## Security Maintenance

### Regular Updates

**Weekly**:
- Check for npm package updates: `npm outdated`
- Review security advisories: `npm audit`
- Check Docker base image updates

**Monthly**:
- Update all dependencies: `npm update`
- Rebuild Docker image with latest base image
- Review access logs for suspicious activity
- Test backup/restore procedures

**Quarterly**:
- Review and rotate JWT secret
- Audit user accounts and permissions
- Security assessment of application
- Update security documentation

## Support

For security concerns or vulnerabilities:
- Email: [security@example.com]
- Security Policy: See SECURITY.md
- Bug Bounty: [If applicable]

---

**Remember**: Security is a continuous process. Regularly review and update these measures as threats evolve.
