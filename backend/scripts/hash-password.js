#!/usr/bin/env node

/**
 * Password Hashing Utility
 *
 * This script generates a bcrypt hash for a given password.
 * Use this to hash your admin password before storing it in the .env file.
 *
 * Usage:
 *   node backend/scripts/hash-password.js <password>
 *
 * Example:
 *   node backend/scripts/hash-password.js mySecurePassword123
 *
 * The script will output a bcrypt hash that you can copy to your .env file:
 *   ADMIN_PASSWORD=$2b$10$abc123...xyz789
 */

const bcrypt = require('bcryptjs');

// Get password from command line argument
const password = process.argv[2];

if (!password) {
  console.error('❌ Error: No password provided\n');
  console.log('Usage: node backend/scripts/hash-password.js <password>\n');
  console.log('Example:');
  console.log('  node backend/scripts/hash-password.js mySecurePassword123\n');
  process.exit(1);
}

// Validate password strength
if (password.length < 8) {
  console.warn('⚠️  Warning: Password is less than 8 characters. Consider using a stronger password.\n');
}

// Generate hash with salt rounds = 10 (good balance of security and performance)
const saltRounds = 10;

console.log('🔐 Generating bcrypt hash...\n');

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('❌ Error generating hash:', err);
    process.exit(1);
  }

  console.log('✅ Password hashed successfully!\n');
  console.log('Copy the following hash to your .env file:\n');
  console.log(`ADMIN_PASSWORD=${hash}\n`);
  console.log('─'.repeat(60));
  console.log('Security Notes:');
  console.log('  • Keep this hash secure - treat it like a password');
  console.log('  • Never commit your .env file to version control');
  console.log('  • The hash uses bcrypt with 10 salt rounds');
  console.log('  • This hash cannot be reversed to get the original password');
  console.log('─'.repeat(60));
});
