const crypto = require('crypto');

console.log('--- Old (Insecure) Methods ---');

function oldGenerateDeviceSessionId() {
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
}

function oldGenerateUniqueName(ext = '.pdf') {
  return `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
}

console.log('Old Device Session IDs:');
for (let i = 0; i < 3; i++) {
  console.log(`  ${oldGenerateDeviceSessionId()}`);
}

console.log('Old Unique Names:');
for (let i = 0; i < 3; i++) {
  console.log(`  ${oldGenerateUniqueName()}`);
}

console.log('\n--- New (Secure) Methods ---');

function newGenerateDeviceSessionId() {
  // Use 16 bytes (32 hex chars) of secure random data
  return `device_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
}

function newGenerateUniqueName(ext = '.pdf') {
  // Use 8 bytes (16 hex chars) of secure random data
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
}

console.log('New Device Session IDs:');
for (let i = 0; i < 3; i++) {
  console.log(`  ${newGenerateDeviceSessionId()}`);
}

console.log('New Unique Names:');
for (let i = 0; i < 3; i++) {
  console.log(`  ${newGenerateUniqueName()}`);
}

console.log('\n--- Security Analysis ---');
console.log('1. Math.random() uses a PRNG that is NOT cryptographically secure.');
console.log('2. Math.random() values are predictable if the internal state is known or can be guessed.');
console.log('3. crypto.randomBytes() uses a cryptographically secure source of entropy.');
console.log('4. Using hex encoding from randomBytes provides a consistent length and better randomness density than base36 conversion of Math.random().');
