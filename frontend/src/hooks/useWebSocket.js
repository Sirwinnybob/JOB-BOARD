import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for WebSocket connection with automatic reconnection
 * @param {function} onMessage - Callback function to handle incoming messages
 * @param {boolean} enabled - Whether the WebSocket connection should be active
 * @returns {object} - WebSocket connection status
 */
function useWebSocket(onMessage, enabled = true) {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  const lastMessageTimeRef = useRef(Date.now());
  const heartbeatIntervalRef = useRef(null);

  // Keep the ref up to date with the latest callback
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      // Determine WebSocket protocol based on current page protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

      if (import.meta.env.DEV) console.log('🔌 Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (import.meta.env.DEV) console.log('✅ WebSocket connected');
        reconnectAttemptsRef.current = 0;
        lastMessageTimeRef.current = Date.now();

        // Start heartbeat monitoring
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
          // If no message received in 90 seconds, connection might be stale
          if (timeSinceLastMessage > 90000 && ws.readyState === WebSocket.OPEN) {
            console.warn('⚠️  No WebSocket activity for 90s, reconnecting...');
            ws.close();
          }
        }, 30000); // Check every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          lastMessageTimeRef.current = Date.now();
          const data = JSON.parse(event.data);
          // Only log important message types to reduce console noise
          if (!['ping', 'pong'].includes(data.type)) {
            if (import.meta.env.DEV) console.log('📨 WebSocket message:', data.type);
          }
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:');
        console.error('  Error:', error);
        console.error('  Ready State:', ws.readyState);
        console.error('  URL:', wsUrl);
        console.error('');
        console.error('🔍 Troubleshooting Tips:');
        if (window.location.protocol === 'https:') {
          console.error('  - Verify WSS (WebSocket Secure) is properly configured in NGINX');
          console.error('  - Check that "Websockets Support" is enabled in Nginx Proxy Manager');
          console.error('  - Ensure "Cache Assets" is DISABLED (it breaks WebSocket connections)');
          console.error('  - Verify SSL certificate is valid for this domain');
        } else {
          console.error('  - Check that backend is running on port 3000');
          console.error('  - Verify no firewall is blocking WebSocket connections');
        }
        console.error('  - See HTTPS_TROUBLESHOOTING.md for detailed debugging steps');
      };

      ws.onclose = (event) => {
        if (import.meta.env.DEV) {
          console.log('🔌 WebSocket disconnected');
          console.log('  Code:', event.code);
          console.log('  Reason:', event.reason || 'No reason provided');
          console.log('  Clean:', event.wasClean);
        }

        // Log common close codes
        if (event.code === 1006) {
          console.warn('⚠️  Close code 1006: Abnormal closure (connection failed)');
          console.warn('     This usually means the WebSocket handshake failed.');
          if (window.location.protocol === 'https:') {
            console.warn('     For HTTPS: Check NGINX WebSocket configuration');
            console.warn('     Run: ./test-https-wss.sh for diagnostics');
          }
        } else if (event.code === 1001) {
          if (import.meta.env.DEV) console.log('ℹ️  Close code 1001: Going away (normal closure)');
        } else if (event.code === 1000) {
          if (import.meta.env.DEV) console.log('ℹ️  Close code 1000: Normal closure');
          // If it's a normal closure from server (duplicate connection), don't reconnect immediately
          if (event.reason === 'New connection from same device') {
            if (import.meta.env.DEV) console.log('     Server replaced this connection with a newer one. Not reconnecting.');
            return; // Don't reconnect
          }
        }

        // Attempt to reconnect with exponential backoff (minimum 2 seconds to avoid loops)
        if (enabled && reconnectAttemptsRef.current < 10) {
          const baseDelay = Math.max(2000, 1000 * Math.pow(2, reconnectAttemptsRef.current));
          const delay = Math.min(baseDelay, 30000);
          if (import.meta.env.DEV) console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/10)`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= 10) {
          console.error('❌ Max reconnection attempts reached (10)');
          console.error('   Please check your network connection and server status');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      console.error('   URL attempted:', `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, enabled]);

  const send = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket not connected, message not sent:', message);
    return false;
  }, []);

  // Handle page visibility changes (PWA backgrounding/foregrounding)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (import.meta.env.DEV) console.log('📱 App became visible, checking WebSocket connection...');

        // Reset reconnection attempts when app comes to foreground
        reconnectAttemptsRef.current = 0;

        // If connection is closed or not connected, reconnect immediately
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          if (import.meta.env.DEV) console.log('🔄 Reconnecting after app became visible...');
          connect();
        } else {
          // Connection appears open, check if it's actually alive
          const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
          if (timeSinceLastMessage > 60000) {
            if (import.meta.env.DEV) console.log('🔄 Connection may be stale, reconnecting...');
            wsRef.current.close();
            connect();
          } else {
            if (import.meta.env.DEV) console.log('✅ WebSocket still connected');
          }
        }
      } else if (document.visibilityState === 'hidden') {
        if (import.meta.env.DEV) console.log('📱 App went to background');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, connect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    send,
  };
}

export default useWebSocket;
