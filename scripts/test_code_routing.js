#!/usr/bin/env node
/**
 * Test code routing to Qwen
 */

const https = require('https');
const crypto = require('crypto');

const WORKER_URL = 'https://omni-agent-router.jonanscheffler.workers.dev';
const SHARED_SECRET = process.env.SHARED_SECRET || 'test-secret-for-development-only';

async function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function getChallenge() {
  const response = await makeRequest(`${WORKER_URL}/challenge`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Challenge failed: ${response.statusCode}`);
  }

  return response.body;
}

function generateSignature(timestamp, challenge, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}${challenge}`)
    .digest('hex');
}

async function testCodeRouting() {
  console.log('🧪 TESTING CODE ROUTING TO QWEN');
  console.log('================================');

  try {
    // Get challenge
    console.log('1. Getting challenge...');
    const challengeData = await getChallenge();
    const { challenge, timestamp } = challengeData;
    console.log('✅ Challenge received');

    // Generate signature
    const signature = generateSignature(timestamp, challenge, SHARED_SECRET);

    // Test code request
    console.log('2. Testing code implementation request...');
    const codeRequest = {
      message: 'Write a Python function to calculate the factorial of a number',
      sessionId: 'test_code_routing'
    };

    const response = await makeRequest(`${WORKER_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp.toString(),
        'X-Challenge': challenge,
        'X-Signature': signature
      }
    }, codeRequest);

    console.log(`Status: ${response.statusCode}`);
    console.log(`Provider: ${response.body.provider}`);
    console.log(`Is Code Request: ${response.body.isCodeRequest}`);

    if (response.body.error) {
      console.log('❌ Error response:');
      console.log(response.body.response);
      console.log('Attempted providers:', response.body.attemptedProviders);
    } else {
      console.log('✅ Success response:');
      console.log('Response preview:', response.body.response.substring(0, 200) + '...');
    }

    // Test non-code request
    console.log('\n3. Testing non-code request...');
    const nonCodeRequest = {
      message: 'What is the capital of France?',
      sessionId: 'test_non_code'
    };

    const challengeData2 = await getChallenge();
    const signature2 = generateSignature(challengeData2.timestamp, challengeData2.challenge, SHARED_SECRET);

    const response2 = await makeRequest(`${WORKER_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': challengeData2.timestamp.toString(),
        'X-Challenge': challengeData2.challenge,
        'X-Signature': signature2
      }
    }, nonCodeRequest);

    console.log(`Status: ${response2.statusCode}`);
    console.log(`Provider: ${response2.body.provider}`);
    console.log(`Is Code Request: ${response2.body.isCodeRequest}`);

    if (response2.body.error) {
      console.log('❌ Error response:');
      console.log(response2.body.response);
    } else {
      console.log('✅ Success response:');
      console.log('Response preview:', response2.body.response.substring(0, 200) + '...');
    }

    console.log('\n🎯 TEST SUMMARY:');
    console.log('================');
    console.log(`Code request provider: ${response.body.provider}`);
    console.log(`Non-code request provider: ${response2.body.provider}`);
    console.log(`Code routing working: ${response.body.isCodeRequest === true}`);

    if (response.body.provider === 'qwen' && response.body.isCodeRequest) {
      console.log('✅ Code routing to Qwen is working correctly!');
    } else {
      console.log('⚠️  Code routing may not be working as expected');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testCodeRouting();
