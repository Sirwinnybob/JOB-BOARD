#!/bin/bash

# Docker Network Diagnostic Script for NGINX Reverse Proxy Issues
# This script helps diagnose network connectivity between NGINX and the job-board container

echo "=========================================="
echo "Docker Network Diagnostics"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if job-board container is running
echo "Test 1: Container Status"
echo "-------------------------"
if docker ps | grep -q job-board-app; then
    echo -e "${GREEN}✓ job-board-app container is running${NC}"
    CONTAINER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' job-board-app 2>/dev/null)
    echo "  Container IP: $CONTAINER_IP"
else
    echo -e "${RED}✗ job-board-app container is NOT running${NC}"
    echo "  Run: docker-compose up -d"
    exit 1
fi
echo ""

# Test 2: Check container networks
echo "Test 2: Container Networks"
echo "--------------------------"
echo "job-board-app networks:"
docker inspect job-board-app --format='{{range $net,$v := .NetworkSettings.Networks}}  - {{$net}} ({{$v.IPAddress}}){{println}}{{end}}'
echo ""

# Test 3: Check if NGINX Proxy Manager is running
echo "Test 3: Nginx Proxy Manager Status"
echo "-----------------------------------"
NPM_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i 'nginx-proxy-manager\|npm' | head -1)
if [ -n "$NPM_CONTAINER" ]; then
    echo -e "${GREEN}✓ Found NPM container: $NPM_CONTAINER${NC}"
    echo "NPM networks:"
    docker inspect $NPM_CONTAINER --format='{{range $net,$v := .NetworkSettings.Networks}}  - {{$net}} ({{$v.IPAddress}}){{println}}{{end}}'
else
    echo -e "${YELLOW}! Could not find Nginx Proxy Manager container${NC}"
    echo "  If you're using standalone NGINX, skip this test"
fi
echo ""

# Test 4: Check network connectivity from NPM to job-board
echo "Test 4: Network Connectivity Test"
echo "----------------------------------"
if [ -n "$NPM_CONTAINER" ]; then
    echo "Testing if NPM can reach job-board-app..."

    # Test by container name
    if docker exec $NPM_CONTAINER sh -c "wget -q -O- --timeout=5 http://job-board-app:3000/api/health" 2>/dev/null | grep -q "ok"; then
        echo -e "${GREEN}✓ NPM can reach job-board-app by container name${NC}"
    else
        echo -e "${RED}✗ NPM CANNOT reach job-board-app by container name${NC}"
        echo -e "${YELLOW}  This is the problem! NPM and job-board-app are on different networks${NC}"

        # Test by IP address
        if docker exec $NPM_CONTAINER sh -c "wget -q -O- --timeout=5 http://$CONTAINER_IP:3000/api/health" 2>/dev/null | grep -q "ok"; then
            echo -e "${GREEN}✓ NPM can reach job-board-app by IP ($CONTAINER_IP)${NC}"
            echo -e "${YELLOW}  SOLUTION: Update NPM proxy host to use IP instead of container name${NC}"
        else
            echo -e "${RED}✗ NPM cannot reach job-board-app even by IP${NC}"
            echo -e "${YELLOW}  SOLUTION: Add both containers to the same Docker network${NC}"
        fi
    fi
else
    echo "Skipping (no NPM container found)"
fi
echo ""

# Test 5: List all Docker networks
echo "Test 5: Available Docker Networks"
echo "----------------------------------"
docker network ls
echo ""

# Test 6: Test backend directly
echo "Test 6: Backend Health Check (Direct)"
echo "--------------------------------------"
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
    echo -e "${GREEN}✓ Backend is responding on localhost:3000${NC}"
else
    echo -e "${RED}✗ Backend is NOT responding on localhost:3000${NC}"
    echo "  Check if port 3000 is exposed and not blocked"
fi
echo ""

# Test 7: WebSocket test from NPM
echo "Test 7: WebSocket Upgrade Test"
echo "-------------------------------"
if [ -n "$NPM_CONTAINER" ]; then
    echo "Testing WebSocket upgrade from NPM container..."
    WS_TEST=$(docker exec $NPM_CONTAINER sh -c "wget -q -O- --header='Connection: Upgrade' --header='Upgrade: websocket' http://job-board-app:3000/ 2>&1" || echo "failed")
    if echo "$WS_TEST" | grep -q "failed"; then
        echo -e "${RED}✗ WebSocket upgrade failed${NC}"
        echo -e "${YELLOW}  This confirms the network connectivity issue${NC}"
    else
        echo -e "${GREEN}✓ WebSocket upgrade successful${NC}"
    fi
else
    echo "Skipping (no NPM container found)"
fi
echo ""

# Summary and Recommendations
echo "=========================================="
echo "Summary & Recommendations"
echo "=========================================="
echo ""

# Get common networks
if [ -n "$NPM_CONTAINER" ]; then
    JOB_NETWORKS=$(docker inspect job-board-app --format='{{range $net,$v := .NetworkSettings.Networks}}{{$net}} {{end}}')
    NPM_NETWORKS=$(docker inspect $NPM_CONTAINER --format='{{range $net,$v := .NetworkSettings.Networks}}{{$net}} {{end}}')

    COMMON_NETWORKS=$(comm -12 <(echo "$JOB_NETWORKS" | tr ' ' '\n' | sort) <(echo "$NPM_NETWORKS" | tr ' ' '\n' | sort))

    if [ -z "$COMMON_NETWORKS" ]; then
        echo -e "${RED}PROBLEM FOUND: No common networks between NPM and job-board-app${NC}"
        echo ""
        echo "SOLUTION OPTIONS:"
        echo ""
        echo "Option 1: Add job-board-app to NPM's network"
        echo "  1. Find NPM's network: docker inspect $NPM_CONTAINER | grep NetworkMode"
        echo "  2. Edit docker-compose.yml:"
        echo "     networks:"
        echo "       job-board-network:"
        echo "         external: true"
        echo "         name: <npm_network_name>"
        echo "  3. Run: docker-compose down && docker-compose up -d"
        echo ""
        echo "Option 2: Change NPM proxy host to use IP address"
        echo "  - In NPM UI, change Forward Hostname/IP to: $CONTAINER_IP"
        echo "  - Keep port as: 3000"
        echo ""
        echo "Option 3: Use host networking (least secure)"
        echo "  - In NPM UI, change Forward Hostname/IP to: host.docker.internal"
        echo "  - Keep port as: 3000"
    else
        echo -e "${GREEN}✓ Containers share common network(s): $COMMON_NETWORKS${NC}"
        echo ""
        echo "Network connectivity looks good. Check NGINX configuration:"
        echo "  1. Verify 'Websockets Support' is enabled in NPM"
        echo "  2. Verify 'Cache Assets' is DISABLED"
        echo "  3. Add custom NGINX config (see HTTPS_TROUBLESHOOTING.md)"
    fi
fi

echo ""
echo "For detailed NGINX configuration, see: HTTPS_TROUBLESHOOTING.md"
echo ""
