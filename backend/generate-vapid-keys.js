#!/usr/bin/env node

/**
 * Generate VAPID keys for Web Push notifications
 * Run this script once to generate keys, then add them to your .env file
 */

const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===\n');
console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@example.com`);
console.log('\nReplace your-email@example.com with your actual email address.');
console.log('This email is used by push services to contact you if needed.\n');
