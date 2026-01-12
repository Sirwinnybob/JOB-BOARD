# Production Security Checklist

Use this checklist before deploying to production. Items marked ✅ are already implemented in the codebase. Items marked ⚠️ require configuration during deployment.

## 🔐 Authentication & Authorization

- ✅ **Bcrypt password hashing** - Implemented with auto-detection
- ✅ **Strong password utility** - `backend/scripts/hash-password.js` available
- ✅ **Session timeout** - 30 minutes of inactivity
- ✅ **Login rate limiting** - 10 attempts per 15 minutes
- ✅ **Token validation** - Server-side session checking on every request
- ✅ **Periodic client validation** - Every 5 minutes
- ✅ **Device-specific sessions** - Prevents token sharing
- ⚠️ **Hash production password** - Run: `node backend/scripts/hash-password.js <password>`
- ⚠️ **Generate JWT secret** - Run: `openssl rand -base64 32`
- ⚠️ **Strong admin password** - 12+ characters, mixed case, numbers, symbols

## 🐳 Container Security

- ✅ **Non-root user** - Runs as UID 1000 (appuser)
- ✅ **Limited file access** - Only /app/data is writable
- ✅ **Proper ownership** - All files owned by appuser
- ✅ **Health checks** - Container health monitoring enabled
- ⚠️ **Volume permissions** - Set host directory: `sudo chown -R 1000:1000 ./data`
- ⚠️ **Resource limits** - Consider adding memory/CPU limits in docker-compose.yml
- ⚠️ **Image scanning** - Run: `docker scan winnybob/job-board:latest`

## 📦 Dependencies

- ✅ **No critical vulnerabilities** - All patched as of last commit
- ⚠️ **Regular updates** - Run `npm audit` weekly
- ⚠️ **Update packages** - Run `npm update` monthly
- ⚠️ **Rebuild image** - Pull latest base image quarterly

## 🌐 Network Security

