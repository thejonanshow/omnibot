/**
 * Function calling handlers
 */

import { saveContext } from './lib/context.js';

const API_ENDPOINTS = {
  RUNLOOP: 'https://api.runloop.ai/v1'
};

export async function handleFunctionCall(functionName, args, env, sessionId) {
  const runloopApiKey = env.RUNLOOP_API_KEY;
  const devboxId = env.RUNLOOP_DEVOX_ID || 'dbx_31Iy53bmdgYBXekhMF8AC';

  switch (functionName) {
    case 'execute_command':
      return await executeCommand(args.command, runloopApiKey, devboxId);
      
    case 'browse_web':
      return await browseWeb(args.url, runloopApiKey, devboxId);
      
    case 'read_file':
      return await readFile(args.path, runloopApiKey, devboxId);
      
    case 'write_file':
      return await writeFile(args.path, args.content, runloopApiKey, devboxId);
      
    case 'list_files':
      return await listFiles(args.path || '.', runloopApiKey, devboxId);
      
    case 'save_context':
      return await saveContext(args.key, args.value, env.CONTEXT, sessionId);
      
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

async function executeCommand(command, apiKey, devboxId) {
  if (!apiKey) throw new Error('Runloop API key not configured');
  
  const response = await fetch(`${API_ENDPOINTS.RUNLOOP}/devboxes/${devboxId}/execute_sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ command })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    return { error: errorData.error || `HTTP ${response.status}: ${response.statusText}` };
  }
  
  return response.json();
}

async function browseWeb(url, apiKey, devboxId) {
  if (!apiKey) throw new Error('Runloop API key not configured');
  
  const curlCommand = `curl -s "${url}"`;
  return await executeCommand(curlCommand, apiKey, devboxId);
}

async function readFile(path, apiKey, devboxId) {
  if (!apiKey) throw new Error('Runloop API key not configured');
  
  return await executeCommand(`cat "${path}"`, apiKey, devboxId);
}

async function writeFile(path, content, apiKey, devboxId) {
  if (!apiKey) throw new Error('Runloop API key not configured');
  
  const escapedContent = content.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  return await executeCommand(`echo "${escapedContent}" > "${path}"`, apiKey, devboxId);
}

async function listFiles(path, apiKey, devboxId) {
  if (!apiKey) throw new Error('Runloop API key not configured');
  
  return await executeCommand(`ls -la "${path}"`, apiKey, devboxId);
}
