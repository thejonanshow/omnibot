/**
 * Cloudflare Email Worker - Direct Email to GitHub Commits
 * 
 * Receives emails at commits@certora.dev via Cloudflare Email Routing.
 * Parses COMMIT_REQUEST format and pushes to GitHub.
 * 
 * No Gmail OAuth needed - emails come directly to the worker.
 * 
 * Setup:
 * 1. Enable Email Routing on certora.dev
 * 2. Route commits@certora.dev to this worker
 * 3. Deploy with HMAC_SECRET and GITHUB_TOKEN
 * 
 * Flow:
 * 1. Claude composes email with COMMIT_REQUEST
 * 2. User sends to commits@certora.dev
 * 3. Cloudflare routes email to this worker
 * 4. Worker parses and commits to GitHub
 */

export default {
  async email(message, env, ctx) {
    try {
      // Get email subject and body
      const subject = message.headers.get('subject');
      const from = message.headers.get('from');
      
      // Only process emails from authorized sender
      if (!from.includes('jonanscheffler@gmail.com')) {
        console.log('Unauthorized sender:', from);
        return;
      }
      
      // Get email body
      const reader = message.raw.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const rawEmail = new TextDecoder().decode(
        new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []))
      );
      
      // Extract plain text body
      const body = extractPlainTextBody(rawEmail);
      
      // Parse commit request
      const commitRequest = parseCommitRequest(body);
      
      if (!commitRequest) {
        console.log('Invalid commit format');
        return;
      }
      
      // Commit to GitHub
      const result = await commitToGitHub(commitRequest, env.GITHUB_TOKEN);
      
      console.log('Commit successful:', result.commit.sha);
      
    } catch (error) {
      console.error('Error processing email:', error);
    }
  }
};

/**
 * Extract plain text body from raw email
 */
function extractPlainTextBody(rawEmail) {
  // Find Content-Type: text/plain section
  const lines = rawEmail.split('\n');
  let inPlainText = false;
  let body = [];
  
  for (const line of lines) {
    if (line.includes('Content-Type: text/plain')) {
      inPlainText = true;
      continue;
    }
    
    if (inPlainText) {
      if (line.startsWith('--') || line.includes('Content-Type:')) {
        break;
      }
      body.push(line);
    }
  }
  
  return body.join('\n').trim();
}

/**
 * Parse COMMIT_REQUEST from email body
 */
function parseCommitRequest(body) {
  if (!body.includes('COMMIT_REQUEST')) {
    return null;
  }
  
  const lines = body.split('\n');
  const data = {
    owner: 'thejonanshow',
    repo: null,
    branch: 'main',
    files: [],
    message: null
  };
  
  let inContent = false;
  let currentFile = null;
  let contentLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('--- FILE CONTENT START ---')) {
      inContent = true;
      contentLines = [];
      continue;
    }
    
    if (line.includes('--- FILE CONTENT END ---')) {
      inContent = false;
      if (currentFile) {
        data.files.push({
          path: currentFile,
          content: contentLines.join('\n')
        });
        currentFile = null;
      }
      continue;
    }
    
    if (inContent) {
      contentLines.push(lines[i]);
      continue;
    }
    
    if (line.startsWith('Repository:')) {
      const repo = line.split('Repository:')[1].trim();
      if (repo.includes('/')) {
        const parts = repo.split('/');
        data.owner = parts[0];
        data.repo = parts[1];
      } else {
        data.repo = repo;
      }
    } else if (line.startsWith('Branch:')) {
      data.branch = line.split('Branch:')[1].trim();
    } else if (line.startsWith('File:')) {
      currentFile = line.split('File:')[1].trim();
    } else if (line.startsWith('Commit Message:')) {
      data.message = line.split('Commit Message:')[1].trim();
    }
  }
  
  if (!data.repo || data.files.length === 0 || !data.message) {
    return null;
  }
  
  return data;
}

/**
 * Commit to GitHub using the API
 */
