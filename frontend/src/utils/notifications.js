// Notification utilities for PWA notifications

/**
 * Request notification permission from the user
 * @returns {Promise<string>} Permission status: 'granted', 'denied', or 'default'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

/**
 * Check if notifications are supported and enabled
 * @returns {boolean}
 */
export function areNotificationsEnabled() {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Show a notification using the service worker
 * @param {string} title - Notification title
 * @param {Object} options - Notification options
 * @param {string} options.body - Notification body text
 * @param {string} options.tag - Notification tag (for grouping)
 * @param {boolean} options.requireInteraction - Whether notification requires user interaction
 * @param {number} options.jobId - Job ID to highlight when notification is clicked
 */
export async function showNotification(title, options = {}) {
  if (!areNotificationsEnabled()) {
    console.log('Notifications not enabled, skipping notification:', title);
    return;
  }

  // Get the service worker registration
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;

      // Send message to service worker to show notification
      if (registration.active) {
        registration.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body: options.body || '',
          tag: options.tag || 'job-board-notification',
          requireInteraction: options.requireInteraction || false,
          jobId: options.jobId || null
        });
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }
}

/**
 * Show notification for new job
 * @param {number} jobId - Job ID to highlight when notification is clicked
 */
export function showNewJobNotification(jobId = null) {
  showNotification('Job Board Update', {
    body: 'NEW JOB',
    tag: 'new-job',
    requireInteraction: false,
    jobId
  });
}

/**
 * Show notification for moved jobs
 * @param {number} count - Number of jobs moved (optional)
 */
export function showJobsMovedNotification(count = null) {
  const body = count && count > 1 ? `${count} JOBS MOVED` : 'JOB(S) MOVED';
  showNotification('Job Board Update', {
    body,
    tag: 'jobs-moved',
    requireInteraction: false
  });
}

/**
 * Show custom admin alert notification
 * @param {string} message - The alert message
 */
export function showCustomAlertNotification(message) {
  showNotification('Admin Alert', {
    body: message,
    tag: 'admin-alert',
    requireInteraction: true // Admin alerts require interaction
  });
}

/**
 * Get notification permission status
 * @returns {string} Permission status
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Subscribe to push notifications
 * @returns {Promise<PushSubscription|null>}
 */
export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported in this browser');
    return null;
  }

  try {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Get VAPID public key from server
      const response = await fetch('/api/push/vapid-public-key');
      if (!response.ok) {
        throw new Error('Failed to get VAPID public key');
      }

      const { publicKey } = await response.json();

      // Convert VAPID key from base64 to Uint8Array
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      // Subscribe to push notifications
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      console.log('✅ Subscribed to push notifications');
    }

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ subscription })
    });

    console.log('✅ Push subscription saved to server');
    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 * @returns {Promise<boolean>}
 */
export async function unsubscribeFromPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Unsubscribe from push service
      await subscription.unsubscribe();

      // Remove subscription from server
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      console.log('✅ Unsubscribed from push notifications');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

/**
 * Check if user is subscribed to push notifications
 * @returns {Promise<boolean>}
 */
export async function isPushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Error checking push subscription status:', error);
    return false;
  }
}

/**
 * Convert base64 VAPID key to Uint8Array
 * @param {string} base64String - Base64 encoded VAPID key
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
