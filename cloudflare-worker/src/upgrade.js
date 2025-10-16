// Self-upgrade capability for Omni-Agent
// Allows voice-driven modifications with zero downtime

export async function handleUpgrade(request, env) {
  const { instruction, files } = await request.json();
  
  // Use Claude API with extended context about the codebase
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are modifying the Omni-Agent codebase. You have access to:
      
Current files:
${files ? JSON.stringify(files, null, 2) : 'Will be provided'}

Project structure:
- cloudflare-worker/src/index.js - Main router
- frontend/index.html - Voice UI
- setup.sh - Setup script
- deploy.sh - Deployment script

When user asks for changes:
1. Analyze the request
2. Determine which files need modification
3. Generate the complete new file content
4. Return JSON with file modifications

Response format:
{
  "changes": [
    {
      "file": "path/to/file.js",
      "content": "complete new file content",
      "reason": "why this change"
    }
  ],
  "deployment_needed": true/false,
  "test_commands": ["command to test"]
}`,
      messages: [{
        role: 'user',
        content: instruction
      }]
    })
  });
  
  if (!response.ok) {
    throw new Error('Claude API failed');
  }
  
  const data = await response.json();
  const changes = JSON.parse(data.content[0].text);
  
  // Apply changes via GitHub API
  for (const change of changes.changes) {
    await updateGitHubFile(env, change.file, change.content);
  }
  
  // Trigger new deployment if needed
  if (changes.deployment_needed) {
    await triggerDeployment(env);
  }
  
  return new Response(JSON.stringify({
    success: true,
    changes: changes.changes.map(c => ({
      file: c.file,
      reason: c.reason
    })),
    deployment_triggered: changes.deployment_needed
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function updateGitHubFile(env, path, content) {
  const repo = env.GITHUB_REPO; // format: "username/repo"
  const branch = env.GITHUB_BRANCH || 'main';
  
  // Get current file SHA
  const getResponse = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  );
  
  const fileData = getResponse.ok ? await getResponse.json() : null;
  
  // Update or create file
  await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Voice upgrade: Update ${path}`,
        content: btoa(content),
        branch,
        sha: fileData?.sha
      })
    }
  );
}

async function triggerDeployment(env) {
  // Trigger Cloudflare deployment via API
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/omni-agent-ui/deployments`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: env.GITHUB_BRANCH || 'main'
      })
    }
  );
  
  return response.ok;
}

export async function getCodebaseContext(env) {
  // Fetch current codebase from GitHub
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || 'main';
  
  const files = [
    'cloudflare-worker/src/index.js',
    'frontend/index.html',
    'setup.sh',
    'deploy.sh',
    'README.md'
  ];
  
  const contents = {};
  
  for (const file of files) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/contents/${file}?ref=${branch}`,
        {
          headers: {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        contents[file] = atob(data.content);
      }
    } catch (e) {
      console.error(`Failed to fetch ${file}:`, e);
    }
  }
  
  return contents;
}
