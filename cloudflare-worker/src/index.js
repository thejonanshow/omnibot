/**

- Email-to-GitHub Commit Worker with Gist Logging
- 
- Receives emails from Pipedream, commits to GitHub, and logs results to a gist.
- 
- Required Environment Variables:
- - GITHUB_TOKEN: GitHub Personal Access Token with ‘repo’ and ‘gist’ scopes
- 
- Gist URL: https://gist.github.com/thejonanshow/625dc743af3e24b82467339bf19589f2
  */

export default {
async fetch(request, env) {
if (request.method !== “POST”) {
return new Response(“Method not allowed”, { status: 405 });
}

```
try {
  const body = await request.json();
  const { subject, text } = body;

  // Parse commit request from email
  const commitRequest = parseEmailCommit(subject, text);
  
  if (!commitRequest) {
    await logToGist(env.GITHUB_TOKEN, {
      timestamp: new Date().toISOString(),
      status: "error",
      error: "Invalid email format - could not parse commit request",
      subject,
      text_preview: text?.substring(0, 100)
    });
    
    return new Response("Invalid email format", { status: 400 });
  }

  console.log("Parsed commit request:", commitRequest);

  // Commit to GitHub
  const result = await commitToGitHub(commitRequest, env.GITHUB_TOKEN);

  // Log success to gist
  await logToGist(env.GITHUB_TOKEN, {
    timestamp: new Date().toISOString(),
    status: "success",
    repository: commitRequest.repo,
    branch: commitRequest.branch,
    files: commitRequest.files.map(f => f.path),
    commit_message: commitRequest.message,
    commit_sha: result.commit.sha,
    commit_url: result.commit.html_url
  });

  return new Response(JSON.stringify({ 
    success: true,
    commit: result.commit
  }), {
    headers: { "Content-Type": "application/json" }
  });

} catch (error) {
  console.error("Error processing commit:", error);
  
  // Log error to gist
  await logToGist(env.GITHUB_TOKEN, {
    timestamp: new Date().toISOString(),
    status: "error",
    error: error.message,
    stack: error.stack
  });

  return new Response(JSON.stringify({ 
    error: error.message 
  }), {
    status: 500,
    headers: { "Content-Type": "application/json" }
  });
}
```

}
};

/**

- Parse commit request from email subject and body
- 
- Subject format: [COMMIT] owner/repo/branch - Commit message
- ```
         or: [COMMIT] repo - Commit message (uses default owner)
  ```
- 
- Body format (COMMIT_REQUEST style):
- COMMIT_REQUEST
- Repository: owner/repo
- Branch: main
- File: path/to/file
- Action: update
- 
- — FILE CONTENT START —
- content here
- — FILE CONTENT END —
- 
- Commit Message: message
  */
  function parseEmailCommit(subject, text) {
  // Check for [COMMIT] or [OMNIBOT-COMMIT] in subject
  if (!subject || (!subject.includes(”[COMMIT]”) && !subject.includes(”[OMNIBOT-COMMIT]”))) {
  return null;
  }

// Try COMMIT_REQUEST format first
if (text && text.includes(“COMMIT_REQUEST”)) {
return parseCommitRequestFormat(text);
}

// Fall back to subject-based parsing
return parseSubjectFormat(subject, text);
}

/**

- Parse COMMIT_REQUEST format from email body
  */
  function parseCommitRequestFormat(body) {
  const lines = body.split(”\n”);

const data = {
owner: “thejonanshow”,
repo: null,
branch: “main”,
files: [],
message: null
};

let inContent = false;
let currentFile = null;
let contentLines = [];

for (let i = 0; i < lines.length; i++) {
const line = lines[i].trim();

```
if (line.includes("--- FILE CONTENT START ---")) {
  inContent = true;
  contentLines = [];
  continue;
}

if (line.includes("--- FILE CONTENT END ---")) {
  inContent = false;
  if (currentFile) {
    data.files.push({
      path: currentFile,
      content: contentLines.join("\n")
    });
    currentFile = null;
  }
  continue;
}

if (inContent) {
  contentLines.push(lines[i]); // Keep original line with indentation
  continue;
}

if (line.startsWith("Repository:")) {
  const repo = line.split("Repository:")[1].trim();
  if (repo.includes("/")) {
    const parts = repo.split("/");
    data.owner = parts[0];
    data.repo = parts[1];
  } else {
    data.repo = repo;
  }
} else if (line.startsWith("Branch:")) {
  data.branch = line.split("Branch:")[1].trim();
} else if (line.startsWith("File:")) {
  currentFile = line.split("File:")[1].trim();
} else if (line.startsWith("Commit Message:")) {
  data.message = line.split("Commit Message:")[1].trim();
}
```

}

if (!data.repo || data.files.length === 0 || !data.message) {
return null;
}

return data;
}

/**

- Parse commit info from subject line
- Format: [COMMIT] owner/repo/branch - Commit message
  */
  function parseSubjectFormat(subject, body) {
  const match = subject.match(/[(?:OMNIBOT-)?COMMIT]\s*(.+?)\s*-\s*(.+)/i);
  if (!match) return null;

const pathPart = match[1].trim();
const message = match[2].trim();

const parts = pathPart.split(”/”);
let owner, repo, branch;

if (parts.length >= 3) {
owner = parts[0];
repo = parts[1];
branch = parts.slice(2).join(”/”);
} else if (parts.length === 2) {
owner = parts[0];
repo = parts[1];
branch = “main”;
} else {
owner = “thejonanshow”;
repo = parts[0];
branch = “main”;
}

// Parse files from body
const files = parseFilesFromBody(body);
if (files.length === 0) {
return null;
}

return { owner, repo, branch, message, files };
}

