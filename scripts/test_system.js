#!/usr/bin/env node
/**
 * Full system test - ONLY RUN WHEN EXPLICITLY REQUESTED
 * This test uses real API calls and will consume credits
 *
 * Usage: npm run test:system
 *
 * WARNING: This will consume API credits!
 */

const { 
  makeRequest, 
  getChallenge, 
  generateSignature, 
  TestResults,
  validateResponse,
  DEFAULT_CONFIG 
} = require('./test-utils');

const WORKER_URL = DEFAULT_CONFIG.WORKER_URL;

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

async function runSystemTest() {
  const results = new TestResults();
  const startTime = Date.now();
  
  console.log('\n🚀 Starting full system test...\n');
  
  try {
    // Test 1: Health check
    await results.addTest(
      'Health endpoint',
      await testHealthEndpoint()
    );
    
    // Test 2: Challenge endpoint
    await results.addTest(
      'Challenge endpoint',
      await testChallengeEndpoint()
    );
    
    // Test 3: Chat functionality
    await results.addTest(
      'Chat functionality',
      await testChatFunctionality()
    );
    
    // Test 4: Status endpoint
    await results.addTest(
      'Status endpoint',
      await testStatusEndpoint()
    );
    
    // Test 5: Edit functionality (if enabled)
    if (process.env.TEST_EDIT === 'true') {
      await results.addTest(
        'Edit functionality',
        await testEditFunctionality()
      );
    }
    
  } catch (error) {
    console.error('System test error:', error);
    results.addTest('System test', false, error.message);
  }
  
  const duration = Date.now() - startTime;
  console.log(`\n⏱️  Test completed in ${duration}ms`);
  
  const success = results.summary();
  process.exit(success ? 0 : 1);
}

async function testHealthEndpoint() {
  try {
    const response = await makeRequest(`${WORKER_URL}/health`);
    
    if (response.statusCode !== 200) {
      throw new Error(`Unexpected status: ${response.statusCode}`);
    }
    
    const validation = validateResponse(response.body, ['status', 'timestamp', 'version']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    return response.body.status === 'ok';
  } catch (error) {
    throw new Error(`Health check failed: ${error.message}`);
  }
}

async function testChallengeEndpoint() {
  try {
    const challenge = await getChallenge(WORKER_URL);
    
    return challenge && 
           typeof challenge.challenge === 'string' && 
           typeof challenge.timestamp === 'number' &&
           challenge.expires_in === 60;
  } catch (error) {
    throw new Error(`Challenge endpoint failed: ${error.message}`);
  }
}

async function testChatFunctionality() {
  try {
    const challenge = await getChallenge(WORKER_URL);
    const signature = generateSignature(challenge.challenge);
    
    const response = await makeRequest(`${WORKER_URL}/chat`, {
      method: 'POST',
      headers: {
        'X-Challenge': challenge.challenge,
        'X-Signature': signature,
        'X-Timestamp': Date.now().toString()
      }
    }, {
      message: 'Hello, this is a system test',
      conversation: []
    });
    
    if (response.statusCode !== 200) {
      throw new Error(`Chat failed with status: ${response.statusCode}`);
    }
    
    const validation = validateResponse(response.body, ['choices', 'provider']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    return response.body.choices && response.body.choices.length > 0;
  } catch (error) {
    throw new Error(`Chat functionality failed: ${error.message}`);
  }
}

async function testStatusEndpoint() {
  try {
    const response = await makeRequest(`${WORKER_URL}/status`);
    
    if (response.statusCode !== 200) {
      throw new Error(`Status failed with status: ${response.statusCode}`);
    }
    
    const validation = validateResponse(response.body, ['llm_providers']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const providers = response.body.llm_providers;
    return Object.keys(providers).length >= 3; // At least 3 providers
  } catch (error) {
    throw new Error(`Status endpoint failed: ${error.message}`);
  }
}

async function testEditFunctionality() {
  try {
    const challenge = await getChallenge(WORKER_URL);
    const signature = generateSignature(challenge.challenge);
    
    const response = await makeRequest(`${WORKER_URL}/edit`, {
      method: 'POST',
      headers: {
        'X-Challenge': challenge.challenge,
        'X-Signature': signature,
        'X-Timestamp': Date.now().toString()
      }
    }, {
      instruction: 'Add a comment to the health check function',
      options: {
        commitMessage: 'System test: Add comment to health check'
      }
    });
    
    // Edit functionality might be disabled or rate limited
    if (response.statusCode === 429) {
      console.log('⚠️  Edit functionality rate limited, skipping');
      return true;
    }
    
    if (response.statusCode === 403) {
      console.log('⚠️  Edit functionality disabled, skipping');
      return true;
    }
    
    if (response.statusCode === 200) {
      return response.body.success === true;
    }
    
    throw new Error(`Edit failed with status: ${response.statusCode}`);
  } catch (error) {
    throw new Error(`Edit functionality failed: ${error.message}`);
  }
}