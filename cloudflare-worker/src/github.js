/**
 * GitHub API module for OmniBot
 * Handles all GitHub operations
 */

import { GITHUB_REPO, GITHUB_API_URL } from './config.js';

/**
 * Make authenticated GitHub API request
 */
async function githubApi(path, options = {}, env) {
  const url = `${GITHUB_API_URL}/repos/${GITHUB_REPO}/${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OmniBot/1.0',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
  }
  
  return response;
}

/**
 * Get file content from GitHub
 */
export async function githubGet(path, env) {
  const response = await githubApi(`contents/${path}`, {}, env);
  return await response.json();
}

/**
 * Update file content on GitHub
 */
export async function githubPut(path, content, message, sha, env) {
  const body = {
    message,
    content: btoa(content),
    sha
  };
  
  const response = await githubApi(`contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }, env);
  
  return await response.json();
}

/**
 * Create a pull request
 */
export async function createPullRequest(title, head, base, body, env) {
  const prData = {
    title,
    head,
    base,
    body
  };
  
  const response = await githubApi('pulls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prData)
  }, env);
  
  return await response.json();
}

/**
 * Get the latest commit SHA for a branch
 */
export async function getLatestCommitSha(branch = 'main', env) {
  const response = await githubApi(`git/refs/heads/${branch}`, {}, env);
  const data = await response.json();
  return data.object.sha;
}

/**
 * Create a blob
 */
export async function createBlob(content, env) {
  const response = await githubApi('git/blobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: btoa(content),
      encoding: 'base64'
    })
  }, env);
  
  return await response.json();
}

/**
 * Create a tree
 */
export async function createTree(baseTree, tree, env) {
  const response = await githubApi('git/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTree,
      tree
    })
  }, env);
  
  return await response.json();
}

/**
 * Create a commit
 */
export async function createCommit(message, tree, parents, env) {
  const response = await githubApi('git/commits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree,
      parents
    })
  }, env);
  
  return await response.json();
}

/**
 * Update a reference
 */
export async function updateRef(ref, sha, env) {
  const response = await githubApi(`git/refs/${ref}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha })
  }, env);
  
  return await response.json();
}

/**
 * Get repository contents
 */
export async function getRepositoryContents(path = '', env) {
  const response = await githubApi(`contents/${path}`, {}, env);
  return await response.json();
}

/**
 * Create or update file with automatic PR creation
 */
export async function createOrUpdateFileWithPR(filePath, content, commitMessage, env) {
  try {
    // Get current file SHA if it exists
    let _currentFile;
    try {
      _currentFile = await githubGet(filePath, env);
    } catch (error) {
      // File doesn't exist, which is fine for creation
      _currentFile = null;
    }
    
    // Create a new branch
    const timestamp = Date.now();
    const branchName = `omnibot-update-${timestamp}`;
    const baseSha = await getLatestCommitSha('main', env);
    
    // Create blob for new content
    const blob = await createBlob(content, env);
    
    // Create tree with new content
    const tree = await createTree(baseSha, [{
      path: filePath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    }], env);
    
    // Create commit
    const commit = await createCommit(commitMessage, tree.sha, [baseSha], env);
    
    // Create reference (branch)
    await updateRef(`heads/${branchName}`, commit.sha, env);
    
    // Create pull request
    const pr = await createPullRequest(
      commitMessage,
      branchName,
      'main',
      `Automated update by OmniBot\n\n${commitMessage}`,
      env
    );
    
    return {
      success: true,
      prNumber: pr.number,
      prUrl: pr.html_url,
      branch: branchName,
      commit: commit.sha
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  githubGet,
  githubPut,
  createPullRequest,
  getLatestCommitSha,
  createBlob,
  createTree,
  createCommit,
  updateRef,
  getRepositoryContents,
  createOrUpdateFileWithPR
};