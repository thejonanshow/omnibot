export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return new Response('Email Commit Worker OK', { status: 200 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const emailData = await request.json();
      const subject = emailData.subject || emailData.headers?.subject || '';
      const body = emailData.text || emailData.plain || emailData.html || '';

      console.log(`Received: ${subject}`);

      const commitRequest = parseCommitEmail(subject, body, env);

      if (!commitRequest || !commitRequest.files?.length) {
        return Response.json({ success: false, error: 'Could not parse commit' }, { status: 400 });
      }

      const result = await commitToGitHub(commitRequest, env.GITHUB_TOKEN);
      console.log(`Committed: ${result.sha}`);

      return Response.json({ success: true, sha: result.sha, url: result.url });

    } catch (error) {
      console.error('Error:', error.message);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }
};

function parseCommitEmail(subject, body, env) {
  const match = subject.match(/\[COMMIT\]\s*(.+?)\s*-\s*(.+)/i);
  if (!match) return null;

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

  const files = parseFiles(body);
  return { owner, repo, branch, message, files };
}

function parseFiles(body) {
  try {
    const jsonMatch = body.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.files)) return parsed.files;
    }
  } catch (e) {}

  const files = [];
  const blocks = body.split(/^FILE:\s*/m).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const path = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();
    if (path && content) files.push({ path, content });
  }
  return files;
}

async function commitToGitHub(request, token) {
  const { owner, repo, branch, message, files } = request;
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Email-Commit-Worker'
  };

  const refRes = await fetch(`${baseUrl}/git/ref/heads/${branch}`, { headers });
  if (!refRes.ok) throw new Error(`Branch not found: ${branch}`);
  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  const commitRes = await fetch(`${baseUrl}/git/commits/${baseSha}`, { headers });
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  const treeItems = [];
  for (const file of files) {
    const blobRes = await fetch(`${baseUrl}/git/blobs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' })
    });
    if (!blobRes.ok) throw new Error(`Failed to create blob: ${file.path}`);
    const blob = await blobRes.json();
    treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const treeRes = await fetch(`${baseUrl}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
  });
  if (!treeRes.ok) throw new Error('Failed to create tree');
  const tree = await treeRes.json();

  const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] })
  });
  if (!newCommitRes.ok) throw new Error('Failed to create commit');
  const newCommit = await newCommitRes.json();

  const updateRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha })
  });
  if (!updateRes.ok) throw new Error('Failed to update ref');

  return { sha: newCommit.sha, url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}` };
}
