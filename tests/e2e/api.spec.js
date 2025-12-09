/**
 * E2E Tests for API Endpoints
 * Tests the worker API endpoints and responses
 */

import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test.beforeEach(async ({ page }) => {
    // Skip tests if global setup failed
    if (!global.e2eConfig?.workerAccessible) {
      test.skip(true, 'Worker API not accessible');
    }
  });

  test('should respond to health check', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    const response = await page.request.get(`${workerURL}/health`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('healthy');
  });

  test('should respond to status endpoint', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    const response = await page.request.get(`${workerURL}/status`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
  });

  test('should handle CORS preflight requests', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test OPTIONS request (CORS preflight)
    const response = await page.request.fetch(`${workerURL}/chat`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://ad6fdc76.omnibot-ui-staging.pages.dev',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    // Should return CORS headers
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
    expect(headers['access-control-allow-methods']).toBeDefined();
  });

  test('should handle invalid endpoints gracefully', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test non-existent endpoint
    const response = await page.request.get(`${workerURL}/nonexistent`);

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should handle malformed JSON requests', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test with invalid JSON
    const response = await page.request.post(`${workerURL}/chat`, {
      data: 'invalid json',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(400);
  });

  test('should handle large request payloads', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Create a large message
    const largeMessage = 'A'.repeat(10000);

    const response = await page.request.post(`${workerURL}/chat`, {
      data: {
        message: largeMessage,
        conversation: []
      }
    });

    // Should either process or reject gracefully
    expect([200, 400, 413, 401]).toContain(response.status());
  });

  test('should handle concurrent requests', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Make multiple concurrent requests
    const promises = Array.from({ length: 5 }, () =>
      page.request.get(`${workerURL}/health`)
    );

    const responses = await Promise.all(promises);

    // All should succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });

  test('should handle rate limiting', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Make many rapid requests
    const promises = Array.from({ length: 20 }, () =>
      page.request.get(`${workerURL}/health`)
    );

    const responses = await Promise.all(promises);

    // Most should succeed, some might be rate limited
    const successCount = responses.filter(r => r.ok()).length;
    expect(successCount).toBeGreaterThan(10); // At least half should succeed
  });

  test('should return proper content types', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    const response = await page.request.get(`${workerURL}/health`);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('should handle timeout scenarios', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test with a very short timeout
    const response = await page.request.get(`${workerURL}/health`, {
      timeout: 100 // 100ms timeout
    });

    // Should either succeed quickly or timeout gracefully
    expect([200, 408]).toContain(response.status());
  });
});
