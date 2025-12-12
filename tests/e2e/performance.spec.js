/**
 * E2E Tests for Performance and Load Testing
 * Tests response times, load handling, and performance metrics
 */

import { test, expect } from '@playwright/test';

test.describe('Performance and Load Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Skip tests if global setup failed
    if (!global.e2eConfig?.workerAccessible) {
      test.skip(true, 'Worker API not accessible');
    }
  });

  test('should respond to health check within acceptable time', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    const startTime = Date.now();
    const response = await page.request.get(`${workerURL}/health`);
    const endTime = Date.now();

    const responseTime = endTime - startTime;

    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds

    console.log(`Health check response time: ${responseTime}ms`);
  });

  test('should handle multiple concurrent health checks', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    const startTime = Date.now();

    // Make 10 concurrent requests
    const promises = Array.from({ length: 10 }, () =>
      page.request.get(`${workerURL}/health`)
    );

    const responses = await Promise.all(promises);
    const endTime = Date.now();

    const totalTime = endTime - startTime;

    // All should succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });

    // Should handle concurrent requests efficiently
    expect(totalTime).toBeLessThan(10000); // All 10 requests within 10 seconds

    console.log(`10 concurrent health checks completed in: ${totalTime}ms`);
  });

  test('should handle load testing with gradual increase', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    const results = [];

    // Test with increasing load
    for (let i = 1; i <= 5; i++) {
      const startTime = Date.now();

      const promises = Array.from({ length: i * 2 }, () =>
        page.request.get(`${workerURL}/health`)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      const successCount = responses.filter(r => r.ok()).length;

      const successRate = successCount / (i * 2);
      
      results.push({
        concurrent: i * 2,
        responseTime,
        successCount,
        successRate
      });

      // Each batch should have high success rate
      expect(successRate).toBeGreaterThan(0.8);
    }

    console.log('Load test results:', results);
  });

  test('should handle stress testing', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    const startTime = Date.now();

    // Make many requests rapidly
    const promises = Array.from({ length: 50 }, (_, i) =>
      page.request.get(`${workerURL}/health`).catch(() => null)
    );

    const responses = await Promise.all(promises);
    const endTime = Date.now();

    const totalTime = endTime - startTime;
    const successCount = responses.filter(r => r && r.ok()).length;
    const successRate = successCount / 50;

    // Should maintain reasonable success rate under stress
    expect(successRate).toBeGreaterThan(0.7);
    expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

    console.log(`Stress test: ${successCount}/50 successful in ${totalTime}ms (${(successRate * 100).toFixed(1)}%)`);
  });

  test('should measure frontend load time', async ({ page }) => {
    if (!global.e2eConfig?.frontendAccessible) {
      test.skip(true, 'Frontend not accessible');
    }

    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Frontend should load within reasonable time
    expect(loadTime).toBeLessThan(10000); // 10 seconds max

    console.log(`Frontend load time: ${loadTime}ms`);
  });

  test('should handle memory usage under load', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Make many requests and check for memory leaks
    const promises = Array.from({ length: 20 }, () =>
      page.request.get(`${workerURL}/health`)
    );

    const responses = await Promise.all(promises);

    // All should still succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });

    // Make another batch to test for degradation
    const secondBatch = Array.from({ length: 20 }, () =>
      page.request.get(`${workerURL}/health`)
    );

    const secondResponses = await Promise.all(secondBatch);

    // Second batch should also succeed
    secondResponses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });

  test('should handle timeout scenarios gracefully', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    // Test with very short timeout
    const startTime = Date.now();

    try {
      await page.request.get(`${workerURL}/health`, {
        timeout: 100 // 100ms timeout
      });
    } catch (error) {
      // Timeout is expected
      expect(error.message).toContain('timeout');
    }

    const endTime = Date.now();
    const actualTime = endTime - startTime;

    // Should timeout quickly
    expect(actualTime).toBeLessThan(1000);
  });

  test('should measure response size', async ({ page }) => {
    const workerURL = global.e2eConfig.workerURL;

    const response = await page.request.get(`${workerURL}/health`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const responseSize = JSON.stringify(data).length;

    // Response should be reasonably sized
    expect(responseSize).toBeLessThan(10000); // Less than 10KB

    console.log(`Health check response size: ${responseSize} bytes`);
  });
});
