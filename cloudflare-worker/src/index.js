export default {
  async fetch(request, env) {
    const logs = [];
    const log = (msg) => {
      const entry = `[${new Date().toISOString()}] ${msg}`;
      logs.push(entry);
      console.log(entry);
    };

    // GET = health check (later: serve chat UI)
    if (request.method === 'GET') {
      return new Response('Omnibot OK - POST to commit via email', { status: 200 });
    }

    if (request.method !== 'POST') {
      return Response.json({
        success: false,
        error: `Method ${request.method} not allowed. Use POST.`,
        logs
      }, { status: 405 });
    }

    let emailData, subject, body;

    try {
      // Parse incoming request
      log('Parsing incoming POST request');
      const contentType = request.headers.get('content-type') || '';
      log(`Content-Type: ${contentType}`);

      if (contentType.includes('application/json')) {
        emailData = await request.json();
      } else if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        emailData = Object.fromEntries(formData.entries());
        log(`Form fields: ${Object.keys(emailData).join(', ')}`);
      } else {
        // Try JSON anyway
        const text = await request.text();
        log(`Raw body length: ${text.length}`);
        try {
          emailData = JSON.parse(text);
        } catch (e) {
          emailData = { text };
        }
      }

      log(`Email data keys: ${Object.keys(emailData).join(', ')}`);

      // Extract subject and body from various possible formats
      subject = emailData.subject 
        || emailData.headers?.subject 
        || emailData.Subject
        || '';
      
      body = emailData.text 
        || emailData.plain 
        || emailData.body
        || emailData.html 
        || emailData.Body
        || emailData.content
        || '';

      log(`Subject: "${subject}"`);
      log(`Body length: ${body.length} chars`);
      log(`Body preview: "${body.substring(0, 200)}${body.length > 200 ? '...' : ''}"`);

    } catch (error) {
      log(`ERROR parsing request: ${error.message}`);
      return Response.json({
        success: false,
        error: `Failed to parse request: ${error.message}`,
        logs
      }, { status: 400 });
    }

    // Parse commit request from email
    let commitRequest;
    try {
      log('Parsing commit request from email');
      commitRequest = parseCommitEmail(subject, body, env, log);

      if (!commitRequest) {
        return Response.json({
          success: false,
          error: 'Could not parse subject line',
          expected: '[COMMIT] repo - message  OR  [COMMIT] owner/repo - message  OR  [COMMIT] owner/repo/branch - message',
          received: { subject, bodyLength: body.length, bodyPreview: body.substring(0, 500) },
          logs
        }, { status: 400 });
      }

      if (!commitRequest.files?.length) {
        return Response.json({
          success: false,
          error: 'No files found in email body',
          parsed: {
            owner: commitRequest.owner,
            repo: commitRequest.repo,
            branch: commitRequest.branch,
            message: commitRequest.message
          },
          hints: [
            'JSON format: {"files":[{"path":"src/index.js","content":"..."}]}',
            'Simple format: FILE: src/index.js\\n<content>\\n\\nFILE: another.js\\n<content>'
          ],
          bodyReceived: body.substring(0, 1000),
          logs
        }, { status: 400 });
      }

      log(`Parsed: ${commitRequest.owner}/${commitRequest.repo}@${commitRequest.branch}`);
      log(`Message: "${commitRequest.message}"`);
      log(`Files: ${commitRequest.files.map(f => f.path).join(', ')}`);

    } catch (error) {
      log(`ERROR parsing commit: ${error.message}`);
      return Response.json({
        success: false,
        error: `Failed to parse commit request: ${error.message}`,
        logs
      }, { status: 400 });
    }

    // Check for GitHub token
    if (!env.GITHUB_TOKEN) {
      log('ERROR: GITHUB_TOKEN secret not configured');
      return Response.json({
        success: false,
        error: 'GITHUB_TOKEN secret not configured in Cloudflare worker settings',
        fix: 'Go to Workers & Pages → omnibot → Settings → Variables → Add secret GITHUB_TOKEN',
        logs
      }, { status: 500 });
    }
    log('GITHUB_TOKEN is configured');

    // Execute GitHub commit
    try {
      log('Starting GitHub commit process');
      const result = await commitToGitHub(commitRequest, env.GITHUB_TOKEN, log);

      log(`SUCCESS: Committed ${result.sha}`);

      return Response.json({
        success: true,
        sha: result.sha,
        url: result.url,
        compareUrl: result.compareUrl,
        committed: {
          owner: commitRequest.owner,
          repo: commitRequest.repo,
          branch: commitRequest.branch,
          message: commitRequest.message,
          files: commitRequest.files.map(f => ({ path: f.path, size: f.content.length }))
        },
        diff: result.diff,
        logs
      });

    } catch (error) {
      log(`ERROR committing: ${error.message}`);
      return Response.json({
        success: false,
        error: error.message,
        errorType: error.name,
        parsed: {
          owner: commitRequest.owner,
          repo: commitRequest.repo,
          branch: commitRequest.branch,
          message: commitRequest.message,
          files: commitRequest.files.map(f => f.path)
        },
        logs
      }, { status: 500 });
    }
  }
};

