#!/usr/bin/env node

/**
 * Create KV Namespaces for all environments
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Creating Cloudflare KV Namespaces');
console.log('====================================\n');

const WRANGLER_DIR = path.join(__dirname, '..', 'cloudflare-worker');
const WRANGLER_TOML = path.join(WRANGLER_DIR, 'wrangler.toml');

const NAMESPACES = ['USAGE', 'CHALLENGES', 'CONTEXT'];
const ENVIRONMENTS = ['dev', 'staging'];

const namespaceIds = {};

for (const env of ENVIRONMENTS) {
    console.log(`\n📦 Creating namespaces for ${env} environment...`);
    namespaceIds[env] = {};
    
    for (const ns of NAMESPACES) {
        try {
            const title = `omnibot-${env}-${ns.toLowerCase()}`;
            const cmd = `npx wrangler kv:namespace create "${title}"`;
            const output = execSync(cmd, { 
                cwd: WRANGLER_DIR,
                encoding: 'utf8'
            });
            
            // Extract ID from output
            const match = output.match(/id = "([^"]+)"/);
            if (match) {
                const id = match[1];
                namespaceIds[env][ns] = id;
                console.log(`  ✅ ${ns}: ${id}`);
            }
        } catch (error) {
            console.error(`  ❌ Failed to create ${ns} for ${env}`);
        }
    }
}

// Update wrangler.toml with real IDs
console.log('\n📝 Updating wrangler.toml with namespace IDs...');

let wranglerContent = fs.readFileSync(WRANGLER_TOML, 'utf8');

// Replace dev namespace IDs
if (namespaceIds.dev) {
    if (namespaceIds.dev.USAGE) {
        wranglerContent = wranglerContent.replace(
            /\[env\.dev\.kv_namespaces\][\s\S]*?id = "dev_usage_namespace_id"/,
            `[[env.dev.kv_namespaces]]\nbinding = "USAGE"\nid = "${namespaceIds.dev.USAGE}"`
        );
    }
    if (namespaceIds.dev.CHALLENGES) {
        wranglerContent = wranglerContent.replace(
            /id = "dev_challenges_namespace_id"/,
            `id = "${namespaceIds.dev.CHALLENGES}"`
        );
    }
    if (namespaceIds.dev.CONTEXT) {
        wranglerContent = wranglerContent.replace(
            /id = "dev_context_namespace_id"/,
            `id = "${namespaceIds.dev.CONTEXT}"`
        );
    }
}

// Replace staging namespace IDs
if (namespaceIds.staging) {
    if (namespaceIds.staging.USAGE) {
        wranglerContent = wranglerContent.replace(
            /id = "staging_usage_namespace_id"/,
            `id = "${namespaceIds.staging.USAGE}"`
        );
    }
    if (namespaceIds.staging.CHALLENGES) {
        wranglerContent = wranglerContent.replace(
            /id = "staging_challenges_namespace_id"/,
            `id = "${namespaceIds.staging.CHALLENGES}"`
        );
    }
    if (namespaceIds.staging.CONTEXT) {
        wranglerContent = wranglerContent.replace(
            /id = "staging_context_namespace_id"/,
            `id = "${namespaceIds.staging.CONTEXT}"`
        );
    }
}

fs.writeFileSync(WRANGLER_TOML, wranglerContent);

console.log('✅ wrangler.toml updated with namespace IDs\n');

console.log('📋 Summary of created namespaces:');
console.log(JSON.stringify(namespaceIds, null, 2));

console.log('\n✅ KV Namespaces created successfully!');
console.log('\n📝 Next: Run npm run setup:secrets to configure API keys');
