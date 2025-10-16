#!/usr/bin/env node
/**
 * Complete test of the provider rotation system
 */

const https = require('https');
const crypto = require('crypto');

// Test configuration
const WORKER_URL = 'https://omni-agent-router.jonanscheffler.workers.dev';
const SHARED_SECRET = '4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2';

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

async function testProviderRotation() {
  console.log('🧪 Testing Complete Provider Rotation System\n');

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

    // Test 3: Test general message (should use Gemini)
    console.log('\nTest 3: Testing general message...');
    const signature = generateSignature(challenge.timestamp, challenge.challenge, SHARED_SECRET);
    const generalResponse = await makeRequest('/chat', 'POST', {
      message: 'Hello, how are you today?',
      sessionId: 'test_general'
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

    // Test 4: Test coding message (should use Qwen)
    console.log('\nTest 4: Testing coding message...');
    const codingResponse = await makeRequest('/chat', 'POST', {
      message: 'Write a Python function to calculate factorial',
      sessionId: 'test_coding'
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

    // Test 5: Test function calling
    console.log('\nTest 5: Testing function calling...');
    const functionResponse = await makeRequest('/chat', 'POST', {
      message: 'Please save this information to context: My favorite programming language is Python',
      sessionId: 'test_function_calling'
    }, {
      'X-Timestamp': challenge.timestamp.toString(),
      'X-Challenge': challenge.challenge,
      'X-Signature': signature
    });

    if (functionResponse.status === 200) {
      console.log(`  ✓ Provider: ${functionResponse.data.provider}`);
      console.log(`  ✓ Function Calls: ${JSON.stringify(functionResponse.data.function_calls || [])}`);
      console.log(`  ✓ Response: ${functionResponse.data.response.substring(0, 100)}...`);
    } else {
      console.log(`  ❌ Function calling failed: ${functionResponse.status}`);
      console.log(`  Error: ${JSON.stringify(functionResponse.data)}`);
    }

    console.log('\n✅ Provider rotation testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the tests
testProviderRotation();