async function commitToGitHub(request, token) {
  const { owner, repo, branch, message, files } = request;
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Email-Commit-Worker'
  };
  
  // Get current branch ref
  const refRes = await fetch(`${baseUrl}/git/ref/heads/${branch}`, { headers });
  const refData = await refRes.json();
  const baseSha = refData.object.sha;
  
  // Get base commit
  const commitRes = await fetch(`${baseUrl}/git/commits/${baseSha}`, { headers });
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;
  
  // Create blobs
  const treeItems = [];
  for (const file of files) {
    const blobRes = await fetch(`${baseUrl}/git/blobs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: file.content,
        encoding: 'utf-8'
      })
    });
    
    const blob = await blobRes.json();
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }
  
  // Create tree
  const treeRes = await fetch(`${baseUrl}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems
    })
  });
  
  const tree = await treeRes.json();
  
  // Create commit
  const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [baseSha]
    })
  });
  
  const newCommit = await newCommitRes.json();
  
  // Update ref
  await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sha: newCommit.sha
    })
  });
  
  return {
    commit: {
      sha: newCommit.sha,
      html_url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`
    }
  };
}

/**
 * 
 * Required Environment Variables:
 * - HMAC_SECRET: Your HMAC secret (from past conversations)
 * - GMAIL_USER: jonanscheffler@gmail.com
 * - GMAIL_CLIENT_ID: Google OAuth client ID
 * - GMAIL_CLIENT_SECRET: Google OAuth client secret  
 * - GMAIL_REFRESH_TOKEN: Long-lived refresh token
 * - GITHUB_TOKEN: GitHub PAT with repo scope
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Health check
    if (url.pathname === '/health') {
      return new Response('Gmail Commit Worker Active', { status: 200 });
    }
    
    // Main endpoint: /commit
    if (url.pathname === '/commit' && request.method === 'GET') {
      return await handleCommitRequest(url, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

/**
 * Handle authenticated commit request
 */
async function handleCommitRequest(url, env) {
  const params = url.searchParams;
  const hash = params.get('hash');
  const timestamp = params.get('timestamp');
  const signature = params.get('signature');
  
  if (!hash || !timestamp || !signature) {
    return new Response('Missing parameters', { status: 400 });
  }
  
  // Verify HMAC signature
  const message = `${hash}${timestamp}`;
  const expectedSig = await generateHMAC(message, env.HMAC_SECRET);
  
  if (signature !== expectedSig) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  // Check timestamp (within 5 minutes)
  const now = Date.now();
  const reqTime = parseInt(timestamp);
  if (Math.abs(now - reqTime) > 300000) {
    return new Response('Request expired', { status: 401 });
  }
  
  try {
    // Get Gmail access token
    const accessToken = await getGmailAccessToken(env);
    
    // Search for email with this hash
    const emailContent = await searchGmailByHash(hash, accessToken);
    
    if (!emailContent) {
      return new Response('Email not found', { status: 404 });
    }
    
    // Parse commit request
    const commitRequest = parseCommitRequest(emailContent);
    
    if (!commitRequest) {
      return new Response('Invalid commit format', { status: 400 });
    }
    
    // Commit to GitHub
    const result = await commitToGitHub(commitRequest, env.GITHUB_TOKEN);
    
    // Archive the email
    await archiveGmailMessage(emailContent.id, accessToken);
    
    return new Response(JSON.stringify({
      success: true,
      commit_sha: result.commit.sha,
      commit_url: result.commit.html_url
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get Gmail access token using refresh token
 */
async function getGmailAccessToken(env) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  
  const data = await response.json();
  return data.access_token;
}

/**
 * Search Gmail for email with specific hash in subject
 */
async function searchGmailByHash(hash, accessToken) {
  const query = `subject:${hash} is:unread`;
  const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`;
  
  const searchRes = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const searchData = await searchRes.json();
  
  if (!searchData.messages || searchData.messages.length === 0) {
    return null;
  }
  
  // Get full message content
  const messageId = searchData.messages[0].id;
  const messageUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  
  const messageRes = await fetch(messageUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const message = await messageRes.json();
  
  // Decode email body
  const body = extractEmailBody(message);
  
  return {
    id: messageId,
    body: body
  };
}

/**
 * Extract plain text body from Gmail message
 */
function extractEmailBody(message) {
  if (message.payload.body.data) {
    return atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  
  // Check parts for text/plain
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body.data) {
        return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    }
  }
  
  return '';
}

/**
 * Parse COMMIT_REQUEST from email body
 */
function parseCommitRequest(emailContent) {
  const body = emailContent.body;
  
  if (!body.includes('COMMIT_REQUEST')) {
    return null;
  }
  
  const lines = body.split('\n');
  const data = {
    owner: 'thejonanshow',
    repo: null,
    branch: 'main',
    files: [],
    message: null
  };
  
  let inContent = false;
  let currentFile = null;
  let contentLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('--- FILE CONTENT START ---')) {
      inContent = true;
      contentLines = [];
      continue;
    }
    
    if (line.includes('--- FILE CONTENT END ---')) {
      inContent = false;
      if (currentFile) {
        data.files.push({
          path: currentFile,
          content: contentLines.join('\n')
        });
        currentFile = null;
      }
      continue;
    }
    
    if (inContent) {
      contentLines.push(lines[i]);
      continue;
    }
    
    if (line.startsWith('Repository:')) {
      const repo = line.split('Repository:')[1].trim();
      if (repo.includes('/')) {
        const parts = repo.split('/');
        data.owner = parts[0];
        data.repo = parts[1];
      } else {
        data.repo = repo;
      }
    } else if (line.startsWith('Branch:')) {
      data.branch = line.split('Branch:')[1].trim();
    } else if (line.startsWith('File:')) {
      currentFile = line.split('File:')[1].trim();
    } else if (line.startsWith('Commit Message:')) {
      data.message = line.split('Commit Message:')[1].trim();
    }
  }
  
  if (!data.repo || data.files.length === 0 || !data.message) {
    return null;
  }
  
  return data;
}

/**
 * Commit to GitHub using the API
 */
async function commitToGitHub(request, token) {
  const { owner, repo, branch, message, files } = request;
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Gmail-Commit-Worker'
  };
  
  // Get current branch ref
  const refRes = await fetch(`${baseUrl}/git/ref/heads/${branch}`, { headers });
  const refData = await refRes.json();
  const baseSha = refData.object.sha;
  
  // Get base commit
  const commitRes = await fetch(`${baseUrl}/git/commits/${baseSha}`, { headers });
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;
  
  // Create blobs
  const treeItems = [];
  for (const file of files) {
    const blobRes = await fetch(`${baseUrl}/git/blobs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: file.content,
        encoding: 'utf-8'
      })
    });
    
    const blob = await blobRes.json();
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }
  
  // Create tree
  const treeRes = await fetch(`${baseUrl}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems
    })
  });
  
  const tree = await treeRes.json();
  
  // Create commit
  const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [baseSha]
    })
  });
  
  const newCommit = await newCommitRes.json();
  
  // Update ref
  await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sha: newCommit.sha
    })
  });
  
  return {
    commit: {
      sha: newCommit.sha,
      html_url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`
    }
  };
}

/**
 * Archive (remove inbox label) from Gmail message
 */
async function archiveGmailMessage(messageId, accessToken) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      removeLabelIds: ['INBOX', 'UNREAD']
    })
  });
}

/**
 * Generate HMAC-SHA256 signature
 */
async function generateHMAC(message, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
