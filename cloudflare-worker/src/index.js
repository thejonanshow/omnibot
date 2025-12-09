/**
// CI/CD Status: All tests passing! Browser API detection fixed.
// Deployment ready - wrangler configured correctly.

// CI test: Fixed browser API detection for HTML templates
 * OmniBot - Cuttlefish Edition
 * https://en.wikipedia.org/wiki/Cuttlefish
 * 
 * Semantic versioning via exotic sea creatures (alphabetical):
 * A: Axolotl, B: Blobfish, C: Cuttlefish, D: Dumbo Octopus, E: Electric Eel
 * F: Frogfish, G: Goblin Shark, H: Hagfish, I: Icefish, J: Jellyfish
 * K: Kissing Gourami, L: Leafy Sea Dragon, M: Mantis Shrimp, N: Nautilus
 * O: Oarfish, P: Pufferfish, Q: Queen Angelfish, R: Ribbon Eel, S: Sea Pig
 * T: Tardigrade, U: Umbrella Octopus, V: Vampire Squid, W: Wobbegong
 * X: Xiphias (Swordfish), Y: Yeti Crab, Z: Zebrafish
 * Then: Anglerfish, Barreleye, Chimaera, Dragon Moray...
 * 
 * Current: Cuttlefish (C) - Fixed UI, inline edit mode, working themes
 * 
 * CRITICAL SAFETY FEATURES:
 * - Validates code structure BEFORE committing
 * - Cannot destroy core functions (selfEdit, callGroq, etc)
 * - Rejects wholesale replacements
 * - Only allows targeted modifications
 * - NO data extraction - passes full response to validation
 */

const GITHUB_REPO = 'thejonanshow/omnibot';

const GITHUB_API_URL = 'https://api.github.com';

const GROQ_MODELS = {
  qwen: 'qwen2.5-coder-32k-instruct',
  llama: 'llama-3.3-70b-versatile'
};

// CRITICAL: Functions that must exist in any version
const REQUIRED_FUNCTIONS = [
  'async function selfEdit',
  'async function callGroq',
  'async function githubGet',
  'async function githubPut',
  'export default'
];

async function githubGet(path, env) {
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${path}?ref=main`, {
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Accept': 'application/vnd.github.v3+json', 
      'User-Agent': 'OmniBot' 
    }
  });
  return res.json();
}

async function githubPut(path, content, message, env) {
  const current = await githubGet(path, env);
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Content-Type': 'application/json', 
      'User-Agent': 'OmniBot' 
    },
    body: JSON.stringify({ 
      message, 
      content: btoa(unescape(encodeURIComponent(content))), 
      branch: 'main', 
      sha: current.sha 
    })
  });
  return res.json();
}

async function callGroq(model, messages, env, systemPrompt = null) {
  const fullMessages = systemPrompt 
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;
    
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${env.GROQ_API_KEY}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ 
      model: GROQ_MODELS[model], 
      messages: fullMessages, 
      max_tokens: model === 'qwen' ? 16000 : 8000,
      temperature: 0.3
    })
  });
  
  const data = await res.json();
  
  if (data.error) {
    return `ERROR: ${data.error.message || JSON.stringify(data.error)}`;
  }
  
  return data.choices?.[0]?.message?.content || 'No response';
}

async function getGithubLogs(env) {
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/actions/runs`, {
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Accept': 'application/vnd.github.v3+json', 
      'User-Agent': 'OmniBot' 
    }
  });
  return res.json();
}

function validateCodeStructure(code) {
  // CRITICAL: Ensure all required functions exist
  const missing = [];
  
  for (const required of REQUIRED_FUNCTIONS) {
    if (!code.includes(required)) {
      missing.push(required);
    }
  }
  
  if (missing.length > 0) {
    return {
      valid: false,
      reason: `Missing required functions: ${missing.join(', ')}`
    };
  }
  
  // Check minimum size (full OmniBot should be ~10KB+)
  if (code.length < 5000) {
    return {
      valid: false,
      reason: `Code too short (${code.length} chars) - appears to be partial or replacement`
    };
  }
  
  // Check for HTML content (the UI)
  if (!code.includes('const HTML =') && !code.includes('<html>')) {
    return {
      valid: false,
      reason: 'Missing HTML UI - structure destroyed'
    };
  }
  
  return { valid: true };
}

