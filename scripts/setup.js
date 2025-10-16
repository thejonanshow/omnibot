#!/usr/bin/env node
/**
 * Omni-Agent Setup Script
 * Modern Node.js equivalent of setup.sh
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

class OmniAgentSetup {
  constructor() {
    this.envFile = '.env';
    this.requiredKeys = [
      'GROQ_API_KEY',
      'GEMINI_API_KEY',
      'ANTHROPIC_API_KEY',
      'RUNLOOP_API_KEY',
      'GITHUB_TOKEN',
      'SHARED_SECRET'
    ];
  }

  async run() {
    console.log('🚀 OMNI-AGENT SETUP');
    console.log('==================');
    console.log('');

    try {
      await this.checkPrerequisites();
      await this.setupEnvironment();
      await this.installDependencies();
      await this.setupCloudflare();
      await this.deployRunloop();

      console.log('');
      console.log('✅ SETUP COMPLETE!');
      console.log('==================');
      console.log('');
      console.log('Next steps:');
      console.log('  npm run deploy  # Deploy the system');
      console.log('  npm run start   # Start the services');
      console.log('  npm run test    # Run tests');

    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
    }
    console.log(`✓ Node.js ${nodeVersion}`);

    // Check if npm is available
    try {
      execSync('npm --version', { stdio: 'ignore' });
      console.log('✓ npm available');
    } catch {
      throw new Error('npm not found');
    }

    // Check if git is available
    try {
      execSync('git --version', { stdio: 'ignore' });
      console.log('✓ git available');
    } catch {
      throw new Error('git not found');
    }
  }

  async setupEnvironment() {
    console.log('');
    console.log('🔧 Setting up environment...');

    let envContent = '';

    if (fs.existsSync(this.envFile)) {
      envContent = fs.readFileSync(this.envFile, 'utf8');
      console.log('✓ Found existing .env file');
    } else {
      console.log('📝 Creating new .env file');
    }

    // Prompt for missing environment variables
    for (const key of this.requiredKeys) {
      if (!this.hasEnvKey(envContent, key)) {
        const value = await question(`Enter ${key}: `);
        if (value.trim()) {
          envContent += `${key}=${value.trim()}\n`;
        }
      } else {
        console.log(`✓ ${key} already set`);
      }
    }

    // Set default values for optional keys
    const defaults = {
      'GITHUB_REPO': 'thejonanshow/omni-agent',
      'GITHUB_BRANCH': 'main',
      'CLOUDFLARE_ACCOUNT_ID': ''
    };

    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (!this.hasEnvKey(envContent, key)) {
        const value = await question(`Enter ${key} (default: ${defaultValue}): `);
        envContent += `${key}=${value.trim() || defaultValue}\n`;
      }
    }

    fs.writeFileSync(this.envFile, envContent);
    console.log('✓ Environment variables saved');
  }

  hasEnvKey(content, key) {
    return content.includes(`${key}=`);
  }

  async installDependencies() {
    console.log('');
    console.log('📦 Installing dependencies...');

    try {
      execSync('npm install', { stdio: 'inherit' });
      console.log('✓ Dependencies installed');
    } catch (error) {
      throw new Error('Failed to install dependencies');
    }
  }

  async setupCloudflare() {
    console.log('');
    console.log('☁️  Setting up Cloudflare...');

    try {
      // Check if already logged in
      execSync('npx wrangler whoami', { stdio: 'ignore' });
      console.log('✓ Already logged into Cloudflare');
    } catch {
      console.log('Please log into Cloudflare:');
      execSync('npx wrangler login', { stdio: 'inherit' });
    }
  }

  async deployRunloop() {
    console.log('');
    console.log('🔄 Deploying Runloop services...');

    try {
      execSync('python3 blueprint_manager.py', { stdio: 'inherit' });
      console.log('✓ Runloop services deployed');
    } catch (error) {
      console.log('⚠️  Runloop deployment failed, but setup can continue');
    }
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  const setup = new OmniAgentSetup();
  setup.run().catch(console.error);
}

module.exports = OmniAgentSetup;
