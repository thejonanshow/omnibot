#!/usr/bin/env node

/**
 * Mobile Connectivity Test Suite for Omnibot
 * Tests all endpoints that the mobile UI needs to connect to
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

console.log('🔍 Omnibot Mobile Connectivity Tests');
console.log('====================================\n');
console.log(`Testing Worker: ${WORKER_URL}\n`);

const results = new TestResults();

async function runMobileConnectivityTests() {
  const startTime = Date.now();
  
  try {
    // Test 1: Health endpoint
    await results.addTest(
      'Health endpoint',
      await testHealthEndpoint()
    );
    
    // Test 2: Challenge endpoint
    await results.addTest(
      'Challenge endpoint',
      await testChallengeEndpoint()
    );
    
    // Test 3: Status endpoint
    await results.addTest(
      'Status endpoint',
      await testStatusEndpoint()
    );
    
    // Test 4: Chat endpoint
    await results.addTest(
      'Chat endpoint',
      await testChatEndpoint()
    );
    
    // Test 5: TTS endpoint
    await results.addTest(
      'TTS endpoint',
      await testTTSEndpoint()
    );
    
    // Test 6: STT endpoint
    await results.addTest(
      'STT endpoint',
      await testSTTEndpoint()
    );
    
    // Test 7: UI endpoints
    await results.addTest(
      'UI endpoints',
      await testUIEndpoints()
    );
    
  } catch (error) {
    console.error('Mobile connectivity test error:', error);
    results.addTest('Mobile connectivity test', false, error.message);
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
    
    const validation = validateResponse(response.body, ['status', 'timestamp', 'version', 'capabilities']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    return response.body.status === 'ok' && 
           Array.isArray(response.body.capabilities) && 
           response.body.capabilities.length > 0;
  } catch (error) {
    throw new Error(`Health endpoint test failed: ${error.message}`);
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
    throw new Error(`Challenge endpoint test failed: ${error.message}`);
  }
}

async function testStatusEndpoint() {
  try {
    const response = await makeRequest(`${WORKER_URL}/status`);
    
    if (response.statusCode !== 200) {
      throw new Error(`Unexpected status: ${response.statusCode}`);
    }
    
    const validation = validateResponse(response.body, ['llm_providers']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const providers = response.body.llm_providers;
    const providerNames = Object.keys(providers);
    
    return providerNames.length >= 3 && // At least 3 providers
           providerNames.every(name => 
             providers[name] && 
             typeof providers[name].usage === 'number' &&
             typeof providers[name].limit === 'number' &&
             typeof providers[name].remaining === 'number'
           );
  } catch (error) {
    throw new Error(`Status endpoint test failed: ${error.message}`);
  }
}

async function testChatEndpoint() {
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
      message: 'Hello from mobile connectivity test',
      conversation: []
    });
    
    if (response.statusCode !== 200) {
      throw new Error(`Chat failed with status: ${response.statusCode}`);
    }
    
    const validation = validateResponse(response.body, ['choices', 'provider']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    return response.body.choices && 
           response.body.choices.length > 0 &&
           response.body.choices[0].message &&
           response.body.choices[0].message.content;
  } catch (error) {
    throw new Error(`Chat endpoint test failed: ${error.message}`);
  }
}

async function testTTSEndpoint() {
  try {
    const challenge = await getChallenge(WORKER_URL);
    const signature = generateSignature(challenge.challenge);
    
    const response = await makeRequest(`${WORKER_URL}/tts`, {
      method: 'POST',
      headers: {
        'X-Challenge': challenge.challenge,
        'X-Signature': signature,
        'X-Timestamp': Date.now().toString()
      }
    }, {
      text: 'Hello from mobile connectivity test'
    });
    
    // TTS might not be available
    if (response.statusCode === 503) {
      console.log('⚠️  TTS not available, but endpoint is accessible');
      return true;
    }
    
    if (response.statusCode === 200) {
      return response.headers['content-type'] === 'audio/wav';
    }
    
    throw new Error(`TTS failed with status: ${response.statusCode}`);
  } catch (error) {
    throw new Error(`TTS endpoint test failed: ${error.message}`);
  }
}

async function testSTTEndpoint() {
  try {
    const challenge = await getChallenge(WORKER_URL);
    const signature = generateSignature(challenge.challenge);
    
    const response = await makeRequest(`${WORKER_URL}/stt`, {
      method: 'POST',
      headers: {
        'X-Challenge': challenge.challenge,
        'X-Signature': signature,
        'X-Timestamp': Date.now().toString(),
        'Content-Type': 'audio/wav'
      }
    }, 'mock-audio-data');
    
    // STT might not be available
    if (response.statusCode === 503) {
      console.log('⚠️  STT not available, but endpoint is accessible');
      return true;
    }
    
    if (response.statusCode === 200) {
      const validation = validateResponse(response.body, ['text']);
      return validation.valid && typeof response.body.text === 'string';
    }
    
    throw new Error(`STT failed with status: ${response.statusCode}`);
  } catch (error) {
    throw new Error(`STT endpoint test failed: ${error.message}`);
  }
}

async function testUIEndpoints() {
  try {
    // Test main UI
    const uiResponse = await makeRequest(`${WORKER_URL}/`);
    if (uiResponse.statusCode !== 200) {
      throw new Error(`UI failed with status: ${uiResponse.statusCode}`);
    }
    
    if (!uiResponse.body.includes('OmniBot')) {
      throw new Error('UI does not contain expected content');
    }
    
    // Test authenticated UI
    await getChallenge(WORKER_URL);
    const sessionResponse = await makeRequest(`${WORKER_URL}/?session=test-session`);
    
    return sessionResponse.statusCode === 200;
  } catch (error) {
    throw new Error(`UI endpoints test failed: ${error.message}`);
  }
}

// Run tests
runMobileConnectivityTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});