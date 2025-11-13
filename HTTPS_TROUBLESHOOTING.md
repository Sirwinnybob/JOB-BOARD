# HTTPS/WebSocket Troubleshooting Guide

## Problem: HTTPS Not Working (HTTP Works Fine)

If your application works over HTTP but fails over HTTPS, the issue is almost always related to **WebSocket (WSS) connections** failing through your NGINX reverse proxy.

## Root Cause

Your Job Board application uses WebSockets for real-time updates. When accessed over HTTPS, the WebSocket connection automatically upgrades to WSS (WebSocket Secure). The issue typically occurs when:

1. **Cache Assets is enabled** in Nginx Proxy Manager (breaks WebSocket upgrade)
2. **WebSocket Support is disabled** in the proxy configuration
3. **Improper proxy headers** prevent WebSocket handshake
4. **SSL/TLS certificate issues** cause connection failures

## Quick Fix: Nginx Proxy Manager Configuration

### Step 1: Edit Your Proxy Host

In Nginx Proxy Manager:

1. Go to **Proxy Hosts**
2. Edit your `jobboard.kustomkraftcabinets.ddns.net` proxy host
3. Click on the **Advanced** tab

### Step 2: Verify/Add Custom Nginx Configuration

**IMPORTANT**: If you have "Cache Assets" enabled, it may be interfering with WebSocket connections. You need to exclude WebSocket paths from caching.

Add this to your **Custom Nginx Configuration**:

```nginx
# WebSocket support
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_set_header Host $host;
proxy_cache_bypass $http_upgrade;

# Proxy headers for HTTPS
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;

# Timeouts for WebSocket connections
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;

# Disable buffering for WebSocket
proxy_buffering off;

# File upload size
client_max_body_size 50M;

# IMPORTANT: Disable caching for WebSocket and API calls
location ~* ^/(api|socket) {
    proxy_cache off;
    proxy_pass http://job-board-app:3000;
}
```

### Step 3: Add HTTP Connection Upgrade Mapping

You also need to add this to the **top-level nginx configuration** (if not already present). In Nginx Proxy Manager, this might be in `/data/nginx/custom/http_top.conf`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

**Note**: In Nginx Proxy Manager, you may need to add this via SSH/terminal access to the NPM container.

### Step 4: Recommended Settings

In the Nginx Proxy Manager UI, ensure these settings are enabled:

**Details Tab**:
- Scheme: `http`
- Forward Hostname/IP: `job-board-app` (or `localhost` if not using Docker)
- Forward Port: `3000`

