#!/usr/bin/env node

/**
 * Mobile Connectivity Test Suite for Omnibot
 * Tests all endpoints that the mobile UI needs to connect to
 */

const https = require('https');
const http = require('http');

// Configuration
const WORKER_URL = process.env.WORKER_URL || 'https://omni-agent-router.jonanscheffler.workers.dev';
const SHARED_SECRET = process.env.SHARED_SECRET || '4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2';

console.log('🔍 Omnibot Mobile Connectivity Tests');
console.log('====================================\n');
console.log(`Testing Worker: ${WORKER_URL}\n`);

// Test results tracker
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        
        const req = protocol.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', reject);
        
        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        
        req.end();
    });
}

// Helper to compute HMAC signature
async function computeSignature(challenge, timestamp, message) {
    const crypto = require('crypto');
    const data = `${challenge}|${timestamp}|unknown|test-agent|${JSON.stringify({ message, conversation: [] })}`;
    return crypto.createHmac('sha256', SHARED_SECRET)
        .update(data)
        .digest('hex');
}

// Test function wrapper
async function test(name, fn) {
    process.stdout.write(`Testing: ${name}... `);
    try {
        await fn();
        console.log('✅ PASS');
        results.passed++;
        results.tests.push({ name, status: 'PASS' });
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        results.failed++;
        results.tests.push({ name, status: 'FAIL', error: error.message });
    }
}

// Run all tests
async function runTests() {
    // Test 1: Worker health check
    await test('Worker Health Check (/health)', async () => {
        const response = await makeRequest(`${WORKER_URL}/health`);
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        const body = response.body.toLowerCase();
        if (!body.includes('ok') && !body.includes('healthy')) {
            throw new Error('Health check did not return OK');
        }
    });

    // Test 2: CORS headers (critical for mobile)
    await test('CORS Headers (Mobile Access)', async () => {
        const response = await makeRequest(`${WORKER_URL}/health`, {
            headers: {
                'Origin': 'https://example.com',
                'Access-Control-Request-Method': 'POST'
            }
        });
        
        const corsHeader = response.headers['access-control-allow-origin'];
        if (!corsHeader || corsHeader === 'null') {
            throw new Error('CORS headers missing or invalid');
        }
    });

    // Test 3: Challenge endpoint
    await test('Challenge Endpoint (/challenge)', async () => {
        const response = await makeRequest(`${WORKER_URL}/challenge`);
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        
        const data = JSON.parse(response.body);
        if (!data.challenge || !data.timestamp) {
            throw new Error('Challenge response missing required fields');
        }
        
        if (typeof data.challenge !== 'string' || data.challenge.length < 10) {
            throw new Error('Invalid challenge format');
        }
    });

    // Test 4: Status endpoint
    await test('Status Endpoint (/status)', async () => {
        const response = await makeRequest(`${WORKER_URL}/status`);
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        
        const data = JSON.parse(response.body);
        if (data.groq === undefined || data.gemini === undefined || data.claude === undefined) {
            throw new Error('Status response missing provider data');
        }
    });

    // Test 5: Chat endpoint with authentication
    await test('Chat Endpoint with HMAC Auth (/chat)', async () => {
        // First get a challenge
        const challengeResponse = await makeRequest(`${WORKER_URL}/challenge`);
        const challengeData = JSON.parse(challengeResponse.body);
        
        // Compute signature
        const timestamp = Date.now();
        const message = 'test message';
        const signature = await computeSignature(challengeData.challenge, timestamp, message);
        
        // Try to send a chat message
        const response = await makeRequest(`${WORKER_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Challenge': challengeData.challenge,
                'X-Timestamp': timestamp.toString(),
                'X-Signature': signature
            },
            body: JSON.stringify({
                message: message,
                conversation: []
            })
        });
        
        // Accept both 200 and 429 (rate limited) as valid
        if (response.statusCode !== 200 && response.statusCode !== 429) {
            throw new Error(`Expected 200 or 429, got ${response.statusCode}: ${response.body}`);
        }
    });

    // Test 6: Content-Type headers (mobile compatibility)
    await test('Content-Type Headers (JSON Response)', async () => {
        const response = await makeRequest(`${WORKER_URL}/challenge`);
        const contentType = response.headers['content-type'];
        
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Expected application/json, got ${contentType}`);
        }
    });

    // Test 7: Response time (mobile performance)
    await test('Response Time (<2s for mobile)', async () => {
        const start = Date.now();
        await makeRequest(`${WORKER_URL}/health`);
        const elapsed = Date.now() - start;
        
        if (elapsed > 2000) {
            throw new Error(`Response too slow: ${elapsed}ms`);
        }
    });

    // Test 8: Invalid challenge rejection
    await test('Invalid Challenge Rejection (Security)', async () => {
        const response = await makeRequest(`${WORKER_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Challenge': 'invalid-challenge',
                'X-Timestamp': Date.now().toString(),
                'X-Signature': 'invalid-signature'
            },
            body: JSON.stringify({
                message: 'test',
                conversation: []
            })
        });
        
        if (response.statusCode === 200) {
            throw new Error('Should reject invalid authentication');
        }
    });

    // Test 9: HTTPS (required for mobile Web Speech API)
    await test('HTTPS Connection (Required for Voice)', async () => {
        if (!WORKER_URL.startsWith('https://')) {
            throw new Error('Worker must use HTTPS for mobile voice features');
        }
    });

    // Test 10: Worker availability from mobile networks
    await test('DNS Resolution (Mobile Network Access)', async () => {
        const dns = require('dns').promises;
        const urlObj = new URL(WORKER_URL);
        
        try {
            await dns.resolve4(urlObj.hostname);
        } catch (error) {
            throw new Error(`Cannot resolve ${urlObj.hostname}: ${error.message}`);
        }
    });

    // Print results
    console.log('\n' + '='.repeat(50));
    console.log('Test Results Summary');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total:  ${results.passed + results.failed}`);
    
    if (results.failed > 0) {
        console.log('\nFailed Tests:');
        results.tests
            .filter(t => t.status === 'FAIL')
            .forEach(t => console.log(`  ❌ ${t.name}: ${t.error}`));
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (results.failed === 0) {
        console.log('🎉 All tests passed! Mobile connectivity should work.');
        console.log('\nMobile Checklist:');
        console.log('  ✅ Worker is accessible');
        console.log('  ✅ CORS headers configured');
        console.log('  ✅ HMAC authentication works');
        console.log('  ✅ HTTPS enabled (required for voice)');
        console.log('  ✅ Response times acceptable');
        console.log('\nNext steps:');
        console.log('  1. Deploy updated frontend with new UI');
        console.log('  2. Test on actual mobile device');
        console.log('  3. Check browser console for any errors');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed. Fix issues before mobile testing.');
        console.log('\nCommon Issues:');
        console.log('  - CORS: Add Access-Control-Allow-Origin header to worker');
        console.log('  - HTTPS: Ensure Cloudflare SSL is enabled');
        console.log('  - Auth: Check SHARED_SECRET matches between UI and worker');
        process.exit(1);
    }
}

// Run the tests
runTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
