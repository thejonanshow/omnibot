/**
 * API Tests: Dedicated API Endpoint Testing
 * Tests API endpoints, requests, responses, and error handling
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import the main router for API testing
import router from '../../cloudflare-worker/src/index.js';

describe('API Tests: Endpoint Testing', () => {
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

  test('should handle GET /health endpoint', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/health', {
      method: 'GET'
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.status, 'healthy');
    assert.ok(data.timestamp);
    assert.ok(data.version);
  });

  test('should handle GET /status endpoint', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/status', {
      method: 'GET'
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 200);

    const data = await response.json();
    assert.ok(data.llm_providers);
    assert.ok(data.llm_providers.groq);
    assert.ok(data.llm_providers.gemini);
    assert.ok(data.llm_providers.claude);
    assert.ok(data.llm_providers.qwen);
  });

  test('should handle GET /challenge endpoint', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/challenge', {
      method: 'GET'
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 200);

    const data = await response.json();
    assert.ok(data.challenge);
    assert.ok(data.timestamp);
    assert.equal(typeof data.challenge, 'string');
    assert.equal(typeof data.timestamp, 'number');
  });

  test('should handle POST /chat endpoint with authentication', async () => {
    const mockEnv = createMockEnv();

    // First get a challenge
    const challengeRequest = new Request('https://example.com/challenge', {
      method: 'GET'
    });
    const challengeResponse = await router.fetch(challengeRequest, mockEnv);
    const { challenge, timestamp } = await challengeResponse.json();

    // Create authenticated chat request
    const chatRequest = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Challenge': challenge,
        'X-Timestamp': timestamp.toString(),
        'X-Signature': 'test-signature'
      },
      body: JSON.stringify({
        message: 'Hello, world!',
        conversation: []
      })
    });

    const response = await router.fetch(chatRequest, mockEnv);

    // Should get 401 due to invalid signature, but structure should be correct
    assert.equal(response.status, 401);

    const data = await response.json();
    assert.ok(data.error);
    assert.ok(data.error.includes('authentication'));
  });

  test('should handle POST /chat endpoint without authentication', async () => {
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

    assert.equal(response.status, 401);

    const data = await response.json();
    assert.ok(data.error);
  });

  test('should handle OPTIONS requests for CORS', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/chat', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 200);

    const headers = response.headers;
    assert.ok(headers.get('Access-Control-Allow-Origin'));
    assert.ok(headers.get('Access-Control-Allow-Methods'));
    assert.ok(headers.get('Access-Control-Allow-Headers'));
  });

  test('should handle 404 for unknown endpoints', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/unknown', {
      method: 'GET'
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 404);

    const data = await response.json();
    assert.ok(data.error);
  });

  test('should handle malformed JSON in POST requests', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 400);

    const data = await response.json();
    assert.ok(data.error);
  });

  test('should handle large request payloads', async () => {
    const mockEnv = createMockEnv();
    const largeMessage = 'A'.repeat(10000);

    const request = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: largeMessage,
        conversation: []
      })
    });

    const response = await router.fetch(request, mockEnv);

    // Should either process or reject gracefully
    assert.ok([200, 400, 413, 401].includes(response.status));
  });

  test('should handle missing Content-Type header', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello, world!',
        conversation: []
      })
    });

    const response = await router.fetch(request, mockEnv);

    // Should handle missing Content-Type gracefully
    assert.ok([200, 400, 401].includes(response.status));
  });

  test('should handle concurrent requests', async () => {
    const mockEnv = createMockEnv();
    const requests = Array.from({ length: 5 }, () =>
      new Request('https://example.com/health', {
        method: 'GET'
      })
    );

    const responses = await Promise.all(
      requests.map(request => router.fetch(request, mockEnv))
    );

    // All should succeed
    responses.forEach(response => {
      assert.equal(response.status, 200);
    });
  });

  test('should handle request timeout scenarios', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/health', {
      method: 'GET'
    });

    // Simulate timeout by using a very short timeout
    const startTime = Date.now();
    const response = await router.fetch(request, mockEnv);
    const endTime = Date.now();

    // Should respond quickly
    assert.equal(response.status, 200);
    assert.ok(endTime - startTime < 1000); // Less than 1 second
  });

  test('should handle different HTTP methods appropriately', async () => {
    const mockEnv = createMockEnv();
    const baseUrl = 'https://example.com/health';

    // GET should work
    const getRequest = new Request(baseUrl, { method: 'GET' });
    const getResponse = await router.fetch(getRequest, mockEnv);
    assert.equal(getResponse.status, 200);

    // POST should not work for health endpoint
    const postRequest = new Request(baseUrl, { method: 'POST' });
    const postResponse = await router.fetch(postRequest, mockEnv);
    assert.equal(postResponse.status, 405); // Method not allowed

    // PUT should not work for health endpoint
    const putRequest = new Request(baseUrl, { method: 'PUT' });
    const putResponse = await router.fetch(putRequest, mockEnv);
    assert.equal(putResponse.status, 405); // Method not allowed

    // DELETE should not work for health endpoint
    const deleteRequest = new Request(baseUrl, { method: 'DELETE' });
    const deleteResponse = await router.fetch(deleteRequest, mockEnv);
    assert.equal(deleteResponse.status, 405); // Method not allowed
  });

  test('should handle request headers properly', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/health', {
      method: 'GET',
      headers: {
        'User-Agent': 'Test-Agent/1.0',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 200);

    // Response should have appropriate headers
    const headers = response.headers;
    assert.ok(headers.get('Content-Type'));
    assert.ok(headers.get('Content-Type').includes('application/json'));
  });

  test('should serve HTML UI for unauthenticated GET request to /', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/', {
      method: 'GET'
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/html');

    const html = await response.text();
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('OmniBot'));
  });

  test('should serve HTML UI for unauthenticated GET request to /chat', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/chat', {
      method: 'GET'
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/html');

    const html = await response.text();
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('OmniBot'));
  });

  test('should require authentication for POST request to /chat', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello',
        conversation: []
      })
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 401);
    const data = await response.json();
    assert.ok(data.error);
    assert.ok(data.error.includes('authentication required'));
  });

  test('should require authentication for POST request to /', async () => {
    const mockEnv = createMockEnv();
    const request = new Request('https://example.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello',
        conversation: []
      })
    });

    const response = await router.fetch(request, mockEnv);

    assert.equal(response.status, 401);
    const data = await response.json();
    assert.ok(data.error);
    assert.ok(data.error.includes('authentication required'));
  });
});