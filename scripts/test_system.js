#!/usr/bin/env node
/**
 * Full system test - ONLY RUN WHEN EXPLICITLY REQUESTED
 * This test uses real API calls and will consume credits
 *
 * Usage: npm run test:system
 *
 * WARNING: This will consume API credits!
 */

const https = require('https');
const crypto = require('crypto');

// Configuration
const WORKER_URL = 'https://omni-agent-router.jonanscheffler.workers.dev';
const SHARED_SECRET = process.env.SHARED_SECRET || 'test-secret-for-development-only';

// Check if this is a real system test
const isSystemTest = process.env.SYSTEM_TEST === 'true' || process.argv.includes('--system');

if (!isSystemTest) {
  console.log('🚫 SYSTEM TEST BLOCKED');
  console.log('This test consumes real API credits and should only be run explicitly.');
  console.log('To run this test, use: SYSTEM_TEST=true npm run test:system');
  console.log('Or: npm run test:system -- --system');
  process.exit(1);
}

console.log('⚠️  WARNING: This test will consume real API credits!');
console.log('Starting full system test in 3 seconds...');
console.log('Press Ctrl+C to cancel');

// Wait 3 seconds for user to cancel
setTimeout(() => {
  runSystemTest();
}, 3000);

async function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, WORKER_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function getChallenge() {
  const response = await makeRequest('/challenge');
  if (response.status === 200) {
    return response.data;
  }
  throw new Error(`Failed to get challenge: ${response.status}`);
}

function generateSignature(timestamp, challenge, secret) {
  return crypto.createHmac('sha256', secret).update(timestamp + challenge).digest('hex');
}

async function runSystemTest() {
  console.log('\n🧪 FULL SYSTEM TEST STARTING\n');

  try {
    // Test 1: Get challenge
    console.log('Test 1: Getting challenge...');
    const challenge = await getChallenge();
    console.log(`  ✓ Challenge received: ${challenge.challenge.substring(0, 10)}...`);

    // Test 2: Check usage limits
    console.log('\nTest 2: Checking usage limits...');
    const statusResponse = await makeRequest('/status');
    if (statusResponse.status === 200) {
      console.log(`  ✓ Usage limits: ${JSON.stringify(statusResponse.data)}`);
    } else {
      console.log(`  ❌ Failed to get status: ${statusResponse.status}`);
    }

    // Test 3: Test general message
    console.log('\nTest 3: Testing general message...');
    const signature = generateSignature(challenge.timestamp, challenge.challenge, SHARED_SECRET);
    const generalResponse = await makeRequest('/chat', 'POST', {
      message: 'Hello, how are you today?',
      sessionId: 'system_test_general'
    }, {
      'X-Timestamp': challenge.timestamp.toString(),
      'X-Challenge': challenge.challenge,
      'X-Signature': signature
    });

    if (generalResponse.status === 200) {
      console.log(`  ✓ Provider: ${generalResponse.data.provider}`);
      console.log(`  ✓ Response: ${generalResponse.data.response.substring(0, 100)}...`);
      console.log(`  ✓ Is Code Request: ${generalResponse.data.isCodeRequest}`);
    } else {
      console.log(`  ❌ General message failed: ${generalResponse.status}`);
      console.log(`  Error: ${JSON.stringify(generalResponse.data)}`);
    }

    // Test 4: Test coding message
    console.log('\nTest 4: Testing coding message...');
    const codingResponse = await makeRequest('/chat', 'POST', {
      message: 'Write a Python function to calculate factorial',
      sessionId: 'system_test_coding'
    }, {
      'X-Timestamp': challenge.timestamp.toString(),
      'X-Challenge': challenge.challenge,
      'X-Signature': signature
    });

    if (codingResponse.status === 200) {
      console.log(`  ✓ Provider: ${codingResponse.data.provider}`);
      console.log(`  ✓ Response: ${codingResponse.data.response.substring(0, 100)}...`);
      console.log(`  ✓ Is Code Request: ${codingResponse.data.isCodeRequest}`);
    } else {
      console.log(`  ❌ Coding message failed: ${codingResponse.status}`);
      console.log(`  Error: ${JSON.stringify(codingResponse.data)}`);
    }

    console.log('\n✅ FULL SYSTEM TEST COMPLETED');
    console.log('⚠️  API credits were consumed during this test');

  } catch (error) {
    console.error('❌ System test failed:', error.message);
    process.exit(1);
  }
}