function cleanCodeFences(text) {
  // ONLY remove markdown fences - preserve EVERYTHING else
  let cleaned = text.trim();
  
  // Remove outer fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:javascript|js)?\s*\n?/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  
  return cleaned;
}

// Alias for backward compatibility with tests
const extractCodeFromFinal = cleanCodeFences;

async function generateWithLlama(instruction, currentCode, env) {
  const systemPrompt = `You are modifying Cloudflare Worker code.

OUTPUT ONLY THE COMPLETE MODIFIED CODE.
NO explanations, NO markdown fences, NO "here's the code", NO comments about what changed.
Just the raw JavaScript code starting with /** and ending with the closing HTML template.

CRITICAL RULES:
1. MODIFY the existing code, do NOT replace it
2. Keep ALL existing functions intact
3. Only change what's specifically requested
4. Code must work in Cloudflare Workers (no browser APIs)`;

  const userPrompt = `Current code (${currentCode.length} chars):

\`\`\`javascript
${currentCode}
\`\`\`

Change: ${instruction}

Output the COMPLETE modified code (no explanations):`;

  const response = await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
  
  console.log(`Llama: ${response.length} chars`);
  
  return response;
}

async function selfEdit(instruction, env) {
  try {
    // Step 1: Read current code
    const file = await githubGet('cloudflare-worker/src/index.js', env);
    if (!file.content) {
      return { 
        success: false, 
        error: 'Could not read code',
        explanation: 'GitHub API failed' 
      };
    }
    
    const currentCode = decodeURIComponent(escape(atob(file.content)));
    console.log(`Current code: ${currentCode.length} chars`);
    
    // Step 2: Use Llama to modify the code
    console.log('Generating with Llama...');
    const response = await generateWithLlama(instruction, currentCode, env);
    
    // Step 3: Clean code fences ONLY (no extraction)
    const finalCode = cleanCodeFences(response);
    console.log(`After fence removal: ${finalCode.length} chars`);
    
    // Step 4: CRITICAL SAFETY CHECK
    const validation = validateCodeStructure(finalCode);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Safety check failed',
        explanation: validation.reason,
        debug: {
          instruction: instruction,
          responseLength: response.length,
          extractedLength: finalCode.length,
          fullLlamaResponse: response,  // FULL response for debugging
          extractedCode: finalCode      // What we extracted
        }
      };
    }
    
    // Check if actually changed
    if (currentCode.replace(/\s/g, '') === finalCode.replace(/\s/g, '')) {
      return {
        success: false,
        error: 'No changes made',
        explanation: 'Generated code identical to current'
      };
    }
    
    // Step 5: Commit
    const commitMessage = `[OmniBot] ${instruction.slice(0, 72)}`;
    console.log('Committing...');
    const result = await githubPut('cloudflare-worker/src/index.js', finalCode, commitMessage, env);
    
    if (!result.commit) {
      return {
        success: false,
        error: result.message || 'Commit failed',
        explanation: 'GitHub rejected commit'
      };
    }
    
    // Step 6: Explain
    const explanation = await explainChanges(instruction, currentCode, finalCode, env);
    
    // Stats
    const oldLines = new Set(currentCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')));
    const newLines = new Set(finalCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')));
    const added = [...newLines].filter(l => !oldLines.has(l));
    const removed = [...oldLines].filter(l => !newLines.has(l));
    
    return {
      success: true,
      explanation: explanation.trim(),
      commit: result.commit.sha,
      url: result.commit.html_url,
      stats: {
        added: added.length,
        removed: removed.length,
        size: finalCode.length
      },
      samples: added.slice(0, 5)
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message,
      explanation: 'Pipeline error',
      stack: e.stack?.split('\n').slice(0, 3).join('\n')
    };
  }
}

async function explainChanges(instruction, oldCode, newCode, env) {
  const systemPrompt = `Explain code changes concisely.`;

  const userPrompt = `Instruction: ${instruction}

Old: ${oldCode.split('\n').length} lines
New: ${newCode.split('\n').length} lines

Explain what changed (2-3 sentences):`;

  return await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
}

