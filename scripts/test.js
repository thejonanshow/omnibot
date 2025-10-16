#!/usr/bin/env node
/**
 * Omni-Agent Test Script
 * Modern Node.js equivalent of test.sh and run_tests.sh
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class OmniAgentTest {
  constructor() {
    this.envFile = '.env';
  }

  async run() {
    console.log('🧪 OMNI-AGENT TEST SUITE');
    console.log('========================');
    console.log('');

    try {
      this.loadEnvironment();
      await this.runAllTests();

      console.log('');
      console.log('✅ ALL TESTS COMPLETE!');
      console.log('======================');

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  loadEnvironment() {
    if (!fs.existsSync(this.envFile)) {
      throw new Error('.env file not found. Run "npm run setup" first.');
    }

    // Load environment variables
    const envContent = fs.readFileSync(this.envFile, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join('=');
      }
    });

    console.log('✓ Environment loaded');
  }

  async runAllTests() {
    const tests = [
      { name: 'Omni-Agent System Tests', command: 'python3 test_omni_agent.py' },
      { name: 'Blueprint System Tests', command: 'python3 test_blueprints.py' }
    ];

    for (const test of tests) {
      console.log(`\n🧪 Running ${test.name}...`);
      console.log('─'.repeat(50));

      try {
        execSync(test.command, { stdio: 'inherit' });
        console.log(`✅ ${test.name} passed`);
      } catch (error) {
        console.log(`❌ ${test.name} failed`);
        // Continue with other tests
      }
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const test = new OmniAgentTest();
  test.run().catch(console.error);
}

module.exports = OmniAgentTest;
