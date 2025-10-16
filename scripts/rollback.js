#!/usr/bin/env node
/**
 * Omni-Agent Rollback Script
 * Modern Node.js equivalent of rollback.sh
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class OmniAgentRollback {
  constructor() {
    this.envFile = '.env';
  }

  async run() {
    console.log('🔄 OMNI-AGENT ROLLBACK');
    console.log('======================');
    console.log('');

    try {
      this.loadEnvironment();
      await this.rollbackCloudflare();

      console.log('');
      console.log('✅ ROLLBACK COMPLETE!');
      console.log('=====================');

    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
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

  async rollbackCloudflare() {
    const args = process.argv.slice(2);
    const backupId = args[0];

    if (!backupId) {
      console.log('Usage: npm run rollback <backup-id>');
      console.log('');
      console.log('Available backups:');

      // List available backups
      const backupDirs = fs.readdirSync('.').filter(dir =>
        dir.startsWith('backup-') && fs.statSync(dir).isDirectory()
      );

      if (backupDirs.length === 0) {
        console.log('  No backups found');
      } else {
        backupDirs.forEach(dir => {
          console.log(`  ${dir}`);
        });
      }

      return;
    }

    console.log(`🔄 Rolling back to: ${backupId}`);

    try {
      process.chdir('cloudflare-worker');
      execSync(`npx wrangler rollback ${backupId}`, { stdio: 'inherit' });
      process.chdir('..');
      console.log('✓ Cloudflare Worker rolled back');
    } catch (error) {
      process.chdir('..');
      throw new Error('Cloudflare Worker rollback failed');
    }
  }
}

// Run rollback if this script is executed directly
if (require.main === module) {
  const rollback = new OmniAgentRollback();
  rollback.run().catch(console.error);
}

module.exports = OmniAgentRollback;
