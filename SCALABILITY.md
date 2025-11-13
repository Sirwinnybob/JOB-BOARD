# Scalability Documentation

## Concurrent Connection Support

This application is optimized to handle **20+ concurrent device connections** viewing and interacting with the job board simultaneously.

## Optimizations Implemented

### 1. WebSocket Optimizations
- **Connection Health Monitoring**: Automatic ping/pong heartbeat every 30 seconds to detect and terminate inactive connections
- **Efficient Broadcasting**: Optimized message broadcasting to all connected clients with error handling
- **Performance Tuning**: Disabled per-message compression (`perMessageDeflate: false`) for better performance with many clients
- **Connection Tracking**: Real-time logging of connected client count for monitoring

### 2. Rate Limiting
- **Increased Limits**: Rate limit increased from 100 to 500 requests per 15 minutes per IP
- **Multi-Device Support**: Accommodates 20+ devices on the same network/IP address
- **Standard Headers**: Modern rate limit headers for better client compatibility

### 3. Database Optimizations (SQLite)
- **WAL Mode**: Write-Ahead Logging enabled for concurrent reads without blocking
- **Busy Timeout**: 10-second timeout to handle temporary locks gracefully
- **Cache Size**: Increased to 10,000 pages for better read performance
- **Memory Temp Storage**: Temporary tables stored in memory for faster operations
- **Query Indexes**: Created indexes on frequently queried columns:
  - `pdfs.position` - For ordered retrieval
  - `pdf_labels.pdf_id` - For label lookups
  - `pdf_labels.label_id` - For reverse label lookups

## Performance Characteristics

### Expected Performance with 20+ Devices
- **Real-time Updates**: Sub-second broadcast to all connected clients
- **Database Reads**: Concurrent reads without blocking
- **API Response Time**: < 100ms for typical queries
- **WebSocket Latency**: < 50ms for broadcast messages

### Scalability Limits
- **Tested Configuration**: Optimized for 20-50 concurrent connections
- **Maximum Connections**: Can theoretically handle 100+ connections
- **Bottleneck**: SQLite write operations (single writer at a time)
- **Recommendation**: For 100+ concurrent users, consider migrating to PostgreSQL

## Monitoring

### Check Connected Clients
Monitor server logs for:
```
New WebSocket client connected. Total clients: X
WebSocket client disconnected. Total clients: X
```

### Broadcast Statistics
Each broadcast logs success/failure counts:
```
Broadcast: pdfs_reordered (sent to 25 clients, 0 failed)
```

### Database Performance
WAL mode status can be checked with:
```sql
PRAGMA journal_mode;
-- Should return: wal
```

## Best Practices

### For Administrators
1. Monitor server logs for connection counts
2. Restart server if WebSocket connections grow unexpectedly
3. Check database file size periodically (`backend/data/database.sqlite`)
4. WAL files (`database.sqlite-wal`, `database.sqlite-shm`) are normal and handled automatically

### For Developers
1. Keep broadcast messages small and efficient
2. Avoid heavy database queries in API endpoints
3. Use indexes for any new query patterns
4. Test with realistic connection counts before deployment

## Troubleshooting

### Issue: "Too Many Connections" Error
- **Cause**: Rate limit reached for IP address
- **Solution**: Increase `max` value in rate limiter configuration

### Issue: Slow Database Queries
- **Cause**: Database lock contention
- **Solution**: Verify WAL mode is enabled, check `busyTimeout` setting

### Issue: WebSocket Disconnections
- **Cause**: Network issues or inactive connections
- **Solution**: Heartbeat automatically cleans up inactive connections

### Issue: Broadcast Failures
- **Check**: Server logs for specific error messages
- **Monitor**: Failed client counts in broadcast logs

## Future Improvements

For scaling beyond 50+ concurrent connections, consider:
1. **Database**: Migrate to PostgreSQL for better concurrent write handling
2. **Caching**: Implement Redis for frequently accessed data
3. **Load Balancing**: Add multiple server instances behind a load balancer
4. **CDN**: Serve static assets (thumbnails) via CDN
5. **WebSocket Clustering**: Use Redis pub/sub for multi-server WebSocket support
