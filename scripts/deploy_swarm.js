#!/usr/bin/env node
/**
 * Deploy Qwen MCP Swarm only
 */

const { execSync } = require('child_process');
const fs = require('fs');

class SwarmDeployer {
  constructor() {
    this.pythonScript = 'scripts/deploy_qwen_swarm.py';
  }

  loadEnvironment() {
    console.log('🔧 Loading environment variables...');

    if (!fs.existsSync('.env')) {
      throw new Error('.env file not found. Run npm run setup first.');
    }

    // Load .env file
    const envConfig = require('dotenv').parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }

    console.log('✅ Environment loaded');
  }

  checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');

    // Check if Python script exists
    if (!fs.existsSync(this.pythonScript)) {
      throw new Error(`Python script not found: ${this.pythonScript}`);
    }

    // Check if Qwen MCP blueprint exists
    if (!process.env.QWEN_MCP_BLUEPRINT_ID) {
      throw new Error('QWEN_MCP_BLUEPRINT_ID not found in .env. Create the blueprint first.');
    }

    console.log('✅ Prerequisites check passed');
  }

  async deploySwarm() {
    console.log('🤖 Deploying Qwen MCP Swarm...');

    try {
      execSync(`python3 ${this.pythonScript}`, {
        stdio: 'inherit'
      });
      console.log('✅ Qwen MCP Swarm deployed successfully');
    } catch (error) {
      throw new Error('Qwen MCP Swarm deployment failed');
    }
  }

  async testSwarm() {
    console.log('🧪 Testing swarm functionality...');

    try {
      execSync('python3 scripts/test_swarm.py', {
        stdio: 'inherit'
      });
      console.log('✅ Swarm tests passed');
      return true;
    } catch (error) {
      console.log('❌ Swarm tests failed');
      return false;
    }
  }

  async run() {
    console.log('🚀 QWEN MCP SWARM DEPLOYMENT');
    console.log('============================');
    console.log('');

    try {
      this.loadEnvironment();
      this.checkPrerequisites();
      await this.deploySwarm();

      const testPassed = await this.testSwarm();

      if (testPassed) {
        console.log('');
        console.log('✅ SWARM DEPLOYMENT COMPLETE!');
        console.log('=============================');
        console.log('');
        console.log('🤖 Qwen MCP Swarm is live and functional!');
        console.log('👥 Multi-agent system ready for projects');
        console.log('🎯 Agents will use Qwen for code implementation');
        console.log('✨ Claude reserved for final polish only');
        console.log('');
        console.log('🚀 System ready for collaborative coding!');
      } else {
        console.log('');
        console.log('⚠️  SWARM DEPLOYMENT COMPLETED WITH TEST ISSUES');
        console.log('===============================================');
        console.log('');
        console.log('🤖 Swarm deployed but tests had issues');
        console.log('📋 Check the test logs above for details');
        console.log('💡 You may need to troubleshoot individual components');
      }

    } catch (error) {
      console.error('❌ Swarm deployment failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const deployer = new SwarmDeployer();
  deployer.run();
}

module.exports = SwarmDeployer;
