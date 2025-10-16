#!/usr/bin/env node
/**
 * Omni-Agent Cleanup Script
 * Modern Node.js equivalent of cleanup_resources.py
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class OmniAgentCleanup {
  constructor() {
    this.envFile = '.env';
  }

  async run() {
    console.log('🧹 OMNI-AGENT CLEANUP');
    console.log('=====================');
    console.log('');

    try {
      this.loadEnvironment();
      await this.cleanupResources();

      console.log('');
      console.log('✅ CLEANUP COMPLETE!');
      console.log('====================');

    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
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

  async cleanupResources() {
    console.log('🧹 Cleaning up unused resources...');

    try {
      execSync('python3 cleanup_resources.py', { stdio: 'inherit' });
      console.log('✓ Resource cleanup completed');
    } catch (error) {
      console.log('⚠️  Resource cleanup failed, but continuing...');
    }
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  const cleanup = new OmniAgentCleanup();
  cleanup.run().catch(console.error);
}

module.exports = OmniAgentCleanup;
