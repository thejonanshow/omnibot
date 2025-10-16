#!/usr/bin/env node
/**
 * Omni-Agent Start Script
 * Modern Node.js equivalent of start.sh
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class OmniAgentStart {
  constructor() {
    this.envFile = '.env';
  }

  async run() {
    console.log('🚀 STARTING OMNI-AGENT');
    console.log('======================');
    console.log('');

    try {
      this.loadEnvironment();
      await this.checkServices();
      await this.startFrontend();

      console.log('');
      console.log('✅ OMNI-AGENT IS RUNNING!');
      console.log('=========================');
      console.log('');
      console.log('🌐 Frontend: http://localhost:3000');
      console.log('📱 Open your browser and start chatting!');
      console.log('');
      console.log('Press Ctrl+C to stop');

    } catch (error) {
      console.error('❌ Failed to start:', error.message);
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

  async checkServices() {
    console.log('🔍 Checking services...');

    // Check Cloudflare Worker
    try {
      const workerUrl = 'https://omni-agent-router.jonanscheffler.workers.dev';
      execSync(`curl -s ${workerUrl}/health`, { stdio: 'pipe' });
      console.log('✓ Cloudflare Worker is healthy');
    } catch (error) {
      console.log('⚠️  Cloudflare Worker health check failed');
    }

    // Check Runloop services
    if (fs.existsSync('.runloop_url')) {
      const runloopUrl = fs.readFileSync('.runloop_url', 'utf8').trim();
      console.log(`✓ Runloop services available at: ${runloopUrl}`);
    } else {
      console.log('⚠️  Runloop services not deployed');
    }
  }

  async startFrontend() {
    console.log('🌐 Starting frontend server...');

    // Check if we have a simple HTTP server available
    try {
      // Try to use Python's built-in server
      console.log('Starting Python HTTP server on port 3000...');
      execSync('python3 -m http.server 3000', {
        stdio: 'inherit',
        cwd: 'frontend'
      });
    } catch (error) {
      // Fallback to Node.js http-server if available
      try {
        console.log('Starting Node.js HTTP server on port 3000...');
        execSync('npx http-server -p 3000', {
          stdio: 'inherit',
          cwd: 'frontend'
        });
      } catch (fallbackError) {
        throw new Error('Could not start frontend server. Please install http-server: npm install -g http-server');
      }
    }
  }
}

// Run start if this script is executed directly
if (require.main === module) {
  const start = new OmniAgentStart();
  start.run().catch(console.error);
}

module.exports = OmniAgentStart;
