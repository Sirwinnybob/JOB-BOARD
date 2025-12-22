const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');
const assert = require('assert');
const http = require('http');

// Helper to run the server
function runServer() {
  const env = { ...process.env, PORT: '3001', ADMIN_PASSWORD: 'plainpassword' };
  const server = spawn('node', ['backend/server.js'], { env, stdio: 'pipe' });
  return server;
}

// Helper to make a request
function login(password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ username: process.env.ADMIN_USERNAME || 'admin', password });
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting tests...');

  // Test 1: Plain text password fallback
  console.log('Test 1: Plain text password fallback');
  let server = spawn('node', ['backend/server.js'], {
    env: { ...process.env, PORT: '3001', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'plainpassword' },
    // stdio: 'inherit'
  });

  // Wait for server to start
  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await login('plainpassword');
    assert.strictEqual(res.status, 200, 'Plain text login failed');
    console.log('✅ Plain text login worked');
  } catch (e) {
    console.error('❌ Test 1 failed:', e);
    process.exit(1);
  } finally {
    server.kill();
  }

  // Test 2: Hashed password
  console.log('Test 2: Hashed password');
  const hash = bcrypt.hashSync('hashedpassword', 10);
  server = spawn('node', ['backend/server.js'], {
    env: { ...process.env, PORT: '3001', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: hash },
    // stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await login('hashedpassword');
    assert.strictEqual(res.status, 200, 'Hashed password login failed');
    console.log('✅ Hashed password login worked');

    const resFail = await login('wrongpassword');
    assert.strictEqual(resFail.status, 401, 'Wrong password should fail');
    console.log('✅ Wrong password failed');

  } catch (e) {
    console.error('❌ Test 2 failed:', e);
    process.exit(1);
  } finally {
    server.kill();
  }

  console.log('🎉 All tests passed!');
}

runTests();
