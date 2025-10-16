#!/usr/bin/env node

/**
 * Multi-Environment Deployment Script
 * Deploys Omnibot to dev, staging, or production
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const environment = process.argv[2] || 'production';
const validEnvironments = ['dev', 'staging', 'production'];

if (!validEnvironments.includes(environment)) {
    console.error(`❌ Invalid environment: ${environment}`);
    console.error(`   Valid: ${validEnvironments.join(', ')}`);
    process.exit(1);
}

console.log(`🚀 Omnibot Deployment to ${environment.toUpperCase()}`);
console.log('='.repeat(50));
console.log('');

const WORKER_DIR = path.join(__dirname, '..', 'cloudflare-worker');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// Environment-specific configuration
const envConfig = {
    dev: {
        workerName: 'omnibot-router-dev',
        frontendProject: 'omnibot-ui-dev',
        branch: 'dev'
    },
    staging: {
        workerName: 'omnibot-router-staging',
        frontendProject: 'omnibot-ui-staging',
        branch: 'staging'
    },
    production: {
        workerName: 'omnibot-router',
        frontendProject: 'omnibot-ui',
        branch: 'main'
    }
};

const config = envConfig[environment];

function exec(cmd, cwd) {
    try {
        console.log(`  $ ${cmd}`);
        const output = execSync(cmd, { cwd, encoding: 'utf8', stdio: 'inherit' });
        return output;
    } catch (error) {
        console.error(`  ❌ Command failed: ${error.message}`);
        throw error;
    }
}

function execQuiet(cmd, cwd) {
    try {
        return execSync(cmd, { cwd, encoding: 'utf8' });
    } catch (error) {
        return null;
    }
}

// Step 1: Deploy Worker
console.log(`\n📦 Step 1/3: Deploying Worker (${config.workerName})`);
console.log('-'.repeat(50));

try {
    exec(`npx wrangler deploy --env ${environment}`, WORKER_DIR);
    console.log(`✅ Worker deployed successfully!`);
    
    // Get worker URL
    const workerUrl = `https://${config.workerName}.jonanscheffler.workers.dev`;
    console.log(`📍 Worker URL: ${workerUrl}`);
} catch (error) {
    console.error('❌ Worker deployment failed!');
    process.exit(1);
}

// Step 2: Deploy Frontend
console.log(`\n🎨 Step 2/3: Deploying Frontend (${config.frontendProject})`);
console.log('-'.repeat(50));

try {
    exec(`npx wrangler pages deploy . --project-name ${config.frontendProject}`, FRONTEND_DIR);
    console.log(`✅ Frontend deployed successfully!`);
    
    // Get frontend URL
    const frontendUrl = `https://${config.frontendProject}.pages.dev`;
    console.log(`📍 Frontend URL: ${frontendUrl}`);
} catch (error) {
    console.error('❌ Frontend deployment failed!');
    process.exit(1);
}

// Step 3: Test Deployment
console.log(`\n🧪 Step 3/3: Testing Deployment`);
console.log('-'.repeat(50));

const workerUrl = `https://${config.workerName}.jonanscheffler.workers.dev`;

try {
    // Test health endpoint
    const healthCmd = `curl -s ${workerUrl}/health`;
    const healthResponse = execQuiet(healthCmd);
    
    if (healthResponse && healthResponse.includes('ok')) {
        console.log('✅ Health check passed');
    } else {
        console.log('⚠️  Health check returned unexpected response');
    }
    
    // Test challenge endpoint
    const challengeCmd = `curl -s ${workerUrl}/challenge`;
    const challengeResponse = execQuiet(challengeCmd);
    
    if (challengeResponse && challengeResponse.includes('challenge')) {
        console.log('✅ Challenge endpoint working');
    } else {
        console.log('⚠️  Challenge endpoint issue');
    }
    
    // Test status endpoint
    const statusCmd = `curl -s ${workerUrl}/status`;
    const statusResponse = execQuiet(statusCmd);
    
    if (statusResponse && (statusResponse.includes('groq') || statusResponse.includes('gemini'))) {
        console.log('✅ Status endpoint working');
    } else {
        console.log('⚠️  Status endpoint issue');
    }
    
} catch (error) {
    console.log('⚠️  Some tests failed (this is OK if worker just deployed)');
}

// Save deployment info
const deploymentInfo = {
    environment,
    timestamp: new Date().toISOString(),
    workerUrl: `https://${config.workerName}.jonanscheffler.workers.dev`,
    frontendUrl: `https://${config.frontendProject}.pages.dev`,
    branch: config.branch
};

const deploymentFile = path.join(__dirname, '..', `deployment-${environment}.json`);
fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

// Summary
console.log('\n' + '='.repeat(50));
console.log(`✨ Deployment to ${environment.toUpperCase()} Complete!`);
console.log('='.repeat(50));
console.log('');
console.log('📍 URLs:');
console.log(`   Worker:   ${deploymentInfo.workerUrl}`);
console.log(`   Frontend: ${deploymentInfo.frontendUrl}`);
console.log('');
console.log('📝 Configuration:');
console.log(`   1. Open: ${deploymentInfo.frontendUrl}`);
console.log(`   2. Click ⚙️ Settings`);
console.log(`   3. Enter Worker URL: ${deploymentInfo.workerUrl}`);
console.log(`   4. Enter Shared Secret (from .env)`);
console.log(`   5. Click 💾 Save`);
console.log('');

if (environment === 'dev') {
    console.log('🎯 Next Steps:');
    console.log('   1. Test on dev: npm run test:dev');
    console.log('   2. If working: npm run promote:dev (to staging)');
} else if (environment === 'staging') {
    console.log('🎯 Next Steps:');
    console.log('   1. Test on staging: npm run test:staging');
    console.log('   2. Test on mobile device');
    console.log('   3. If working: npm run promote:staging (to production)');
} else {
    console.log('🎯 Production Live!');
    console.log('   • Test: npm run test:prod');
    console.log('   • Monitor: Cloudflare Dashboard');
}

console.log('');
