/**
 * Smoke Tests: Critical Path Validation
 * Quick tests to verify basic functionality and deployment validation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import modules for smoke testing
import { handleRequest } from '../../cloudflare-worker/src/index.js';
import { generateChallenge } from '../../cloudflare-worker/src/lib/auth.js';
import { isCodeImplementationRequest } from '../../cloudflare-worker/src/lib/classifier.js';
import { getSharedContext } from '../../cloudflare-worker/src/lib/context.js';
import { selectProvider } from '../../cloudflare-worker/src/lib/providers.js';

describe('Smoke Tests: Critical Path Validation', () => {
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

  test('should respond to health check', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/health', {
      method: 'GET'
    });

    const response = await handleRequest(request, mockEnv);

    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.status, 'healthy');
    assert.ok(data.timestamp);
    assert.ok(data.version);
  });

  test('should respond to status check', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/status', {
      method: 'GET'
    });

    const response = await handleRequest(request, mockEnv);

    assert.equal(response.status, 200);

    const data = await response.json();
    assert.ok(data.llm_providers);
    assert.ok(data.llm_providers.groq);
    assert.ok(data.llm_providers.gemini);
    assert.ok(data.llm_providers.claude);
    assert.ok(data.llm_providers.qwen);
  });

  test('should generate authentication challenges', async () => {
    const mockEnv = createMockEnv();
    const challenge = await generateChallenge(mockEnv);

    assert.ok(challenge.challenge);
    assert.ok(challenge.timestamp);
    assert.equal(typeof challenge.challenge, 'string');
    assert.equal(typeof challenge.timestamp, 'number');
    assert.ok(challenge.challenge.length > 0);
  });

  test('should classify code vs general requests', async () => {
    // Test code request classification
    const codeRequest = 'Write a Python function to calculate fibonacci numbers';
    const isCode = isCodeImplementationRequest(codeRequest);
    assert.equal(isCode, true);

    // Test general request classification
    const generalRequest = 'What is the weather like today?';
    const isGeneral = isCodeImplementationRequest(generalRequest);
    assert.equal(isGeneral, false);
  });

  test('should manage context storage', async () => {
    const mockEnv = createMockEnv();
    const context = await getSharedContext(mockEnv.CONTEXT, 'test-session');
    assert.deepEqual(context, {});
  });

  test('should select providers', async () => {
    const mockEnv = createMockEnv();
    const providers = [
      { name: 'groq', limit: 30, priority: 1 },
      { name: 'gemini', limit: 15, priority: 2 },
      { name: 'claude', limit: 50, priority: 3 }
    ];

    const selectedProvider = selectProvider(providers, mockEnv.USAGE);
    assert.ok(selectedProvider);
    assert.equal(selectedProvider.name, 'groq');
  });

  test('should handle CORS preflight requests', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/chat', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    const response = await handleRequest(request, mockEnv);

    assert.equal(response.status, 200);

    const headers = response.headers;
    assert.ok(headers.get('Access-Control-Allow-Origin'));
    assert.ok(headers.get('Access-Control-Allow-Methods'));
    assert.ok(headers.get('Access-Control-Allow-Headers'));
  });

  test('should reject unauthenticated chat requests', async () => {
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

    const response = await handleRequest(request, mockEnv);

    assert.equal(response.status, 401);

    const data = await response.json();
    assert.ok(data.error);
    assert.ok(data.error.includes('authentication'));
  });

  test('should handle unknown endpoints gracefully', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/unknown', {
      method: 'GET'
    });

    const response = await handleRequest(request, mockEnv);

    assert.equal(response.status, 404);

    const data = await response.json();
    assert.ok(data.error);
  });

  test('should handle malformed JSON gracefully', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    });

    const response = await handleRequest(request, mockEnv);

    assert.equal(response.status, 400);

    const data = await response.json();
    assert.ok(data.error);
  });

  test('should respond within acceptable time limits', async () => {
    const mockEnv = createMockEnv();
    const startTime = Date.now();

    const request = new Request('https://example.com/health', {
      method: 'GET'
    });

    const response = await handleRequest(request, mockEnv);
    const endTime = Date.now();

    const responseTime = endTime - startTime;

    assert.equal(response.status, 200);
    assert.ok(responseTime < 1000); // Should respond within 1 second
  });

  test('should handle concurrent requests', async () => {
    const mockEnv = createMockEnv();
    const requests = Array.from({ length: 5 }, () =>
      new Request('https://example.com/health', {
        method: 'GET'
      })
    );

    const responses = await Promise.all(
      requests.map(request => handleRequest(request, mockEnv))
    );

    // All should succeed
    responses.forEach(response => {
      assert.equal(response.status, 200);
    });
  });

  test('should maintain session isolation', async () => {
    const mockEnv = createMockEnv();
    const session1 = 'session-1';
    const session2 = 'session-2';

    const context1 = await getSharedContext(mockEnv.CONTEXT, session1);
    const context2 = await getSharedContext(mockEnv.CONTEXT, session2);

    assert.deepEqual(context1, {});
    assert.deepEqual(context2, {});
    assert.notEqual(context1, context2); // Different objects
  });

  test('should handle provider limits correctly', async () => {
    const mockEnv = createMockEnv();
    const providers = [
      { name: 'groq', limit: 1, priority: 1 },
      { name: 'gemini', limit: 15, priority: 2 }
    ];

    // First selection should work
    let selectedProvider = selectProvider(providers, mockEnv.USAGE);
    assert.ok(selectedProvider);
    assert.equal(selectedProvider.name, 'groq');

    // Simulate reaching limit
    await mockEnv.USAGE.put('groq', '1');

    // Second selection should skip groq
    selectedProvider = selectProvider(providers, mockEnv.USAGE);
    assert.ok(selectedProvider);
    assert.equal(selectedProvider.name, 'gemini');
  });

  test('should handle missing environment variables gracefully', async () => {
    const minimalEnv = {
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
      }
      // Missing API keys
    };

    const request = new Request('https://example.com/health', {
      method: 'GET'
    });

    const response = await handleRequest(request, minimalEnv);

    // Health endpoint should still work without API keys
    assert.equal(response.status, 200);
  });

  test('should validate request structure', async () => {
    const mockEnv = createMockEnv();
    const validRequest = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello, world!',
        conversation: []
      })
    });

    const response = await handleRequest(validRequest, mockEnv);

    // Should reject due to authentication, but structure should be valid
    assert.equal(response.status, 401);

    const data = await response.json();
    assert.ok(data.error);
  });

  test('should handle different HTTP methods appropriately', async () => {
    const mockEnv = createMockEnv();
    const baseUrl = 'https://example.com/health';

    // GET should work
    const getRequest = new Request(baseUrl, { method: 'GET' });
    const getResponse = await handleRequest(getRequest, mockEnv);
    assert.equal(getResponse.status, 200);

    // POST should not work for health endpoint
    const postRequest = new Request(baseUrl, { method: 'POST' });
    const postResponse = await handleRequest(postRequest, mockEnv);
    assert.equal(postResponse.status, 405); // Method not allowed
  });

  test('should provide meaningful error messages', async () => {
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

    const response = await handleRequest(request, mockEnv);

    assert.equal(response.status, 401);

    const data = await response.json();
    assert.ok(data.error);
    assert.ok(data.error.length > 0);
    assert.ok(typeof data.error === 'string');
  });

  test('should handle edge cases gracefully', async () => {
    const mockEnv = createMockEnv();
    const edgeCases = [
      // Empty message
      {
        message: '',
        conversation: []
      },

      // Very long message
      {
        message: 'A'.repeat(10000),
        conversation: []
      },

      // Empty conversation
      {
        message: 'Hello',
        conversation: []
      },

      // Large conversation
      {
        message: 'Hello',
        conversation: Array.from({ length: 100 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`
        }))
      }
    ];

    for (const edgeCase of edgeCases) {
      const request = new Request('https://example.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(edgeCase)
      });

      const response = await handleRequest(request, mockEnv);

      // Should handle edge cases gracefully
      assert.ok([200, 400, 401].includes(response.status));
    }
  });
});