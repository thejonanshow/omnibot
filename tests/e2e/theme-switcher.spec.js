/**
 * Theme Switcher Test
 * Verifies that the theme toggle button exists and is functional in the UI
 */

import { test, expect } from '@playwright/test';

test.describe('Theme Switcher', () => {
  test.beforeEach(async ({ page }) => {
    // Skip if frontend not accessible
    if (!global.e2eConfig?.frontendAccessible) {
      test.skip(true, 'Frontend not accessible');
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have theme toggle button in header', async ({ page }) => {
    // Find theme toggle button by icon or aria-label
    const themeButton = page.locator('button#theme-toggle-btn, button[aria-label*="theme" i]').first();
    
    // Verify button exists and is visible
    await expect(themeButton).toBeVisible();
    
    // Verify button has expected icon (moon or sun)
    const buttonText = await themeButton.textContent();
    expect(['🌙', '☀️']).toContain(buttonText.trim());
  });

  test('should toggle theme when clicked', async ({ page }) => {
    // Find theme toggle button
    const themeButton = page.locator('button#theme-toggle-btn').first();
    await expect(themeButton).toBeVisible();
    
    // Get initial theme (body class)
    const initialClass = await page.locator('body').getAttribute('class');
    const initialIcon = await themeButton.textContent();
    
    // Click theme toggle
    await themeButton.click();
    
    // Wait for theme change animation
    await page.waitForTimeout(300);
    
    // Verify body class changed (theme changed)
    const newClass = await page.locator('body').getAttribute('class');
    expect(newClass).not.toBe(initialClass);
    
    // Verify icon changed
    const newIcon = await themeButton.textContent();
    expect(newIcon).not.toBe(initialIcon);
    
    // Verify icon is the opposite of what it was
    if (initialIcon.includes('🌙')) {
      expect(newIcon).toContain('☀️');
    } else {
      expect(newIcon).toContain('🌙');
    }
  });

  test('should persist theme preference', async ({ page }) => {
    // Find theme toggle button
    const themeButton = page.locator('button#theme-toggle-btn').first();
    
    // Click to change theme
    await themeButton.click();
    await page.waitForTimeout(300);
    
    // Get current theme
    const themeAfterToggle = await page.locator('body').getAttribute('class');
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify theme persisted
    const themeAfterReload = await page.locator('body').getAttribute('class');
    expect(themeAfterReload).toBe(themeAfterToggle);
  });
});
