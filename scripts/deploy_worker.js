#!/usr/bin/env node
/**
 * Deploy Cloudflare Worker only
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class WorkerDeployer {
  constructor() {
    this.workerDir = 'cloudflare-worker';
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

  async createBackup() {
    console.log('💾 Creating Cloudflare Worker backup...');

    try {
      const backupId = execSync('cd cloudflare-worker && npx wrangler deployments list --limit 1 --format json', {
        encoding: 'utf8'
      });

      const deployments = JSON.parse(backupId);
      if (deployments.length > 0) {
        const currentId = deployments[0].id;
        console.log(`✅ Current deployment ID: ${currentId}`);

        // Save backup ID to file
        fs.writeFileSync('.worker_backup', currentId);
        console.log('✅ Backup ID saved to .worker_backup');
      }
    } catch (error) {
      console.log('⚠️  Could not create backup (this is normal for first deployment)');
    }
  }

  async deployWorker() {
    console.log('☁️  Deploying Cloudflare Worker...');

    try {
      execSync('cd cloudflare-worker && npx wrangler deploy', {
        stdio: 'inherit'
      });
      console.log('✅ Cloudflare Worker deployed successfully');
    } catch (error) {
      throw new Error('Cloudflare Worker deployment failed');
    }
  }

  async runHealthChecks() {
    console.log('🏥 Running health checks...');

    try {
      execSync('python3 utils/health_checker.py', { stdio: 'inherit' });
      console.log('✅ Health checks passed');
      return true;
    } catch (error) {
      console.log('❌ Health checks failed');
      return false;
    }
  }

  async run() {
    console.log('🚀 CLOUDFLARE WORKER DEPLOYMENT');
    console.log('===============================');
    console.log('');

    try {
      this.loadEnvironment();
      await this.createBackup();
      await this.deployWorker();

      const healthCheckPassed = await this.runHealthChecks();

      if (healthCheckPassed) {
        console.log('');
        console.log('✅ WORKER DEPLOYMENT COMPLETE!');
        console.log('==============================');
        console.log('');
        console.log('🌐 Cloudflare Worker is live and healthy!');
        console.log('📱 Ready to handle requests');
        console.log('');
        console.log('🎯 Next: Run npm run deploy:swarm to deploy the Qwen swarm');
      } else {
        console.log('');
        console.log('❌ WORKER DEPLOYMENT FAILED HEALTH CHECKS!');
        console.log('==========================================');
        console.log('');
        console.log('🔄 Consider running: npm run rollback <backup-id>');
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Worker deployment failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const deployer = new WorkerDeployer();
  deployer.run();
}

module.exports = WorkerDeployer;
