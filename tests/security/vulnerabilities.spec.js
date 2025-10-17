/**
 * Security Tests: Vulnerability and Security Testing
 * Tests authentication, input validation, and security vulnerabilities
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import modules for security testing
import { generateChallenge, verifyRequest } from '../../cloudflare-worker/src/lib/auth.js';
import router from '../../cloudflare-worker/src/index.js';

describe('Security Tests: Vulnerability Testing', () => {
  const createMockEnv = () => ({
    AUTH: {
      async get(key) { return null; },
      async put(key, value, options) { return; },
      async delete(key) { return; }
    },
    CONTEXT: {
      async get(key) { return null; },
      async put(key, value) { return; }
    },
    USAGE: {
      async get(key) { return null; },
      async put(key, value) { return; }
    },
    GROQ_API_KEY: 'test-groq-key',
    GEMINI_API_KEY: 'test-gemini-key',
    CLAUDE_API_KEY: 'test-claude-key',
    RUNLOOP_API_KEY: 'test-runloop-key',
    RUNLOOP_DEVOX_ID: 'test-devbox-id'
  });

  test('should prevent authentication bypass attempts', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello, world!',
        conversation: []
      })
    });

    const response = await router.fetch(request, mockEnv);

    // Should reject unauthenticated requests
    assert.equal(response.status, 401);

    const data = await response.json();
    assert.ok(data.error);
    assert.ok(data.error.includes('authentication'));
  });

  test('should prevent challenge replay attacks', async () => {
    const mockEnv = createMockEnv();

    // Generate a challenge
    const challenge = await generateChallenge(mockEnv);

    // Try to use the same challenge multiple times
    const request1 = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Challenge': challenge.challenge,
        'X-Timestamp': challenge.timestamp.toString(),
        'X-Signature': 'test-signature'
      },
      body: JSON.stringify({
        message: 'First request',
        conversation: []
      })
    });

    const response1 = await handleRequest(request1, mockEnv);
    assert.equal(response1.status, 401); // Should fail due to invalid signature

    // Try to use the same challenge again
    const request2 = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Challenge': challenge.challenge,
        'X-Timestamp': challenge.timestamp.toString(),
        'X-Signature': 'test-signature'
      },
      body: JSON.stringify({
        message: 'Second request',
        conversation: []
      })
    });

    const response2 = await handleRequest(request2, mockEnv);
    assert.equal(response2.status, 401); // Should also fail
  });

  test('should prevent timestamp manipulation attacks', async () => {
    const mockEnv = createMockEnv();
    const challenge = await generateChallenge(mockEnv);

    // Try with future timestamp
    const futureRequest = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Challenge': challenge.challenge,
        'X-Timestamp': (Date.now() + 60000).toString(), // 1 minute in future
        'X-Signature': 'test-signature'
      },
      body: JSON.stringify({
        message: 'Future request',
        conversation: []
      })
    });

    const futureResponse = await handleRequest(futureRequest, mockEnv);
    assert.equal(futureResponse.status, 401);

    // Try with very old timestamp
    const oldRequest = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Challenge': challenge.challenge,
        'X-Timestamp': (Date.now() - 60000).toString(), // 1 minute ago
        'X-Signature': 'test-signature'
      },
      body: JSON.stringify({
        message: 'Old request',
        conversation: []
      })
    });

    const oldResponse = await handleRequest(oldRequest, mockEnv);
    assert.equal(oldResponse.status, 401);
  });

  test('should prevent SQL injection attempts', async () => {
    const mockEnv = createMockEnv();
    const maliciousInputs = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --"
    ];

    for (const maliciousInput of maliciousInputs) {
      const request = new Request('https://example.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: maliciousInput,
          conversation: []
        })
      });

      const response = await router.fetch(request, mockEnv);

      // Should reject due to authentication, not process malicious input
      assert.equal(response.status, 401);

      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('authentication'));
    }
  });

  test('should prevent XSS attacks', async () => {
    const mockEnv = createMockEnv();
    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "javascript:alert('XSS')",
      "<img src=x onerror=alert('XSS')>",
      "<svg onload=alert('XSS')>",
      "';alert('XSS');//"
    ];

    for (const xssPayload of xssPayloads) {
      const request = new Request('https://example.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: xssPayload,
          conversation: []
        })
      });

      const response = await router.fetch(request, mockEnv);

      // Should reject due to authentication, not process XSS payload
      assert.equal(response.status, 401);

      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('authentication'));
    }
  });

  test('should prevent command injection attempts', async () => {
    const mockEnv = createMockEnv();
    const commandInjectionPayloads = [
      "; rm -rf /",
      "| cat /etc/passwd",
      "&& whoami",
      "; ls -la",
      "`id`",
      "$(whoami)"
    ];

    for (const payload of commandInjectionPayloads) {
      const request = new Request('https://example.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: payload,
          conversation: []
        })
      });

      const response = await router.fetch(request, mockEnv);

      // Should reject due to authentication, not process command injection
      assert.equal(response.status, 401);

      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('authentication'));
    }
  });

  test('should prevent path traversal attacks', async () => {
    const mockEnv = createMockEnv();
    const pathTraversalPayloads = [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
      "....//....//....//etc/passwd",
      "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"
    ];

    for (const payload of pathTraversalPayloads) {
      const request = new Request('https://example.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: payload,
          conversation: []
        })
      });

      const response = await router.fetch(request, mockEnv);

      // Should reject due to authentication, not process path traversal
      assert.equal(response.status, 401);

      const data = await response.json();
      assert.ok(data.error);
      assert.ok(data.error.includes('authentication'));
    }
  });

  test('should prevent malformed request attacks', async () => {
    const mockEnv = createMockEnv();
    const malformedRequests = [
      // Missing Content-Type
      new Request('https://example.com/chat', {
        method: 'POST',
        body: '{"message": "test"}'
      }),

      // Invalid JSON
      new Request('https://example.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      }),

      // Missing required fields
      new Request('https://example.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      }),

      // Extra large payload
      new Request('https://example.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'A'.repeat(1000000), // 1MB message
          conversation: []
        })
      })
    ];

    for (const request of malformedRequests) {
      const response = await router.fetch(request, mockEnv);

      // Should handle malformed requests gracefully
      assert.ok([200, 400, 401, 413].includes(response.status));
    }
  });

  test('should prevent header injection attacks', async () => {
    const mockEnv = createMockEnv();
    const headerInjectionPayloads = [
      "test\r\nX-Injected: malicious",
      "test\nX-Injected: malicious",
      "test\rX-Injected: malicious",
      "test%0d%0aX-Injected: malicious"
    ];

    for (const payload of headerInjectionPayloads) {
      const request = new Request('https://example.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': payload
        },
        body: JSON.stringify({
          message: 'test',
          conversation: []
        })
      });

      const response = await router.fetch(request, mockEnv);

      // Should reject due to authentication, not process header injection
      assert.equal(response.status, 401);

      const data = await response.json();
      assert.ok(data.error);
    }
  });

  test('should prevent CSRF attacks', async () => {
    const mockEnv = createMockEnv();

    // Test that requests without proper authentication are rejected
    const csrfRequest = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://malicious-site.com',
        'Referer': 'https://malicious-site.com'
      },
      body: JSON.stringify({
        message: 'CSRF attack attempt',
        conversation: []
      })
    });

    const response = await handleRequest(csrfRequest, mockEnv);

    // Should reject due to authentication, not process CSRF
    assert.equal(response.status, 401);

    const data = await response.json();
    assert.ok(data.error);
  });

  test('should prevent information disclosure', async () => {
    const mockEnv = createMockEnv();

    // Test that error messages don't reveal sensitive information
    const request = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'test',
        conversation: []
      })
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 401);

    const data = await response.json();
    assert.ok(data.error);

    // Error message should not contain sensitive information
    assert.ok(!data.error.includes('API_KEY'));
    assert.ok(!data.error.includes('SECRET'));
    assert.ok(!data.error.includes('PASSWORD'));
    assert.ok(!data.error.includes('TOKEN'));
  });

  test('should handle authentication edge cases', async () => {
    const mockEnv = createMockEnv();
    const edgeCases = [
      // Empty challenge
      {
        challenge: '',
        timestamp: Date.now(),
        signature: 'test'
      },

      // Null challenge
      {
        challenge: null,
        timestamp: Date.now(),
        signature: 'test'
      },

      // Undefined challenge
      {
        challenge: undefined,
        timestamp: Date.now(),
        signature: 'test'
      },

      // Invalid timestamp
      {
        challenge: 'test-challenge',
        timestamp: 'invalid',
        signature: 'test'
      },

      // Missing signature
      {
        challenge: 'test-challenge',
        timestamp: Date.now()
      }
    ];

    for (const edgeCase of edgeCases) {
      const request = new Request('https://example.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Challenge': edgeCase.challenge || '',
          'X-Timestamp': edgeCase.timestamp?.toString() || '',
          'X-Signature': edgeCase.signature || ''
        },
        body: JSON.stringify({
          message: 'test',
          conversation: []
        })
      });

      const response = await router.fetch(request, mockEnv);

      // Should reject all edge cases
      assert.equal(response.status, 401);

      const data = await response.json();
      assert.ok(data.error);
    }
  });
});