**SSL Tab**:
- ✅ SSL Certificate (Let's Encrypt)
- ✅ Force SSL
- ✅ HTTP/2 Support
- ✅ HSTS Enabled
- ✅ HSTS Subdomains (optional)

**Advanced Tab**:
- ✅ Websockets Support
- ✅ Block Common Exploits
- ❌ Cache Assets (**DISABLE THIS** - it breaks WebSocket connections)

## Alternative: Manual NGINX Configuration

If you're using standalone NGINX (not Nginx Proxy Manager), use this configuration:

### `/etc/nginx/nginx.conf` (http block)

Add this mapping at the top level:

```nginx
http {
    # WebSocket upgrade mapping
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    # ... rest of your config
}
```

### `/etc/nginx/sites-available/jobboard.conf`

```nginx
server {
    listen 80;
    server_name jobboard.kustomkraftcabinets.ddns.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name jobboard.kustomkraftcabinets.ddns.net;

    ssl_certificate /etc/letsencrypt/live/jobboard.kustomkraftcabinets.ddns.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jobboard.kustomkraftcabinets.ddns.net/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS (optional but recommended)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;

        # HTTP version for WebSocket
        proxy_http_version 1.1;

        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # WebSocket timeouts (24 hours)
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;

        # Disable buffering
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/jobboard.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Diagnostic Steps

### 1. Run the Diagnostic Script

```bash
chmod +x test-https-wss.sh
./test-https-wss.sh
```

This will test:
- HTTP to HTTPS redirect
- HTTPS API connectivity
- SSL certificate validity
- WebSocket upgrade support
- Proxy headers
- Cache headers

### 2. Check Browser Console

Open your browser's Developer Tools (F12) and check the Console tab. Look for:

**Success**:
```
Connecting to WebSocket: wss://jobboard.kustomkraftcabinets.ddns.net
WebSocket connected
```

**Failure**:
```
WebSocket error: ...
WebSocket connection to 'wss://...' failed: Error during WebSocket handshake: ...
```

### 3. Check Network Tab

In Developer Tools > Network tab:
1. Filter by "WS" (WebSocket)
2. Refresh the page
3. Look for the WebSocket connection
4. Check if it shows "101 Switching Protocols" (success) or an error

### 4. Check Backend Logs

```bash
docker logs job-board-app
```

Look for:
```
WebSocket server ready
New WebSocket client connected. Total clients: 1
```

If you don't see "New WebSocket client connected", the WSS connection is not reaching your backend.

### 5. Test from Command Line

Test WebSocket upgrade:

```bash
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://jobboard.kustomkraftcabinets.ddns.net/
```

You should see:
```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

If you see `HTTP/1.1 200 OK` or `400 Bad Request`, WebSocket upgrade is failing.

## Common Issues and Solutions

### Issue 1: "Mixed Content" Error

**Symptom**: Browser blocks WSS connection saying "Mixed Content"

**Cause**: Page is served over HTTPS but trying to connect to WS (not WSS)

**Solution**: Check frontend code at `frontend/src/hooks/useWebSocket.js:19-20` - it should automatically detect HTTPS and use WSS. If it's hardcoded to `ws://`, change it to use the automatic detection.

### Issue 2: WebSocket Closes Immediately

**Symptom**: WebSocket connects but closes within seconds

**Cause**: Proxy timeout or missing heartbeat

**Solution**:
1. Increase `proxy_read_timeout` to 86400s (24 hours) in NGINX
2. Backend already has heartbeat every 30 seconds (see `server.js:50-61`)

### Issue 3: 502 Bad Gateway

**Symptom**: HTTPS returns 502 error

**Cause**:
- Backend container is not running
- NGINX cannot reach backend
- Wrong backend hostname/port in proxy config

**Solution**:
```bash
# Check if container is running
docker ps | grep job-board

# Check container logs
docker logs job-board-app

# Verify backend is responding
curl http://localhost:3000/api/health
```

### Issue 4: SSL Certificate Error

**Symptom**: Browser shows "Your connection is not private" or certificate error

**Cause**:
- Certificate expired
- Wrong domain in certificate
- Certificate files not found

**Solution**:
```bash
# Check certificate
sudo certbot certificates

# Renew if needed
sudo certbot renew

# Test certificate
openssl s_client -servername jobboard.kustomkraftcabinets.ddns.net \
  -connect jobboard.kustomkraftcabinets.ddns.net:443 </dev/null
```

### Issue 5: Works Initially, Then Stops

**Symptom**: HTTPS works after restart, but fails after some time

**Cause**:
- Certificate auto-renewal failed
- NGINX cache filling up
- Docker container restarted and port mapping changed

**Solution**:
```bash
# Check NGINX error logs
sudo tail -f /var/log/nginx/error.log

# Check NGINX Proxy Manager logs
docker logs -f nginx-proxy-manager

# Restart NGINX
sudo systemctl restart nginx
```

## Testing After Fix

After applying the fix:

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** (Ctrl+Shift+R)
3. **Open browser console** (F12)
4. **Navigate to** `https://jobboard.kustomkraftcabinets.ddns.net`
5. **Check console** for "WebSocket connected"
6. **Test real-time updates**:
   - Open the site on two devices
   - Login to admin on one device
   - Upload a PDF
   - Verify it appears immediately on the other device

## Summary of Required Changes

**For Nginx Proxy Manager Users**:
1. ✅ Enable "Websockets Support"
2. ❌ **Disable "Cache Assets"** (this is the main culprit)
3. ✅ Enable "Force SSL"
4. ✅ Enable "HTTP/2 Support"
5. ✅ Add custom NGINX config for WebSocket headers (if needed)

**For Manual NGINX Users**:
1. Add `map $http_upgrade $connection_upgrade` to http block
2. Add WebSocket headers to location block
3. Set long timeouts for WebSocket connections
4. Disable proxy buffering

## Need More Help?

If you're still experiencing issues:

1. Run the diagnostic script and share the output
2. Check browser console and share any errors
3. Check `docker logs job-board-app` for backend errors
4. Share your NGINX configuration (remove sensitive data)
5. Test with the curl commands above and share results

The issue is almost certainly in the NGINX reverse proxy configuration, specifically related to WebSocket upgrade handling or caching interfering with WebSocket connections.
