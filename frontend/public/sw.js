// Service Worker for Kustom Kraft Cabinets Job Board PWA
const CACHE_NAME = 'kk-job-board-v1';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache for offline support
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls (let them fail naturally)
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Serving from cache:', event.request.url);
              return cachedResponse;
            }
            // If not in cache and network failed, return offline page or error
            return new Response('Offline - content not cached', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  const jobId = event.notification.data?.jobId;
  console.log('[SW] Job ID from notification:', jobId);
  event.notification.close();

  // Open or focus the app window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and send message
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          // Send message to the app to highlight the job
          if (jobId) {
            client.postMessage({
              type: 'HIGHLIGHT_JOB',
              jobId: jobId
            });
          }
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        // Store jobId in a way the app can retrieve it when it loads
        if (jobId) {
          // Use sessionStorage via clients.openWindow with URL parameter
          return clients.openWindow(`/?highlightJob=${jobId}`);
        } else {
          return clients.openWindow('/');
        }
      }
    })
  );
});

// Handle push notifications (for future web push implementation)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Job Board Update',
      icon: '/web-app-manifest-192x192.png',
      badge: '/notification-badge.png',
      tag: data.tag || 'job-board-notification',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: { jobId: data.jobId, ...(data.data || {}) }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Job Board', options)
    );
  }
});

// Handle messages from the main app (for WebSocket-triggered notifications)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, requireInteraction, jobId } = event.data;

    const options = {
      body: body || 'Job Board Update',
      icon: '/web-app-manifest-192x192.png',
      badge: '/notification-badge.png',
      tag: tag || 'job-board-notification',
      requireInteraction: requireInteraction || false,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
      data: { jobId } // Store jobId in notification data
    };

    event.waitUntil(
      self.registration.showNotification(title || 'Job Board', options)
    );
  }
});