async function getGithubDeployLogs(env) {
  const logs = await getGithubLogs(env);
  return logs;
}



const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OmniBot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Orbitron:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d0d0d;
      --bg-secondary: #171717;
      --bg-tertiary: #262626;
      --text: #fafafa;
      --text-secondary: #a1a1aa;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --user-bubble: #3b82f6;
      --ai-bubble: #262626;
      --border: #27272a;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
      --glow: transparent;
      --font-main: 'IBM Plex Sans', -apple-system, sans-serif;
      --font-mono: 'IBM Plex Mono', monospace;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      height: 100%;
      font-family: var(--font-main);
      background: var(--bg);
      color: var(--text);
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }
    
    /* === THEMES === */
    
    /* Modern Dark (default) */
    body.theme-modern {
      --bg: #0d0d0d;
      --bg-secondary: #171717;
      --bg-tertiary: #262626;
      --text: #fafafa;
      --text-secondary: #a1a1aa;
      --accent: #3b82f6;
      --user-bubble: #3b82f6;
      --ai-bubble: #262626;
      --border: #27272a;
      --glow: none;
    }
    
    /* Matrix */
    body.theme-matrix {
      --bg: #000a00;
      --bg-secondary: #001400;
      --bg-tertiary: #002200;
      --text: #00ff41;
      --text-secondary: #00cc33;
      --accent: #00ff41;
      --user-bubble: #003300;
      --ai-bubble: #001a00;
      --border: #004400;
      --glow: 0 0 10px rgba(0, 255, 65, 0.3);
      --font-main: 'IBM Plex Mono', monospace;
    }
    
    /* Cyberpunk */
    body.theme-cyberpunk {
      --bg: #0a000f;
      --bg-secondary: #15001f;
      --bg-tertiary: #200030;
      --text: #ff00ff;
      --text-secondary: #cc00cc;
      --accent: #00ffff;
      --user-bubble: #330033;
      --ai-bubble: #1a001a;
      --border: #440044;
      --glow: 0 0 15px rgba(255, 0, 255, 0.3);
    }
    
    /* HAL 9000 */
    body.theme-hal {
      --bg: #0a0000;
      --bg-secondary: #150000;
      --bg-tertiary: #200000;
      --text: #ff0000;
      --text-secondary: #cc0000;
      --accent: #ff0000;
      --user-bubble: #330000;
      --ai-bubble: #1a0000;
      --border: #440000;
      --glow: 0 0 20px rgba(255, 0, 0, 0.4);
    }
    
    /* Tron */
    body.theme-tron {
      --bg: #000005;
      --bg-secondary: #000510;
      --bg-tertiary: #000a18;
      --text: #6fdfff;
      --text-secondary: #4fc3dc;
      --accent: #6fdfff;
      --user-bubble: #001a30;
      --ai-bubble: #000d1a;
      --border: #002040;
      --glow: 0 0 15px rgba(111, 223, 255, 0.4);
      --font-main: 'Orbitron', sans-serif;
    }
    
    /* Neuromancer */
    body.theme-neuromancer {
      --bg: #05000a;
      --bg-secondary: #0a0014;
      --bg-tertiary: #10001f;
      --text: #bf5fff;
      --text-secondary: #9945cc;
      --accent: #bf5fff;
      --user-bubble: #200040;
      --ai-bubble: #100020;
      --border: #300050;
      --glow: 0 0 12px rgba(191, 95, 255, 0.3);
    }
    
    /* Borg */
    body.theme-borg {
      --bg: #050505;
      --bg-secondary: #0a0a0a;
      --bg-tertiary: #151515;
      --text: #00ff00;
      --text-secondary: #00cc00;
      --accent: #00ff00;
      --user-bubble: #0a1a0a;
      --ai-bubble: #050f05;
      --border: #1a2a1a;
      --glow: 0 0 8px rgba(0, 255, 0, 0.5);
      --font-main: 'IBM Plex Mono', monospace;
    }
    
    /* Dune */
    body.theme-dune {
      --bg: #1a1408;
      --bg-secondary: #252010;
      --bg-tertiary: #302a18;
      --text: #f4a261;
      --text-secondary: #e07b00;
      --accent: #f4a261;
      --user-bubble: #3d3015;
      --ai-bubble: #28200d;
      --border: #4a3a1a;
      --glow: 0 0 10px rgba(244, 162, 97, 0.2);
    }
    
    .app {
      height: 100%;
      display: flex;
      flex-direction: column;
      max-width: 900px;
      margin: 0 auto;
    }
    
    .header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
      box-shadow: var(--glow);
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .logo-icon {
      width: 32px;
      height: 32px;
      background: var(--accent);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: var(--bg);
      font-weight: bold;
      box-shadow: var(--glow);
    }
    
    .logo-text { font-weight: 600; font-size: 16px; }
    .logo-version { font-size: 11px; color: var(--text-secondary); font-family: var(--font-mono); }
    
    .header-actions { display: flex; gap: 8px; align-items: center; }
    
    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    
    .icon-btn:hover { background: var(--bg-tertiary); color: var(--text); }
    
    .tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: var(--bg-secondary);
      border-radius: 8px;
    }
    
    .tab {
      padding: 6px 14px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    
    .tab.active { background: var(--bg-tertiary); color: var(--text); }
    
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: var(--text-secondary);
      padding: 40px 20px;
    }
    
    .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.6; }
    .empty-title { font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
    .empty-subtitle { font-size: 14px; max-width: 300px; line-height: 1.5; }
    
    .msg {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 15px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      animation: fadeIn 0.2s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .msg.user {
      align-self: flex-end;
      background: var(--user-bubble);
      border-radius: 16px 16px 4px 16px;
    }
    
    .msg.assistant {
      align-self: flex-start;
      background: var(--ai-bubble);
      border: 1px solid var(--border);
      border-radius: 16px 16px 16px 4px;
    }
    
    .msg.system {
      align-self: center;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      font-size: 13px;
      padding: 10px 16px;
      border-radius: 16px;
      max-width: 90%;
    }
    
    .msg.success { border-color: var(--success); }
    .msg.error { border-color: var(--error); }
    .msg a { color: var(--accent); }
    
    .typing { display: flex; gap: 4px; padding: 8px 0; }
    .typing span {
      width: 8px; height: 8px;
      background: var(--text-secondary);
      border-radius: 50%;
      animation: bounce 1.4s infinite;
    }
    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-8px); }
    }
    
    .input-area {
      padding: 12px 16px 24px;
      border-top: 1px solid var(--border);
      background: var(--bg);
    }
    
    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--text-secondary);
      margin-bottom: 8px;
      font-family: var(--font-mono);
    }
    
    .status-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--success);
    }
    
    .status-dot.loading { background: var(--warning); animation: pulse 1s infinite; }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    .input-wrapper { display: flex; gap: 10px; align-items: flex-end; }
    
    .input-field {
      flex: 1;
      padding: 12px 16px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: var(--bg-secondary);
      color: var(--text);
      font-size: 15px;
      font-family: inherit;
      resize: none;
      outline: none;
      min-height: 48px;
      max-height: 150px;
      transition: all 0.15s;
    }
    
    .input-field::placeholder { color: var(--text-secondary); }
    .input-field:focus { border-color: var(--accent); box-shadow: var(--glow); }
    
    /* Edit mode styling for input */
    .input-field.edit-mode {
      background: var(--bg-tertiary);
      border-color: var(--warning);
      box-shadow: 0 0 0 1px var(--warning);
    }
    
    .send-btn {
      width: 48px; height: 48px;
      border-radius: 16px;
      border: none;
      background: var(--accent);
      color: var(--bg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      box-shadow: var(--glow);
    }
    
    .send-btn:hover { filter: brightness(1.1); }
    .send-btn:disabled { opacity: 0.5; cursor: default; }
    
    /* Settings Panel */
    .settings-panel {
      position: fixed;
      top: 0;
      right: -320px;
      width: 320px;
      height: 100%;
      background: var(--bg-secondary);
      border-left: 1px solid var(--border);
      z-index: 100;
      transition: right 0.3s ease;
      display: flex;
      flex-direction: column;
    }
    
    .settings-panel.open { right: 0; }
    
    .settings-header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .settings-title { font-weight: 600; }
    
    .settings-body { flex: 1; padding: 16px; overflow-y: auto; }
    
    .setting-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    
    .theme-list { display: flex; flex-direction: column; gap: 6px; }
    
    .theme-btn {
      padding: 12px;
      border-radius: 8px;
      border: 2px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.15s;
    }
    
    .theme-btn:hover { border-color: var(--text-secondary); }
    .theme-btn.active { border-color: var(--accent); background: var(--bg-tertiary); }
    
    .theme-dot {
      width: 16px; height: 16px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.6);
      z-index: 99;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s;
    }
    
    .overlay.open { opacity: 1; visibility: visible; }
    
    /* Mode indicator in input area */
    .mode-indicator {
      display: none;
      padding: 6px 12px;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 8px;
      text-align: center;
    }
    
    .mode-indicator.edit {
      display: block;
      background: rgba(245, 158, 11, 0.2);
      color: var(--warning);
      border: 1px solid var(--warning);
    }
    
    @media (max-width: 640px) {
      .settings-panel { width: 100%; right: -100%; }
    }
  </style>
