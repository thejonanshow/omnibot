/**
 * Shared utilities for test scripts
 * Consolidates common test helper functions
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Default configuration
const DEFAULT_CONFIG = {
  WORKER_URL: process.env.WORKER_URL || 'https://omni-agent-router.jonanscheffler.workers.dev',
  SHARED_SECRET: process.env.SHARED_SECRET || 'test-secret-for-development-only'
};

/**
 * Make HTTP/HTTPS request with consistent interface
 */
function makeRequest(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const req = protocol.request(reqOptions, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          // Try to parse as JSON first
          const parsedBody = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody
          });
        } catch (e) {
          // Return as string if not JSON
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Get authentication challenge from worker
 */
async function getChallenge(workerUrl = DEFAULT_CONFIG.WORKER_URL) {
  const response = await makeRequest(`${workerUrl}/challenge`, {
    method: 'GET'
  });
  
  if (response.statusCode !== 200) {
    throw new Error(`Failed to get challenge: ${response.statusCode}`);
  }
  
  return response.body;
}

/**
 * Generate HMAC signature for request authentication
 */
function generateSignature(challenge, sharedSecret = DEFAULT_CONFIG.SHARED_SECRET) {
  const hmac = crypto.createHmac('sha256', sharedSecret);
  hmac.update(challenge);
  return hmac.digest('hex');
}

/**
 * Test result tracker
 */
class TestResults {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }
  
  addTest(name, passed, error = null) {
    this.tests.push({ name, passed, error });
    if (passed) {
      this.passed++;
      console.log(`✅ ${name}`);
    } else {
      this.failed++;
      console.log(`❌ ${name}: ${error || 'Failed'}`);
    }
  }
  
  summary() {
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Total: ${this.tests.length}`);
    return this.failed === 0;
  }
}

/**
 * Wait for a condition to be met
 */
async function waitFor(condition, timeoutMs = 10000, checkIntervalMs = 1000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await condition();
      if (result) {
        return result;
      }
    } catch (error) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
  }
  
  throw new Error('Timeout waiting for condition');
}

/**
 * Retry a function with exponential backoff
 */
async function retry(fn, maxAttempts = 3, baseDelayMs = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
}

/**
 * Validate response structure
 */
function validateResponse(response, expectedFields = []) {
  if (!response || typeof response !== 'object') {
    return { valid: false, error: 'Response is not an object' };
  }
  
  for (const field of expectedFields) {
    if (!(field in response)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  
  return { valid: true };
}

/**
 * Generate random string
 */
function generateRandomString(length = 8) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

module.exports = {
  makeRequest,
  getChallenge,
  generateSignature,
  TestResults,
  waitFor,
  retry,
  validateResponse,
  generateRandomString,
  formatDuration,
  DEFAULT_CONFIG
};