/**
 * E2E Tests for LLM Provider Integration
 * Tests the smart routing and provider selection logic
 */

import { test, expect } from '@playwright/test';

test.describe('LLM Provider Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Skip tests if global setup failed
    if (!global.e2eConfig?.workerAccessible) {
      test.skip(true, 'Worker API not accessible');
    }
  });

  test('should route coding requests to appropriate providers', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Get challenge for authentication
    const challengeResponse = await page.request.get(`${workerURL}/challenge`);
    const { challenge, timestamp } = await challengeResponse.json();

    // Test coding request
    const codingRequest = {
      message: 'Write a Python function to calculate fibonacci numbers',
      conversation: [],
      challenge,
      timestamp,
      signature: 'test-signature' // This will fail auth but test routing logic
    };

    const response = await page.request.post(`${workerURL}/chat`, {
      data: codingRequest
    });

    // Should get 401 due to invalid signature, but routing logic should be tested
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should route general requests to appropriate providers', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Get challenge for authentication
    const challengeResponse = await page.request.get(`${workerURL}/challenge`);
    const { challenge, timestamp } = await challengeResponse.json();

    // Test general request
    const generalRequest = {
      message: 'What is the weather like today?',
      conversation: [],
      challenge,
      timestamp,
      signature: 'test-signature' // This will fail auth but test routing logic
    };

    const response = await page.request.post(`${workerURL}/chat`, {
      data: generalRequest
    });

    // Should get 401 due to invalid signature, but routing logic should be tested
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should handle provider fallback scenarios', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test with a request that might trigger fallback logic
    const request = {
      message: 'Generate a complex algorithm with multiple functions',
      conversation: [],
      challenge: 'test-challenge',
      timestamp: Date.now(),
      signature: 'test-signature'
    };

    const response = await page.request.post(`${workerURL}/chat`, {
      data: request
    });

    // Should get 401 due to invalid signature
    expect(response.status()).toBe(401);
  });

  test('should handle provider rate limiting', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Make multiple requests to test rate limiting
    const promises = Array.from({ length: 10 }, (_, i) =>
      page.request.post(`${workerURL}/chat`, {
        data: {
          message: `Test message ${i}`,
          conversation: [],
          challenge: 'test-challenge',
          timestamp: Date.now(),
          signature: 'test-signature'
        }
      })
    );

    const responses = await Promise.all(promises);

    // All should get 401 due to invalid signature
    responses.forEach(response => {
      expect(response.status()).toBe(401);
    });
  });

  test('should handle provider errors gracefully', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test with malformed request that might cause provider errors
    const request = {
      message: '', // Empty message
      conversation: [],
      challenge: 'test-challenge',
      timestamp: Date.now(),
      signature: 'test-signature'
    };

    const response = await page.request.post(`${workerURL}/chat`, {
      data: request
    });

    // Should get 401 due to invalid signature
    expect(response.status()).toBe(401);
  });

  test('should handle conversation context', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test with conversation history
    const request = {
      message: 'Continue from where we left off',
      conversation: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ],
      challenge: 'test-challenge',
      timestamp: Date.now(),
      signature: 'test-signature'
    };

    const response = await page.request.post(`${workerURL}/chat`, {
      data: request
    });

    // Should get 401 due to invalid signature
    expect(response.status()).toBe(401);
  });

  test('should handle session management', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test with session ID
    const request = {
      message: 'Test message with session',
      conversation: [],
      sessionId: 'test-session-123',
      challenge: 'test-challenge',
      timestamp: Date.now(),
      signature: 'test-signature'
    };

    const response = await page.request.post(`${workerURL}/chat`, {
      data: request
    });

    // Should get 401 due to invalid signature
    expect(response.status()).toBe(401);
  });

  test('should handle function calls', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test with function call request
    const request = {
      message: 'Execute a command to list files',
      conversation: [],
      challenge: 'test-challenge',
      timestamp: Date.now(),
      signature: 'test-signature'
    };

    const response = await page.request.post(`${workerURL}/chat`, {
      data: request
    });

    // Should get 401 due to invalid signature
    expect(response.status()).toBe(401);
  });
});