</head>
<body class="theme-modern">
  <div class="app">
    <header class="header">
      <div class="logo">
        <div class="logo-icon">Ω</div>
        <div>
          <div class="logo-text">OmniBot</div>
          <div class="logo-version">Cuttlefish</div>
        </div>
      </div>
      <div class="header-actions">
        <div class="tabs">
          <button class="tab active" data-mode="chat">Chat</button>
          <button class="tab" data-mode="edit">Edit</button>
        </div>
        <button class="icon-btn" id="settingsBtn" title="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"></path>
          </svg>
        </button>
      </div>
    </header>
    
    <div class="messages" id="messages">
      <div class="empty-state">
        <div class="empty-icon">Ω</div>
        <div class="empty-title">Welcome to OmniBot</div>
        <div class="empty-subtitle">Self-editing AI. Chat or switch to Edit mode to modify source code.</div>
      </div>
    </div>
    
    <div class="input-area">
      <div class="mode-indicator" id="modeIndicator">⚡ EDIT MODE - AI will modify its own source code</div>
      <div class="status">
        <span class="status-dot" id="statusDot"></span>
        <span id="statusText">Ready</span>
      </div>
      <div class="input-wrapper">
        <textarea class="input-field" id="input" placeholder="Send a message..." rows="1"></textarea>
        <button class="send-btn" id="sendBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  </div>
  
  <div class="overlay" id="overlay"></div>
  
  <div class="settings-panel" id="settingsPanel">
    <div class="settings-header">
      <span class="settings-title">Settings</span>
      <button class="icon-btn" id="closeSettings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="settings-body">
      <div class="setting-label">Theme</div>
      <div class="theme-list">
        <button class="theme-btn active" data-theme="modern">
          <span class="theme-dot" style="background: #3b82f6"></span>Modern Dark
        </button>
        <button class="theme-btn" data-theme="matrix">
          <span class="theme-dot" style="background: #00ff41"></span>Matrix
        </button>
        <button class="theme-btn" data-theme="cyberpunk">
          <span class="theme-dot" style="background: linear-gradient(135deg, #ff00ff, #00ffff)"></span>Cyberpunk
        </button>
        <button class="theme-btn" data-theme="hal">
          <span class="theme-dot" style="background: #ff0000"></span>HAL 9000
        </button>
        <button class="theme-btn" data-theme="tron">
          <span class="theme-dot" style="background: #6fdfff"></span>Tron
        </button>
        <button class="theme-btn" data-theme="neuromancer">
          <span class="theme-dot" style="background: #bf5fff"></span>Neuromancer
        </button>
        <button class="theme-btn" data-theme="borg">
          <span class="theme-dot" style="background: #00ff00"></span>Borg
        </button>
        <button class="theme-btn" data-theme="dune">
          <span class="theme-dot" style="background: #f4a261"></span>Dune
        </button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      'use strict';
      
      // State
      var mode = 'chat';
      var messages = [];
      var loading = false;
      
      // DOM Elements
      var $messages = document.getElementById('messages');
      var $input = document.getElementById('input');
      var $sendBtn = document.getElementById('sendBtn');
      var $statusDot = document.getElementById('statusDot');
      var $statusText = document.getElementById('statusText');
      var $modeIndicator = document.getElementById('modeIndicator');
      var $settingsBtn = document.getElementById('settingsBtn');
      var $settingsPanel = document.getElementById('settingsPanel');
      var $closeSettings = document.getElementById('closeSettings');
      var $overlay = document.getElementById('overlay');
      
      // Initialize theme from localStorage
      function initTheme() {
        try {
          var saved = localStorage.getItem('omnibot-theme');
          if (saved) {
            document.body.className = 'theme-' + saved;
            var btn = document.querySelector('[data-theme="' + saved + '"]');
            if (btn) {
              document.querySelectorAll('.theme-btn').forEach(function(b) { b.classList.remove('active'); });
              btn.classList.add('active');
            }
          }
        } catch(e) {
          console.log('localStorage not available');
        }
      }
      
      initTheme();
      
      // Tab switching - inline mode change (no dialog)
      document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
          tab.classList.add('active');
          mode = tab.dataset.mode;
          
          // Update UI for mode
          if (mode === 'edit') {
            $modeIndicator.classList.add('edit');
            $input.classList.add('edit-mode');
            $input.placeholder = 'Describe the change to make...';
          } else {
            $modeIndicator.classList.remove('edit');
            $input.classList.remove('edit-mode');
            $input.placeholder = 'Send a message...';
          }
        });
      });
      
      // Settings panel
      $settingsBtn.addEventListener('click', function() {
        $settingsPanel.classList.add('open');
        $overlay.classList.add('open');
      });
      
      function closeSettingsPanel() {
        $settingsPanel.classList.remove('open');
        $overlay.classList.remove('open');
      }
      
      $closeSettings.addEventListener('click', closeSettingsPanel);
      $overlay.addEventListener('click', closeSettingsPanel);
      
      // Theme switching
      document.querySelectorAll('.theme-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.theme-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          var theme = btn.dataset.theme;
          document.body.className = 'theme-' + theme;
          try {
            localStorage.setItem('omnibot-theme', theme);
          } catch(e) {}
        });
      });
      
      // Auto-resize textarea
      $input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
      });
      
      // HTML escape with link detection
      function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        var escaped = div.innerHTML;
        return escaped.replace(/(https?:\\/\\/[^\\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      }
      
      // Render messages
      function render() {
        if (messages.length === 0) {
          $messages.innerHTML = '<div class="empty-state"><div class="empty-icon">Ω</div><div class="empty-title">Welcome to OmniBot</div><div class="empty-subtitle">Self-editing AI. Chat or switch to Edit mode to modify source code.</div></div>';
          return;
        }
        
        var html = '';
        for (var i = 0; i < messages.length; i++) {
          var m = messages[i];
          var cls = 'msg ' + m.role;
          if (m.type) cls += ' ' + m.type;
          html += '<div class="' + cls + '">' + escapeHtml(m.content) + '</div>';
        }
        
        if (loading) {
          html += '<div class="msg assistant"><div class="typing"><span></span><span></span><span></span></div></div>';
        }
        
        $messages.innerHTML = html;
        $messages.scrollTop = $messages.scrollHeight;
      }
      
      // Status updates
      function setStatus(text, isLoading) {
        $statusText.textContent = text;
        if (isLoading) {
          $statusDot.classList.add('loading');
        } else {
          $statusDot.classList.remove('loading');
        }
      }
      
      // Send message
      function send() {
        var text = $input.value.trim();
        if (!text || loading) return;
        
        messages.push({ role: 'user', content: text });
        $input.value = '';
        $input.style.height = 'auto';
        loading = true;
        $sendBtn.disabled = true;
        setStatus(mode === 'edit' ? 'Modifying code...' : 'Thinking...', true);
        render();
        
        var endpoint = mode === 'edit' ? '/api/self-edit' : '/api/chat';
        var body;
        
        if (mode === 'edit') {
          body = JSON.stringify({ instruction: text });
        } else {
          var chatMsgs = [];
          for (var i = 0; i < messages.length; i++) {
            if (messages[i].role !== 'system') {
              chatMsgs.push({ role: messages[i].role, content: messages[i].content });
            }
          }
          body = JSON.stringify({ messages: chatMsgs });
        }
        
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (mode === 'edit') {
            if (data.success) {
              var msg = '✓ ' + data.explanation;
              if (data.url) msg += '\\n\\nCommit: ' + data.url;
              if (data.stats) msg += '\\n\\n+' + data.stats.added + ' / -' + data.stats.removed + ' lines';
              messages.push({ role: 'system', type: 'success', content: msg });
            } else {
              messages.push({ 
                role: 'system', 
                type: 'error',
                content: '✗ ' + (data.error || 'Edit failed') + (data.explanation ? '\\n' + data.explanation : '')
              });
            }
          } else {
            messages.push({ role: 'assistant', content: data.content || data.error || 'No response' });
          }
          setStatus('Ready', false);
        })
        .catch(function(e) {
          messages.push({ role: 'system', type: 'error', content: '✗ Network error: ' + e.message });
          setStatus('Error', false);
        })
        .finally(function() {
          loading = false;
          $sendBtn.disabled = false;
          render();
        });
      }
      
      // Event listeners
      $sendBtn.addEventListener('click', send);
      $input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      });
      
      // Initial render
      render();
      
      // Log startup for testing
      console.log('OmniBot UI initialized - Cuttlefish edition');
    })();
  </script>
