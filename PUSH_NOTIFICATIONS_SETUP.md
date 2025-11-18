# Push Notifications Setup Guide

This job board application supports background push notifications using the Web Push API. This allows users to receive notifications even when the PWA is closed or backgrounded.

## How It Works

1. **Service Worker**: Runs in the background and handles push events
2. **Web Push Protocol**: Uses VAPID (Voluntary Application Server Identification) for secure push delivery
3. **Push Service**: Browser vendors (Google, Mozilla, Apple) relay notifications to devices
4. **Background Delivery**: Notifications work even when the app is completely closed

## Initial Setup

### 1. Generate VAPID Keys

VAPID keys are required for Web Push. Choose one method:

#### **Option A: Browser Tool (Easiest - No Terminal Required)**

1. Open `generate-vapid-keys.html` in your browser (just double-click it)
2. Click "Generate VAPID Keys"
3. Click "Copy to Clipboard"
4. Paste into your `.env` in Dockge

**Perfect for Dockge users who can't terminal into containers!**

#### **Option B: NPX (If you have Node.js locally)**

```bash
npx web-push generate-vapid-keys
```

#### **Option C: Container Script**

```bash
cd backend
npm install
node generate-vapid-keys.js
```

All methods output three values that you need to add to your `.env` file.

### 2. Configure Environment Variables

Add the generated keys to your `backend/.env` file:

```env
# Web Push Configuration
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
```

**Important**:
- Replace `your-email@example.com` with your actual email address
- This email is used by push services to contact you if needed
- Keep the private key secret (add `.env` to `.gitignore`)

### 3. Restart the Backend

After adding the keys, restart your backend server:

```bash
docker-compose restart backend
# or
cd backend && npm start
```

You should see: `✅ Web Push configured with VAPID keys`

## User Flow

### For Admins

1. Admin logs in and enters Edit mode
2. System requests notification permission
3. If granted, automatically subscribes to push notifications
4. Admin receives notifications for:
   - New jobs published (not pending)
   - Jobs moved from pending to active
   - Jobs reordered on board
   - Custom admin alerts

### For Public Users

Public users can also receive notifications:

1. Visit the job board
2. Browser may prompt for notification permission
3. Grant permission to receive updates
4. Receive notifications when jobs are updated

## Notification Types

| Event | Notification | When Sent |
|-------|-------------|-----------|
| **New Job** | "NEW JOB" | Job uploaded with `is_pending=0` or moved from pending to active |
| **Jobs Moved** | "JOB(S) MOVED" | Admin saves board with position changes |
| **Custom Alert** | Admin's message | Admin sends custom notification |

## Database

Push subscriptions are stored in the `push_subscriptions` table:

```sql
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

- Invalid subscriptions are automatically removed (410/404 responses)
- `last_used_at` tracks successful notification delivery

## API Endpoints

### Get VAPID Public Key
```http
GET /api/push/vapid-public-key
```

Returns the public key needed for push subscription.

### Subscribe to Push
```http
POST /api/push/subscribe
Content-Type: application/json

{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

### Unsubscribe from Push
```http
POST /api/push/unsubscribe
Content-Type: application/json

{
  "endpoint": "https://..."
}
```

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome (Desktop) | ✅ Full | Excellent support |
| Chrome (Android) | ✅ Full | Works even when app closed |
| Firefox (Desktop) | ✅ Full | Excellent support |
| Firefox (Android) | ✅ Full | Works even when app closed |
| Safari (macOS) | ✅ Full | macOS 13+ required |
| Safari (iOS) | ✅ Full | iOS 16.4+ required, PWA must be installed |
| Edge | ✅ Full | Chromium-based, same as Chrome |

## Troubleshooting

### "Web Push not configured" Error

```
⚠️  Web Push not configured: Missing VAPID keys in .env
   Run: node generate-vapid-keys.js to generate keys
```

**Solution**: Generate and add VAPID keys to `.env` file (see step 1-2 above)

### Notifications Not Appearing

1. **Check permission**: Open browser dev tools → Application → Notifications
2. **Check subscription**: Call `await navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription())` in console
3. **Check server logs**: Look for "Push notifications: X sent, Y failed"
4. **Check HTTPS**: Push API requires HTTPS (or localhost for development)

### iOS Safari Specifics

- PWA must be installed to home screen
- iOS 16.4 or later required
- User must grant notification permission explicitly
- May not work in Private Browsing mode

### Invalid Subscription Cleanup

The server automatically removes invalid subscriptions:

```
Removing invalid push subscription: https://...
```

This is normal when:
- User uninstalled the PWA
- User cleared browser data
- Subscription expired (rare)

## Testing

### Manual Test

1. Open browser dev tools → Console
2. Subscribe to push:
   ```javascript
   const { subscribeToPushNotifications } = await import('./src/utils/notifications.js');
   await subscribeToPushNotifications();
   ```

3. Trigger a notification:
   - Upload a new job as admin
   - Or send a custom alert

### Check Database

```sql
-- View all subscriptions
SELECT id, substr(endpoint, 1, 50) as endpoint, user_agent, created_at
FROM push_subscriptions;

-- Count active subscriptions
SELECT COUNT(*) FROM push_subscriptions;
```

## Security

- **VAPID Keys**: Keep private key secret
- **HTTPS Required**: Push API only works over HTTPS
- **User Consent**: Permission required before subscribing
- **No Sensitive Data**: Don't send sensitive information in notifications

## Performance

- Push notifications are sent asynchronously (doesn't block WebSocket)
- Invalid subscriptions auto-removed
- ~100-500ms delivery time typical
- Batch processing for multiple subscribers
- No retry mechanism (notifications are ephemeral)

## Cost

Web Push is **completely free**:
- No third-party service required
- Uses browser vendor push services (Google FCM, Mozilla, Apple)
- No message limits or quotas
- Self-hosted backend

## Advanced Configuration

### Customize Notification Behavior

Edit `/backend/server.js` in the `sendPushNotifications()` function:

```javascript
// Add custom logic
if (type === 'pdf_uploaded' || type === 'job_activated') {
  title = 'Job Board Update';
  body = 'NEW JOB';
  tag = 'new-job';
  requireInteraction = false; // Set true to keep until dismissed
}
```

### Add More Notification Types

1. Add type to `pushNotificationTypes` array in `broadcastUpdate()`
2. Add case in `sendPushNotifications()` for notification content
3. Trigger via `broadcastUpdate('your_type', { data })`

## Resources

- [Web Push API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker Cookbook](https://serviceworke.rs/push-payload.html)
- [VAPID Specification](https://tools.ietf.org/html/rfc8292)
- [web-push Library](https://github.com/web-push-libs/web-push)
