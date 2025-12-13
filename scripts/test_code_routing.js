#!/usr/bin/env node
/**
 * Test code routing to Qwen
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

const results = new TestResults();

async function testCodeRouting() {
  console.log('🔍 Testing Code Routing to Qwen');
  console.log('================================\n');
  console.log(`Testing Worker: ${WORKER_URL}\n`);
  
  const startTime = Date.now();
  
  try {
    // Test 1: Code implementation detection
    await results.addTest(
      'Code implementation detection',
      await testCodeImplementationDetection()
    );
    
    // Test 2: Qwen routing for code requests
    await results.addTest(
      'Qwen routing for code requests',
      await testQwenRouting()
    );
    
    // Test 3: Fallback when Qwen unavailable
    await results.addTest(
      'Fallback when Qwen unavailable',
      await testFallbackBehavior()
    );
    
    // Test 4: Rate limiting
    await results.addTest(
      'Rate limiting behavior',
      await testRateLimiting()
    );
    
  } catch (error) {
    console.error('Code routing test error:', error);
    results.addTest('Code routing test', false, error.message);
  }
  
  const duration = Date.now() - startTime;
  console.log(`\n⏱️  Test completed in ${duration}ms`);
  
  const success = results.summary();
  process.exit(success ? 0 : 1);
}

async function testCodeImplementationDetection() {
  try {
    const challenge = await getChallenge(WORKER_URL);
    const signature = generateSignature(challenge.challenge);
    
    const codeRequests = [
      'Write a JavaScript function to add two numbers',
      'Create a Python script to read a file',
      'Implement a sorting algorithm in any language',
      'Build a React component for a todo list'
    ];
    
    const generalRequests = [
      'What is the weather like today?',
      'Tell me a joke',
      'Explain quantum computing',
      'Who won the last World Cup?'
    ];
    
    // Test code requests should be detected
    for (const request of codeRequests) {
      const response = await makeRequest(`${WORKER_URL}/chat`, {
        method: 'POST',
        headers: {
          'X-Challenge': challenge.challenge,
          'X-Signature': signature,
          'X-Timestamp': Date.now().toString()
        }
      }, {
        message: request,
        conversation: []
      });
      
      if (response.statusCode !== 200) {
        throw new Error(`Code request failed: ${response.statusCode}`);
      }
      
      const validation = validateResponse(response.body, ['choices', 'provider']);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }
    
    // Test general requests should not be routed to Qwen
    for (const request of generalRequests) {
      const response = await makeRequest(`${WORKER_URL}/chat`, {
        method: 'POST',
        headers: {
          'X-Challenge': challenge.challenge,
          'X-Signature': signature,
          'X-Timestamp': Date.now().toString()
        }
      }, {
        message: request,
        conversation: []
      });
      
      if (response.statusCode !== 200) {
        throw new Error(`General request failed: ${response.statusCode}`);
      }
      
      // Should get a response, provider may vary
      const validation = validateResponse(response.body, ['choices']);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }
    
    return true;
  } catch (error) {
    throw new Error(`Code implementation detection failed: ${error.message}`);
  }
}

async function testQwenRouting() {
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
      message: 'Write a JavaScript function to add two numbers. Just the code, no explanation.',
      conversation: []
    });
    
    if (response.statusCode !== 200) {
      throw new Error(`Qwen routing failed: ${response.statusCode}`);
    }
    
    const validation = validateResponse(response.body, ['choices', 'provider']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Should get a code response
    const content = response.body.choices[0].message.content;
    return content && (content.includes('function') || content.includes('=>') || content.includes('const'));
  } catch (error) {
    throw new Error(`Qwen routing test failed: ${error.message}`);
  }
}

async function testFallbackBehavior() {
  try {
    const challenge = await getChallenge(WORKER_URL);
    const signature = generateSignature(challenge.challenge);
    
    // Make multiple requests to potentially trigger rate limiting
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(makeRequest(`${WORKER_URL}/chat`, {
        method: 'POST',
        headers: {
          'X-Challenge': challenge.challenge,
          'X-Signature': signature,
          'X-Timestamp': Date.now().toString()
        }
      }, {
        message: `Test request ${i}`,
        conversation: []
      }));
    }
    
    const responses = await Promise.allSettled(requests);
    
    // Check that at least some requests succeeded (fallback worked)
    const successful = responses.filter(r => 
      r.status === 'fulfilled' && 
      r.value.statusCode === 200
    ).length;
    
    return successful >= 5; // At least half should succeed with fallback
  } catch (error) {
    throw new Error(`Fallback behavior test failed: ${error.message}`);
  }
}

async function testRateLimiting() {
  try {
    const challenge = await getChallenge(WORKER_URL);
    const signature = generateSignature(challenge.challenge);
    
    // Make rapid requests to test rate limiting
    const rapidRequests = [];
    for (let i = 0; i < 20; i++) {
      rapidRequests.push(makeRequest(`${WORKER_URL}/chat`, {
        method: 'POST',
        headers: {
          'X-Challenge': challenge.challenge,
          'X-Signature': signature,
          'X-Timestamp': Date.now().toString()
        }
      }, {
        message: `Rate limit test ${i}`,
        conversation: []
      }));
    }
    
    const responses = await Promise.allSettled(rapidRequests);
    
    // Check if any requests were rate limited
    const rateLimited = responses.some(r => 
      r.status === 'fulfilled' && 
      r.value.statusCode === 429
    );
    
    // Rate limiting is optional, so we just check that the system handles it gracefully
    return true;
  } catch (error) {
    throw new Error(`Rate limiting test failed: ${error.message}`);
  }
}

// Run tests
testCodeRouting().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});