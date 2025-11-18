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
          requireInteraction: options.requireInteraction || false
        });
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }
}

/**
 * Show notification for new job
 */
export function showNewJobNotification() {
  showNotification('Job Board Update', {
    body: 'NEW JOB',
    tag: 'new-job',
    requireInteraction: false
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
