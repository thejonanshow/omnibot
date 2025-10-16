#!/usr/bin/env node

/**
 * Promote Deployment Between Environments
 * Copies configuration from source to target environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sourceEnv = process.argv[2];
const targetEnv = process.argv[3];

const validEnvironments = ['dev', 'staging', 'production'];

if (!sourceEnv || !targetEnv) {
    console.error('❌ Usage: npm run promote:<source> or node scripts/promote.js <source> <target>');
    console.error('   Example: npm run promote:staging');
    console.error('   Or: node scripts/promote.js dev staging');
    process.exit(1);
}

if (!validEnvironments.includes(sourceEnv) || !validEnvironments.includes(targetEnv)) {
    console.error(`❌ Invalid environment. Valid: ${validEnvironments.join(', ')}`);
    process.exit(1);
}

// Can't promote backwards
const envOrder = ['dev', 'staging', 'production'];
if (envOrder.indexOf(sourceEnv) >= envOrder.indexOf(targetEnv)) {
    console.error(`❌ Can't promote ${sourceEnv} to ${targetEnv}`);
    console.error('   Promotions must go: dev → staging → production');
    process.exit(1);
}

console.log(`🚀 Promoting ${sourceEnv} → ${targetEnv}`);
console.log('='.repeat(50));
console.log('');

// Check if source deployment exists
const sourceDeploymentFile = path.join(__dirname, '..', `deployment-${sourceEnv}.json`);
if (!fs.existsSync(sourceDeploymentFile)) {
    console.error(`❌ No deployment found for ${sourceEnv}`);
    console.error(`   Run: npm run deploy:${sourceEnv} first`);
    process.exit(1);
}

const sourceDeployment = JSON.parse(fs.readFileSync(sourceDeploymentFile, 'utf8'));

console.log(`📦 Source Deployment (${sourceEnv}):`);
console.log(`   Deployed: ${sourceDeployment.timestamp}`);
console.log(`   Worker:   ${sourceDeployment.workerUrl}`);
console.log(`   Frontend: ${sourceDeployment.frontendUrl}`);
console.log('');

// Confirmation
console.log(`⚠️  About to promote to ${targetEnv}!`);
console.log(`   This will replace the current ${targetEnv} deployment.`);
console.log('');

// Wait for confirmation
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Continue? (yes/no): ', (answer) => {
    readline.close();
    
    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('❌ Promotion cancelled');
        process.exit(0);
    }
    
    console.log('');
    console.log(`🚀 Deploying to ${targetEnv}...`);
    console.log('');
    
    try {
        // Deploy to target environment
        execSync(`npm run deploy:${targetEnv}`, { stdio: 'inherit' });
        
        console.log('');
        console.log('✅ Promotion complete!');
        console.log('');
        console.log(`📝 Test the ${targetEnv} deployment:`);
        console.log(`   npm run test:${targetEnv}`);
        console.log('');
        
        if (targetEnv === 'production') {
            console.log('🎉 PRODUCTION IS LIVE!');
            console.log('   • Monitor Cloudflare Dashboard');
            console.log('   • Check mobile devices');
            console.log('   • Watch for errors');
        }
    } catch (error) {
        console.error('❌ Promotion failed!');
        console.error(error.message);
        process.exit(1);
    }
});