function parseCommitEmail(subject, body, env, log) {
  // Subject: [COMMIT] repo - message
  // Subject: [COMMIT] owner/repo - message
  // Subject: [COMMIT] owner/repo/branch - message

  const match = subject.match(/\[COMMIT\]\s*(.+?)\s*-\s*(.+)/i);
  if (!match) {
    log(`Subject does not match pattern: "${subject}"`);
    return null;
  }

  const pathPart = match[1].trim();
  const message = match[2].trim();
  const parts = pathPart.split('/');

  let owner, repo, branch;
  if (parts.length >= 3) {
    owner = parts[0];
    repo = parts[1];
    branch = parts.slice(2).join('/');
  } else if (parts.length === 2) {
    owner = parts[0];
    repo = parts[1];
    branch = 'main';
  } else {
    owner = env.DEFAULT_OWNER || 'thejonanshow';
    repo = parts[0];
    branch = 'main';
  }

  log(`Parsed path: owner=${owner}, repo=${repo}, branch=${branch}`);

  const files = parseFiles(body, log);
  return { owner, repo, branch, message, files };
}

function parseFiles(body, log) {
  // Try JSON format first: { "files": [{ "path": "...", "content": "..." }] }
  try {
    const jsonMatch = body.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (jsonMatch) {
      log('Found JSON files block');
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.files) && parsed.files.length > 0) {
        log(`Parsed ${parsed.files.length} files from JSON`);
        return parsed.files;
      }
    }
  } catch (e) {
    log(`JSON parse failed: ${e.message}`);
  }

  // Try simple format: FILE: path\ncontent\n\nFILE: path2\ncontent2
  const files = [];
  const blocks = body.split(/^FILE:\s*/m).slice(1);
  log(`Found ${blocks.length} FILE: blocks`);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    const path = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();
    if (path && content) {
      files.push({ path, content });
      log(`Parsed file: ${path} (${content.length} chars)`);
    }
  }

  if (files.length === 0) {
    log('No files parsed from body');
  }

  return files;
}

async function commitToGitHub(request, token, log) {
  const { owner, repo, branch, message, files } = request;
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Omnibot-Email-Commit'
  };

  // Get branch ref
  log(`Fetching ref for ${branch}`);
  const refRes = await fetch(`${baseUrl}/git/ref/heads/${branch}`, { headers });
  if (!refRes.ok) {
    const error = await refRes.text();
    throw new Error(`Branch '${branch}' not found: ${error}`);
  }
  const refData = await refRes.json();
  const baseSha = refData.object.sha;
  log(`Base commit: ${baseSha}`);

  // Get current commit tree
  log('Fetching current commit tree');
  const commitRes = await fetch(`${baseUrl}/git/commits/${baseSha}`, { headers });
  if (!commitRes.ok) throw new Error('Failed to get current commit');
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;
  log(`Base tree: ${baseTreeSha}`);

  // Get old file contents for diff
  const oldContents = {};
  for (const file of files) {
    try {
      log(`Fetching old content: ${file.path}`);
      const oldFileRes = await fetch(`${baseUrl}/contents/${file.path}?ref=${branch}`, { headers });
      if (oldFileRes.ok) {
        const oldFileData = await oldFileRes.json();
        oldContents[file.path] = atob(oldFileData.content.replace(/\n/g, ''));
        log(`Old file ${file.path}: ${oldContents[file.path].length} chars`);
      } else {
        oldContents[file.path] = null; // New file
        log(`File ${file.path} is new`);
      }
    } catch (e) {
      oldContents[file.path] = null;
      log(`Could not fetch old ${file.path}: ${e.message}`);
    }
  }

  // Create blobs for each file
  const treeItems = [];
  for (const file of files) {
    log(`Creating blob: ${file.path}`);
    const blobRes = await fetch(`${baseUrl}/git/blobs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' })
    });
    if (!blobRes.ok) {
      const error = await blobRes.text();
      throw new Error(`Failed to create blob for ${file.path}: ${error}`);
    }
    const blob = await blobRes.json();
    treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    log(`Blob created: ${blob.sha}`);
  }

  // Create new tree
  log('Creating new tree');
  const treeRes = await fetch(`${baseUrl}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
  });
  if (!treeRes.ok) {
    const error = await treeRes.text();
    throw new Error(`Failed to create tree: ${error}`);
  }
  const tree = await treeRes.json();
  log(`New tree: ${tree.sha}`);

  // Create commit
  log('Creating commit');
  const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] })
  });
  if (!newCommitRes.ok) {
    const error = await newCommitRes.text();
    throw new Error(`Failed to create commit: ${error}`);
  }
  const newCommit = await newCommitRes.json();
  log(`New commit: ${newCommit.sha}`);

  // Update branch ref
  log('Updating branch ref');
  const updateRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha })
  });
  if (!updateRes.ok) {
    const error = await updateRes.text();
    throw new Error(`Failed to update ref: ${error}`);
  }
  log('Branch ref updated');

  // Generate diff summary
  const diff = files.map(file => {
    const oldContent = oldContents[file.path];
    const newContent = file.content;
    
    if (oldContent === null) {
      return {
        path: file.path,
        status: 'added',
        additions: newContent.split('\n').length,
        deletions: 0,
        preview: newContent.substring(0, 500) + (newContent.length > 500 ? '...' : '')
      };
    }

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Simple line-based diff
    const added = newLines.filter(l => !oldLines.includes(l)).length;
    const removed = oldLines.filter(l => !newLines.includes(l)).length;

    return {
      path: file.path,
      status: 'modified',
      additions: added,
      deletions: removed,
      oldSize: oldContent.length,
      newSize: newContent.length,
      sizeDelta: newContent.length - oldContent.length
    };
  });

  return {
    sha: newCommit.sha,
    url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    compareUrl: `https://github.com/${owner}/${repo}/compare/${baseSha.substring(0, 7)}...${newCommit.sha.substring(0, 7)}`,
    diff
  };
}
