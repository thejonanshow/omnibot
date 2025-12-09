/**
 * Global teardown for E2E tests
 * Runs once after all tests complete
 */

async function globalTeardown(config) {
  console.log('🧹 Starting E2E test global teardown...');

  // Clean up any global resources
  if (global.e2eConfig) {
    console.log('📊 E2E Test Summary:');
    console.log(`   Frontend accessible: ${global.e2eConfig.frontendAccessible ? '✅' : '❌'}`);
    console.log(`   Worker accessible: ${global.e2eConfig.workerAccessible ? '✅' : '❌'}`);

    if (global.e2eConfig.healthData) {
      console.log(`   Worker status: ${global.e2eConfig.healthData.status}`);
    }
  }

  // Clean up global state
  delete global.e2eConfig;

  console.log('✅ Global teardown completed');
}

export default globalTeardown;
