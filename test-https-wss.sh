#!/bin/bash

# HTTPS/WSS Connection Diagnostic Script
# This script tests your NGINX configuration for WebSocket support over HTTPS

echo "=================================="
echo "HTTPS/WSS Connection Diagnostics"
echo "=================================="
echo ""

DOMAIN="jobboard.kustomkraftcabinets.ddns.net"

# Test 1: Check if HTTP redirects to HTTPS
echo "Test 1: HTTP to HTTPS redirect"
echo "------------------------------"
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -L "http://$DOMAIN")
echo "HTTP response code: $HTTP_RESPONSE"
if [ "$HTTP_RESPONSE" -eq 200 ]; then
    echo "✓ HTTP redirects properly"
else
    echo "✗ HTTP redirect issue detected"
fi
echo ""

# Test 2: Check HTTPS connection
echo "Test 2: HTTPS connection"
echo "------------------------"
HTTPS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/health")
echo "HTTPS API response code: $HTTPS_RESPONSE"
if [ "$HTTPS_RESPONSE" -eq 200 ]; then
    echo "✓ HTTPS API works"
else
    echo "✗ HTTPS API issue detected"
fi
echo ""

# Test 3: Check SSL certificate
echo "Test 3: SSL Certificate"
echo "----------------------"
echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | grep -A 2 "Certificate chain"
echo ""

# Test 4: Check WebSocket upgrade headers
echo "Test 4: WebSocket Upgrade Support"
echo "---------------------------------"
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     "https://$DOMAIN/" 2>&1 | grep -i "upgrade\|connection" | head -5
echo ""

# Test 5: Check NGINX headers
echo "Test 5: Proxy Headers"
echo "--------------------"
curl -s -I "https://$DOMAIN/api/health" | grep -i "x-forwarded\|connection\|upgrade"
echo ""

# Test 6: Check if caching is interfering
echo "Test 6: Cache Headers"
echo "--------------------"
curl -s -I "https://$DOMAIN/" | grep -i "cache"
echo ""

echo "=================================="
echo "Diagnostic Complete"
echo "=================================="
echo ""
echo "If WebSocket upgrade fails, check:"
echo "1. Nginx Proxy Manager: Disable 'Cache Assets'"
echo "2. Ensure 'Websockets Support' is enabled"
echo "3. Check browser console for WSS connection errors"
echo ""
