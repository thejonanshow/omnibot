// Load from .env
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) envVars[key.trim()] = value.trim();
});

const GITHUB_TOKEN = envVars.GITHUB_TOKEN;
const GITHUB_USER = 'thejonanshow';

async function createGitHubRepo() {
    console.log('Creating GitHub repository: omnibot...');
    
    try {
        const response = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify({
                name: 'omnibot',
                description: 'Voice-controlled AI assistant with automatic LLM provider rotation and self-upgrade capabilities',
                private: false,
                auto_init: false
            })
        });

        if (!response.ok) {
            const error = await response.json();
            if (response.status === 422 && error.errors?.[0]?.message?.includes('already exists')) {
                console.log('✅ Repository already exists!');
                return { exists: true, url: `https://github.com/${GITHUB_USER}/omnibot` };
            }
            throw new Error(`GitHub API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        console.log('✅ Repository created successfully!');
        console.log(`📍 URL: ${data.html_url}`);
        console.log(`🔗 Clone URL: ${data.clone_url}`);
        
        return data;
    } catch (error) {
        console.error('❌ Error creating repository:', error);
        throw error;
    }
}

createGitHubRepo()
    .then(repo => {
        console.log('\n📦 Repository Details:');
        console.log(`   Name: ${repo.name || 'omnibot'}`);
        console.log(`   URL: ${repo.html_url || repo.url}`);
        console.log(`   Clone: ${repo.clone_url || `https://github.com/${GITHUB_USER}/omnibot.git`}`);
    })
    .catch(error => {
        console.error('Failed:', error.message);
        process.exit(1);
    });
