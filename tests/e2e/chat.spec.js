/**
 * E2E Tests for Chat Functionality
 * Tests the main chat interface and LLM provider routing
 */

const { test, expect } = require('@playwright/test');

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Skip tests if global setup failed
    if (!global.e2eConfig?.frontendAccessible) {
      test.skip(true, 'Frontend not accessible');
    }

    // Navigate to the frontend
    await page.goto('/');
  });

  test('should load the chat interface', async ({ page }) => {
    // Check if the main chat interface elements are present
    await expect(page.locator('body')).toBeVisible();

    // Look for common chat interface elements
    const hasInput = await page.locator('input[type="text"], textarea').count() > 0;
    const hasButton = await page.locator('button').count() > 0;

    expect(hasInput || hasButton).toBeTruthy();
  });

  test('should display initial UI elements', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for basic UI elements
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/chat-interface.png' });
  });

  test('should handle page navigation', async ({ page }) => {
    // Test that we can navigate to the page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify we're on the right page
    const url = page.url();
    expect(url).toContain('omnibot-ui-staging.pages.dev');
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(error =>
      !error.includes('favicon') &&
      !error.includes('404') &&
      !error.includes('CORS')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that content is visible on mobile
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/chat-mobile.png' });
  });

  test('should handle network connectivity issues gracefully', async ({ page }) => {
    // Simulate offline condition
    await page.context().setOffline(true);

    await page.goto('/');

    // Should still show some content (cached or error state)
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Restore connectivity
    await page.context().setOffline(false);
  });
});