- ✅ **Rate limiting (general)** - 500 requests per 15 minutes
- ✅ **Rate limiting (login)** - 10 attempts per 15 minutes
- ✅ **Security headers** - Helmet.js configured
- ⚠️ **HTTPS/TLS** - Configure reverse proxy with SSL certificate
- ⚠️ **CORS restriction** - See [CORS Configuration](#cors-configuration) below
- ⚠️ **Firewall rules** - Restrict access to port 3000
- ⚠️ **WebSocket TLS** - Ensure WSS:// is used in production

## 📁 File System

- ✅ **.env in .gitignore** - Secrets won't be committed
- ✅ **File upload validation** - PDF and images only, 50MB max
- ✅ **Parameterized queries** - All SQL queries use placeholders
- ✅ **No eval/exec** - No dynamic code execution
- ✅ **Read-only app code** - Application code cannot be modified
- ⚠️ **Backup strategy** - Set up automated backups of ./data directory

## 🔍 Monitoring & Logging

- ✅ **Authentication logging** - Login attempts, failures, sessions
- ✅ **Security warnings** - Plain text password warnings
- ✅ **Error handling** - Generic error messages (no info leakage)
- ⚠️ **Log aggregation** - Set up centralized logging (optional)
- ⚠️ **Alerting** - Monitor for suspicious activity (optional)
- ⚠️ **Regular review** - Check logs weekly for anomalies

## 🚨 Known Limitations & Recommendations

### CORS Configuration

**Current Status**: ⚠️ **Wide open** - Accepts requests from any origin

```javascript
// backend/server.js line 423
app.use(cors());  // ⚠️ Allows all origins
```

**Recommendation for Production**:
```javascript
// Restrict to your domain(s)
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

Add to `.env`:
```bash
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Content Security Policy

**Current Status**: ⚠️ **Disabled** - CSP headers not configured

```javascript
// backend/server.js line 421
contentSecurityPolicy: false  // ⚠️ CSP disabled
```

**Recommendation**: Enable CSP or configure in reverse proxy:
```nginx
# Nginx configuration
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss://your-domain.com;" always;
```

### WebSocket Authentication

**Current Status**: ✅ Partially secure
- WebSocket connections are open (for viewer notifications)
- Admin operations require JWT token
- Edit lock prevents concurrent admin editing

**Note**: Public viewers can connect to WebSocket but only receive read-only updates. This is by design for real-time board updates.

### Database Encryption

**Current Status**: ⚠️ **Not encrypted at rest**

SQLite database file is stored in plain text. Consider:
1. **Encrypted volume** - Use LUKS or similar for data directory
2. **Application-level encryption** - Encrypt sensitive fields
3. **File system encryption** - Enable on host system

**Note**: Database contains:
- PDF metadata (job numbers, construction methods)
- Label assignments
- Settings (grid size, etc.)
- Push notification subscriptions

No passwords or JWT secrets are stored in database.

## 📋 Pre-Deployment Steps

### 1. Generate Secrets (5 minutes)

```bash
# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET" >> .env

# Hash admin password
node backend/scripts/hash-password.js YourSecurePassword123
# Copy output hash to .env:
echo "ADMIN_PASSWORD=\$2b\$10\$..." >> .env

# Set admin username
echo "ADMIN_USERNAME=your_admin" >> .env
```

### 2. Configure Environment (2 minutes)

```bash
# Set company branding (optional)
echo "COMPANY_NAME=Your Company" >> .env
echo "COMPANY_SHORT_NAME=YourCo" >> .env

# Set production mode
echo "NODE_ENV=production" >> .env

# Set CORS (recommended)
echo "ALLOWED_ORIGINS=https://your-domain.com" >> .env
```

### 3. Set Up Volumes (2 minutes)

```bash
# Create data directory
mkdir -p ./data/{uploads,thumbnails,ocr-test}

# Set proper ownership
sudo chown -R 1000:1000 ./data
chmod -R 775 ./data

# Verify permissions
ls -la ./data
# Should show: drwxrwxr-x ... 1000 1000 ...
```

### 4. Deploy Container (5 minutes)

```bash
# Pull latest image
docker-compose pull

# Start container
docker-compose up -d

# Check logs
docker logs job-board-app

# Verify health
curl http://localhost:3000/api/health
```

### 5. Verify Security (5 minutes)

```bash
# 1. Check container runs as non-root
docker exec job-board-app whoami
# Expected: appuser

# 2. Check for password warning
docker logs job-board-app | grep "WARNING.*PASSWORD"
# Expected: No output (if password is hashed)

# 3. Test login rate limiting
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}'
  echo ""
done
# Expected: Error after 10 attempts

# 4. Check session timeout (wait 31 minutes, then try API)
# Expected: 401 Unauthorized after 30 min of inactivity

# 5. Verify file permissions
docker exec job-board-app ls -la /app/data
# Expected: drwxr-xr-x ... appuser appuser ...
```

### 6. Configure Reverse Proxy (15 minutes)

**Nginx Example**:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 50M;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;

        # Standard headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔄 Ongoing Maintenance

### Weekly
- [ ] Check application logs for errors
- [ ] Monitor failed login attempts
- [ ] Run `npm audit` for new vulnerabilities
- [ ] Verify backups are running

### Monthly
- [ ] Update npm packages: `npm update`
- [ ] Review access logs for anomalies
- [ ] Test disaster recovery procedure
- [ ] Rotate JWT secret (optional)

### Quarterly
- [ ] Security assessment
- [ ] Update base Docker image
- [ ] Review and update firewall rules
- [ ] Update SSL certificates (if not automated)

## 📞 Security Contacts

- **Security Issues**: [your-security-email@example.com]
- **GitHub Issues**: https://github.com/Sirwinnybob/JOB-BOARD/issues
- **Documentation**: See SECURITY.md and SECURITY_HARDENING.md

## ✅ Final Verification

Before going live, verify all these are true:

- [ ] ADMIN_PASSWORD is bcrypt hashed (starts with $2b$)
- [ ] JWT_SECRET is 32+ characters and randomly generated
- [ ] Container runs as UID 1000 (non-root)
- [ ] Data directory permissions are correct (1000:1000)
- [ ] HTTPS is enabled via reverse proxy
- [ ] WebSocket works over WSS://
- [ ] File uploads restricted to PDF/images, max 50MB
- [ ] Login rate limiting works (tested)
- [ ] Session timeout works (tested)
- [ ] No npm vulnerabilities (`npm audit` clean)
- [ ] .env file is not in git repository
- [ ] Backups are configured
- [ ] Monitoring/alerting is set up (optional)
- [ ] CORS is restricted to your domain (recommended)

## 🎯 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Brute force login | Low | Medium | Rate limiting (10/15min) ✅ |
| Session hijacking | Low | High | Device-specific sessions ✅ |
| Container breakout | Very Low | High | Non-root user ✅ |
| SQL injection | Very Low | High | Parameterized queries ✅ |
| XSS attacks | Low | Medium | No innerHTML usage ✅ |
| CSRF attacks | Low | Medium | JWT tokens required ✅ |
| DoS attacks | Medium | Medium | Rate limiting ✅ |
| Data breach | Low | High | Bcrypt passwords + HTTPS ⚠️ |
| Insider threat | Low | High | Activity logging ✅ |
| Dependency vulnerabilities | Medium | Varies | Regular updates ⚠️ |

**Legend**:
- ✅ = Mitigated in code
- ⚠️ = Requires configuration/monitoring

---

**Last Updated**: 2026-01-12
**Version**: 1.0.0

For detailed security documentation, see:
- `SECURITY.md` - Authentication and password security
- `SECURITY_HARDENING.md` - Advanced container hardening
- `README.md` - General security overview
