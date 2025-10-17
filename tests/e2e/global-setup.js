/**
 * Global setup for E2E tests
 * Runs once before all tests
 */

const { chromium } = require('@playwright/test');

async function globalSetup(config) {
  console.log('🚀 Starting E2E test global setup...');

  // Get environment variables
  const baseURL = config.projects[0].use.baseURL;
  const workerURL = process.env.E2E_WORKER_URL || 'https://omnibot-router-staging.jonanscheffler.workers.dev';

  console.log(`📱 Frontend URL: ${baseURL}`);
  console.log(`🔧 Worker URL: ${workerURL}`);

  // Launch browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Test frontend connectivity
    console.log('🔍 Testing frontend connectivity...');
    const frontendResponse = await page.goto(baseURL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    if (!frontendResponse || !frontendResponse.ok()) {
      throw new Error(`Frontend not accessible: ${frontendResponse?.status()}`);
    }

    console.log('✅ Frontend is accessible');

    // Test worker API connectivity
    console.log('🔍 Testing worker API connectivity...');
    const workerResponse = await page.request.get(`${workerURL}/health`);

    if (!workerResponse.ok()) {
      throw new Error(`Worker API not accessible: ${workerResponse.status()}`);
    }

    const healthData = await workerResponse.json();
    console.log('✅ Worker API is accessible');
    console.log(`📊 Worker status: ${healthData.status}`);

    // Store configuration for tests
    global.e2eConfig = {
      baseURL,
      workerURL,
      frontendAccessible: true,
      workerAccessible: true,
      healthData
    };

    console.log('✅ Global setup completed successfully');

  } catch (error) {
    console.error('❌ Global setup failed:', error.message);

    // Store failure state for tests to handle
    global.e2eConfig = {
      baseURL,
      workerURL,
      frontendAccessible: false,
      workerAccessible: false,
      error: error.message
    };

    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;