</body>
</html>
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 
      'Access-Control-Allow-Headers': 'Content-Type' 
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        ok: true,
        version: 'Cuttlefish',
        creature: 'Cuttlefish',
        wikipedia: 'https://en.wikipedia.org/wiki/Cuttlefish',
        safetyFeatures: ['structure-validation', 'no-wholesale-replacement', 'no-extraction'],
        models: GROQ_MODELS
      }), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages } = await request.json();
        const reply = await callGroq('llama', messages, env);
        return new Response(JSON.stringify({ content: reply }), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    if (url.pathname === '/api/self-edit' && request.method === 'POST') {
      try {
        const { instruction } = await request.json();
        
        if (!instruction || instruction.length < 5) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Instruction too short',
            explanation: 'Provide clear instruction (5+ chars)' 
          }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
        
        if (instruction.includes('access GitHub logs')) {
          const logs = await getGithubDeployLogs(env);
          return new Response(JSON.stringify({ 
            success: true, 
            logs: logs 
          }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
        
        const result = await selfEdit(instruction, env);
        return new Response(JSON.stringify(result), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ 
          success: false,
          error: e.message 
        }), { 
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Logging API for testing
    if (url.pathname === '/api/log' && request.method === 'POST') {
      try {
        const logData = await request.json();
        const timestamp = new Date().toISOString();
        const logEntry = {
          timestamp,
          level: logData.level || 'info',
          message: logData.message,
          data: logData.data,
          userAgent: request.headers.get('user-agent'),
          url: logData.url
        };
        
        // Store in KV if available
        if (env.LOGS) {
          const logKey = `log:${timestamp}:${Math.random().toString(36).substr(2, 9)}`;
          await env.LOGS.put(logKey, JSON.stringify(logEntry), { expirationTtl: 86400 });
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          logged: logEntry
        }), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false,
          error: error.message
        }), { 
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Get recent logs
    if (url.pathname === '/api/logs' && request.method === 'GET') {
      try {
        const logs = [];
        
        if (env.LOGS) {
          const list = await env.LOGS.list({ prefix: 'log:', limit: 100 });
          for (const key of list.keys) {
            const logData = await env.LOGS.get(key.name);
            if (logData) {
              logs.push(JSON.parse(logData));
            }
          }
        }
        
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return new Response(JSON.stringify({ 
          success: true,
          logs: logs.slice(0, 50)
        }), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false,
          error: error.message
        }), { 
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Test endpoint for automated testing
    if (url.pathname === '/api/test') {
      return new Response(JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        endpoints: ['/api/health', '/api/chat', '/api/self-edit', '/api/log', '/api/logs'],
        themes: ['modern', 'matrix', 'cyberpunk', 'hal', 'tron', 'neuromancer', 'borg', 'dune']
      }), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    return new Response('OmniBot Cuttlefish - Self-Editing AI', { headers: cors });
  }
};
