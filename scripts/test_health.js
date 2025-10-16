#!/usr/bin/env node
/**
 * Comprehensive Health Check Test Script
 * Tests all system components and provides detailed reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class HealthTestRunner {
  constructor() {
    this.testResults = [];
    this.overallSuccess = true;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().substr(11, 8);
    const prefix = {
      info: '🔍',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async runTest(testName, testFunction) {
    this.log(`Running ${testName}...`, 'info');

    try {
      const result = await testFunction();
      if (result) {
        this.log(`${testName} passed`, 'success');
        this.testResults.push({ name: testName, status: 'PASS', details: result });
      } else {
        this.log(`${testName} failed`, 'error');
        this.testResults.push({ name: testName, status: 'FAIL', details: 'Test returned false' });
        this.overallSuccess = false;
      }
    } catch (error) {
      this.log(`${testName} failed: ${error.message}`, 'error');
      this.testResults.push({ name: testName, status: 'FAIL', details: error.message });
      this.overallSuccess = false;
    }
  }

  async testEnvironmentSetup() {
    // Check if .env exists and has required variables
    if (!fs.existsSync('.env')) {
      throw new Error('.env file not found');
    }

    const envContent = fs.readFileSync('.env', 'utf8');
    const requiredVars = [
      'RUNLOOP_API_KEY',
      'SHARED_SECRET',
      'GITHUB_REPO',
      'CLOUDFLARE_ACCOUNT_ID'
    ];

    const missingVars = requiredVars.filter(varName =>
      !envContent.includes(`${varName}=`)
    );

    if (missingVars.length > 0) {
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    return 'Environment setup complete';
  }

  async testPythonDependencies() {
    // Test if Python health checker can be imported
    try {
      execSync('python3 -c "import sys; sys.path.append(\'utils\'); from health_checker import HealthChecker; print(\'Health checker import successful\')"',
        { stdio: 'pipe' });
      return 'Python dependencies available';
    } catch (error) {
      throw new Error('Health checker import failed');
    }
  }

  async testCloudflareWorker() {
    // Test if Cloudflare Worker is accessible
    try {
      const workerUrl = 'https://omni-agent-router.jonanscheffler.workers.dev';
      const response = execSync(`curl -s -w "%{http_code}" ${workerUrl}/health`, { encoding: 'utf8' });

      if (response.includes('200')) {
        return 'Cloudflare Worker accessible';
      } else {
        throw new Error(`Worker returned status: ${response}`);
      }
    } catch (error) {
      throw new Error(`Worker health check failed: ${error.message}`);
    }
  }

  async testRunloopAPI() {
    // Test Runloop API connectivity
    try {
      execSync('python3 -c "import sys; sys.path.append(\'utils\'); from runloop_api import RunloopAPI; api = RunloopAPI(); devboxes = api.list_devboxes(); print(f\'Found {len(devboxes)} devboxes\')"',
        { stdio: 'pipe' });
      return 'Runloop API accessible';
    } catch (error) {
      throw new Error(`Runloop API test failed: ${error.message}`);
    }
  }

  async testComprehensiveHealthChecks() {
    // Run the comprehensive health checker
    try {
      execSync('python3 utils/health_checker.py', { stdio: 'pipe' });
      return 'All health checks passed';
    } catch (error) {
      throw new Error(`Comprehensive health checks failed: ${error.message}`);
    }
  }

  async testDevboxLifecycle() {
    // Test devbox lifecycle management
    try {
      execSync('python3 -c "import sys; sys.path.append(\'utils\'); from devbox_lifecycle import DevboxLifecycleManager; manager = DevboxLifecycleManager(); print(\'Lifecycle manager initialized\')"',
        { stdio: 'pipe' });
      return 'Devbox lifecycle management available';
    } catch (error) {
      throw new Error(`Devbox lifecycle test failed: ${error.message}`);
    }
  }

  async testBlueprintManagement() {
    // Test blueprint management
    try {
      execSync('python3 -c "import sys; sys.path.append(\'utils\'); from blueprint_manager import BlueprintManager; manager = BlueprintManager(); print(\'Blueprint manager initialized\')"',
        { stdio: 'pipe' });
      return 'Blueprint management available';
    } catch (error) {
      throw new Error(`Blueprint management test failed: ${error.message}`);
    }
  }

  async testFunctionCalling() {
    // Test if function calling is working
    try {
      const workerUrl = 'https://omni-agent-router.jonanscheffler.workers.dev';

      // Generate a simple test message
      const testMessage = {
        message: "Test function calling: list files in current directory",
        sessionId: "health_test_" + Date.now()
      };

      // This is a simplified test - in a real scenario we'd need proper authentication
      const response = execSync(`curl -s -X POST ${workerUrl}/chat -H "Content-Type: application/json" -d '${JSON.stringify(testMessage)}'`,
        { encoding: 'utf8' });

      if (response && response.length > 0) {
        return 'Function calling endpoint accessible';
      } else {
        throw new Error('Function calling endpoint returned empty response');
      }
    } catch (error) {
      throw new Error(`Function calling test failed: ${error.message}`);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🏥 HEALTH CHECK TEST REPORT');
    console.log('='.repeat(60));

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;

    console.log(`\n📊 SUMMARY: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`  • ${result.name}: ${result.details}`);
        });
    }

    console.log('\n✅ PASSED TESTS:');
    this.testResults
      .filter(r => r.status === 'PASS')
      .forEach(result => {
        console.log(`  • ${result.name}: ${result.details}`);
      });

    console.log('\n' + '='.repeat(60));

    if (this.overallSuccess) {
      console.log('🎉 ALL HEALTH CHECKS PASSED - System is healthy!');
    } else {
      console.log('💥 SOME HEALTH CHECKS FAILED - System needs attention!');
    }

    console.log('='.repeat(60) + '\n');
  }

  async runAllTests() {
    console.log('🚀 OMNI-AGENT HEALTH CHECK TEST SUITE');
    console.log('=====================================\n');

    const tests = [
      ['Environment Setup', () => this.testEnvironmentSetup()],
      ['Python Dependencies', () => this.testPythonDependencies()],
      ['Cloudflare Worker', () => this.testCloudflareWorker()],
      ['Runloop API', () => this.testRunloopAPI()],
      ['Devbox Lifecycle', () => this.testDevboxLifecycle()],
      ['Blueprint Management', () => this.testBlueprintManagement()],
      ['Function Calling', () => this.testFunctionCalling()],
      ['Comprehensive Health Checks', () => this.testComprehensiveHealthChecks()]
    ];

    for (const [testName, testFunction] of tests) {
      await this.runTest(testName, testFunction);
    }

    this.generateReport();
    return this.overallSuccess;
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const runner = new HealthTestRunner();

  runner.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error.message);
      process.exit(1);
    });
}

module.exports = HealthTestRunner;