/**

- Parse files from email body
- Supports multiple formats
  */
  function parseFilesFromBody(body) {
  const files = [];

// Try JSON format
try {
const jsonMatch = body.match(/{[\s\S]*“files”[\s\S]*}/);
if (jsonMatch) {
const parsed = JSON.parse(jsonMatch[0]);
if (Array.isArray(parsed.files)) {
return parsed.files;
}
}
} catch (e) {
// Not JSON, continue to other formats
}

// Try: FILE: path\ncontent\n\nFILE: path2\ncontent2
const blocks = body.split(/^FILE:\s*/m).slice(1);
for (const block of blocks) {
const blockLines = block.split(”\n”);
const path = blockLines[0].trim();
const content = blockLines.slice(1).join(”\n”).trim();
if (path && content) {
files.push({ path, content });
}
}

return files;
}

/**

- Commit files to GitHub using the GitHub API
  */
  async function commitToGitHub(request, token) {
  const { owner, repo, branch, message, files } = request;
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
  “Authorization”: `Bearer ${token}`,
  “Accept”: “application/vnd.github.v3+json”,
  “User-Agent”: “Email-Commit-Worker”
  };

// Get current branch reference
const refRes = await fetch(`${baseUrl}/git/ref/heads/${branch}`, { headers });
if (!refRes.ok) {
throw new Error(`Branch not found: ${branch}`);
}
const refData = await refRes.json();
const baseSha = refData.object.sha;

// Get base commit
const commitRes = await fetch(`${baseUrl}/git/commits/${baseSha}`, { headers });
if (!commitRes.ok) {
throw new Error(`Failed to get commit: ${baseSha}`);
}
const commitData = await commitRes.json();
const baseTreeSha = commitData.tree.sha;

// Create blobs for each file
const treeItems = [];
for (const file of files) {
const blobRes = await fetch(`${baseUrl}/git/blobs`, {
method: “POST”,
headers: { …headers, “Content-Type”: “application/json” },
body: JSON.stringify({
content: file.content,
encoding: “utf-8”
})
});

```
if (!blobRes.ok) {
  const error = await blobRes.text();
  throw new Error(`Failed to create blob for ${file.path}: ${error}`);
}

const blob = await blobRes.json();
treeItems.push({ 
  path: file.path, 
  mode: "100644", 
  type: "blob", 
  sha: blob.sha 
});
```

}

// Create new tree
const treeRes = await fetch(`${baseUrl}/git/trees`, {
method: “POST”,
headers: { …headers, “Content-Type”: “application/json” },
body: JSON.stringify({
base_tree: baseTreeSha,
tree: treeItems
})
});

if (!treeRes.ok) {
const error = await treeRes.text();
throw new Error(`Failed to create tree: ${error}`);
}

const tree = await treeRes.json();

// Create new commit
const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
method: “POST”,
headers: { …headers, “Content-Type”: “application/json” },
body: JSON.stringify({
message,
tree: tree.sha,
parents: [baseSha]
})
});

if (!newCommitRes.ok) {
const error = await newCommitRes.text();
throw new Error(`Failed to create commit: ${error}`);
}

const newCommit = await newCommitRes.json();

// Update branch reference
const updateRefRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
method: “PATCH”,
headers: { …headers, “Content-Type”: “application/json” },
body: JSON.stringify({
sha: newCommit.sha
})
});

if (!updateRefRes.ok) {
const error = await updateRefRes.text();
throw new Error(`Failed to update ref: ${error}`);
}

return {
commit: {
sha: newCommit.sha,
html_url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`
}
};
}

/**

- Append log entry to the commit log gist
- Gist ID: 625dc743af3e24b82467339bf19589f2
  */
  async function logToGist(token, logEntry) {
  const gistId = “625dc743af3e24b82467339bf19589f2”;
  const filename = “omnibot-commit-log.json”;

const headers = {
“Authorization”: `Bearer ${token}`,
“Accept”: “application/vnd.github.v3+json”,
“User-Agent”: “Email-Commit-Worker”
};

try {
// Get current gist content
const getRes = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
if (!getRes.ok) {
console.error(“Failed to fetch gist:”, await getRes.text());
return;
}

```
const gist = await getRes.json();
let logs = [];

// Parse existing logs
if (gist.files[filename]) {
  try {
    logs = JSON.parse(gist.files[filename].content);
  } catch (e) {
    console.error("Failed to parse existing logs:", e);
    logs = [];
  }
}

// Append new log entry
logs.push(logEntry);

// Keep only last 100 entries
if (logs.length > 100) {
  logs = logs.slice(-100);
}

// Update gist
const updateRes = await fetch(`https://api.github.com/gists/${gistId}`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    files: {
      [filename]: {
        content: JSON.stringify(logs, null, 2)
      }
    }
  })
});

if (!updateRes.ok) {
  console.error("Failed to update gist:", await updateRes.text());
}
```

} catch (error) {
console.error(“Error logging to gist:”, error);
}
}