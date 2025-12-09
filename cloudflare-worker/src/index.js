/**
 * OmniBot - Electric Eel Edition
 * https://en.wikipedia.org/wiki/Electric_eel
 * 
 * Semantic versioning via exotic sea creatures (alphabetical):
 * A: Axolotl, B: Blobfish, C: Cuttlefish, D: Dumbo Octopus, E: Electric Eel
 * 
 * Current: Electric Eel (E) - Simple Google OAuth Redirect Login
 * 
 * NEW: Proper OAuth 2.0 redirect flow
 * - /auth/google → redirects to Google
 * - /auth/callback → handles response, sets cookie
 * - Cookie-based session (24hr)
 */

const GITHUB_REPO = 'thejonanshow/omnibot';
const GITHUB_API_URL = 'https://api.github.com';
const ALLOWED_EMAIL = 'jonanscheffler@gmail.com';
const VERSION = 'Electric Eel';

const GROQ_MODELS = {
  qwen: 'qwen2.5-coder-32k-instruct',
  llama: 'llama-3.3-70b-versatile'
};

const REQUIRED_FUNCTIONS = [
  'async function selfEdit',
  'async function callGroq',
  'async function githubGet',
  'async function githubPut',
  'export default'
];

const DEFAULT_MASTER_PROMPT = `You are OmniBot, a self-editing AI assistant.

Project Context:
- Repository: thejonanshow/omnibot
- Platform: Cloudflare Workers
- LLM Provider: Groq (Llama 3.3 70B, Qwen 2.5)
- Version: ${VERSION}

Capabilities:
- Chat with users
- Edit your own source code
- Access shared context via KV
- Full safety validation before commits

Rules:
- Never remove required functions
- Always preserve HTML UI
- Code must work in Cloudflare Workers (no browser APIs in runtime)
- Validate all changes before committing`;

// ============== GOOGLE OAUTH ==============
function getGoogleAuthUrl(env, redirectUri) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'online',
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCodeForToken(code, env, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });
  return res.json();
}

async function getGoogleUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.json();
}

function createSessionToken(email) {
  // Simple session: base64 of email + timestamp + expiry
  const expiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  const payload = JSON.stringify({ email, expiry });
  return btoa(payload);
}

function validateSession(token) {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.expiry > Date.now() && payload.email === ALLOWED_EMAIL) {
      return { valid: true, email: payload.email };
    }
  } catch (e) {}
  return { valid: false };
}

// ============== KV CONTEXT ==============
async function getContext(env) {
  if (!env.CONTEXT) return { prompt: DEFAULT_MASTER_PROMPT, data: {} };
  
  try {
    const prompt = await env.CONTEXT.get('master_prompt') || DEFAULT_MASTER_PROMPT;
    const data = JSON.parse(await env.CONTEXT.get('shared_data') || '{}');
    const telemetry = JSON.parse(await env.CONTEXT.get('telemetry') || '{}');
    return { prompt, data, telemetry };
  } catch (e) {
    return { prompt: DEFAULT_MASTER_PROMPT, data: {}, telemetry: {} };
  }
}

async function setContext(key, value, env) {
  if (!env.CONTEXT) return false;
  try {
    await env.CONTEXT.put(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

async function logTelemetry(event, data, env) {
  if (!env.CONTEXT) return;
  
  try {
    const telemetry = JSON.parse(await env.CONTEXT.get('telemetry') || '{}');
    const now = new Date().toISOString();
    
    if (!telemetry.events) telemetry.events = [];
    telemetry.events.unshift({ timestamp: now, event, data });
    telemetry.events = telemetry.events.slice(0, 100);
    
    if (!telemetry.stats) telemetry.stats = {};
    telemetry.stats[event] = (telemetry.stats[event] || 0) + 1;
    telemetry.stats.lastActivity = now;
    
    const context = await env.CONTEXT.get('shared_data') || '';
    telemetry.stats.contextSize = context.length;
    telemetry.stats.contextWords = context.split(/\s+/).filter(w => w).length;
    
    await env.CONTEXT.put('telemetry', JSON.stringify(telemetry));
  } catch (e) {
    console.error('Telemetry error:', e);
  }
}

// ============== GITHUB ==============
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

// ============== GROQ ==============
async function callGroq(model, messages, env, systemPrompt = null) {
  const context = await getContext(env);
  const fullSystemPrompt = systemPrompt 
    ? `${context.prompt}\n\n${systemPrompt}`
    : context.prompt;
  
  const fullMessages = [
    { role: 'system', content: fullSystemPrompt },
    ...messages
  ];
    
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

// ============== CODE VALIDATION ==============
function validateCodeStructure(code) {
  const missing = [];
  
  for (const required of REQUIRED_FUNCTIONS) {
    if (!code.includes(required)) {
      missing.push(required);
    }
  }
  
  if (missing.length > 0) {
    return { valid: false, reason: `Missing required functions: ${missing.join(', ')}` };
  }
  
  if (code.length < 5000) {
    return { valid: false, reason: `Code too short (${code.length} chars) - appears to be partial` };
  }
  
  if (!code.includes('const HTML =') && !code.includes('<html>')) {
    return { valid: false, reason: 'Missing HTML UI - structure destroyed' };
  }
  
  return { valid: true };
}

function cleanCodeFences(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:javascript|js)?\s*\n?/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  return cleaned;
}

// ============== SELF EDIT ==============
async function generateWithLlama(instruction, currentCode, env) {
  const context = await getContext(env);
  
  const systemPrompt = `You are modifying Cloudflare Worker code.

${context.prompt}

Shared Context:
${JSON.stringify(context.data, null, 2)}

OUTPUT ONLY THE COMPLETE MODIFIED CODE.
NO explanations, NO markdown fences, NO "here's the code".
Just the raw JavaScript code starting with /** and ending with the closing };`;

  const userPrompt = `Current code (${currentCode.length} chars):

\`\`\`javascript
${currentCode}
\`\`\`

Change: ${instruction}

Output the COMPLETE modified code:`;

  return await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
}

async function selfEdit(instruction, env, streamCallback = null) {
  try {
    await logTelemetry('edit_start', { instruction }, env);
    
    if (streamCallback) streamCallback({ status: 'reading', message: 'Reading current code...' });
    
    const file = await githubGet('cloudflare-worker/src/index.js', env);
    if (!file.content) {
      return { success: false, error: 'Could not read code', explanation: 'GitHub API failed' };
    }
    
    const currentCode = decodeURIComponent(escape(atob(file.content)));
    
    if (streamCallback) streamCallback({ status: 'generating', message: 'AI is modifying code...' });
    
    const response = await generateWithLlama(instruction, currentCode, env);
    const finalCode = cleanCodeFences(response);
    
    if (streamCallback) streamCallback({ status: 'validating', message: 'Validating changes...' });
    
    const validation = validateCodeStructure(finalCode);
    if (!validation.valid) {
      await logTelemetry('edit_failed', { reason: validation.reason }, env);
      return { success: false, error: 'Safety check failed', explanation: validation.reason };
    }
    
    if (currentCode.replace(/\s/g, '') === finalCode.replace(/\s/g, '')) {
      return { success: false, error: 'No changes made', explanation: 'Generated code identical to current' };
    }
    
    if (streamCallback) streamCallback({ status: 'committing', message: 'Committing to GitHub...' });
    
    const commitMessage = `[OmniBot] ${instruction.slice(0, 72)}`;
    const result = await githubPut('cloudflare-worker/src/index.js', finalCode, commitMessage, env);
    
    if (!result.commit) {
      return { success: false, error: result.message || 'Commit failed', explanation: 'GitHub rejected commit' };
    }
    
    await logTelemetry('edit_success', { 
      instruction, 
      commit: result.commit.sha,
      oldSize: currentCode.length,
      newSize: finalCode.length 
    }, env);
    
    return {
      success: true,
      explanation: `Modified code based on: ${instruction}`,
      commit: result.commit.sha,
      url: result.commit.html_url,
      stats: { oldSize: currentCode.length, newSize: finalCode.length }
    };
    
  } catch (e) {
    await logTelemetry('edit_error', { error: e.message }, env);
    return { success: false, error: e.message, explanation: 'Pipeline error' };
  }
}

// ============== HTML UI ==============
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OmniBot - Electric Eel</title>
  <link href="https://fonts.googleapis.com/css2?family=Antonio:wght@400;700&family=Orbitron:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --lcars-orange: #ff9900;
      --lcars-blue: #99ccff;
      --lcars-purple: #cc99cc;
      --lcars-red: #cc6666;
      --lcars-tan: #ffcc99;
      --lcars-gold: #ffcc00;
      --lcars-bg: #000000;
      --lcars-text: #ff9900;
      --lcars-cyan: #00ccff;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      height: 100%;
      font-family: 'Antonio', sans-serif;
      background: var(--lcars-bg);
      color: var(--lcars-text);
      overflow: hidden;
    }
    
    .login-screen {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 40px;
    }
    
    .login-logo {
      font-family: 'Orbitron', sans-serif;
      font-size: 48px;
      font-weight: 700;
      color: var(--lcars-cyan);
      text-shadow: 0 0 20px var(--lcars-cyan);
      animation: glow 2s ease-in-out infinite;
    }
    
    @keyframes glow {
      0%, 100% { text-shadow: 0 0 20px var(--lcars-cyan); }
      50% { text-shadow: 0 0 40px var(--lcars-cyan), 0 0 60px var(--lcars-cyan); }
    }
    
    .login-subtitle {
      font-size: 18px;
      color: var(--lcars-orange);
      letter-spacing: 4px;
      text-transform: uppercase;
    }
    
    .login-btn {
      display: flex;
      align-items: center;
      gap: 16px;
      background: linear-gradient(135deg, var(--lcars-blue), var(--lcars-cyan));
      border: none;
      padding: 20px 40px;
      border-radius: 50px;
      font-family: inherit;
      font-size: 20px;
      font-weight: 700;
      color: #000;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.3s;
      box-shadow: 0 4px 20px rgba(0, 204, 255, 0.3);
    }
    
    .login-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 30px rgba(0, 204, 255, 0.5);
    }
    
    .login-btn svg {
      width: 24px;
      height: 24px;
    }
    
    .version-tag {
      position: fixed;
      bottom: 20px;
      font-size: 12px;
      color: var(--lcars-purple);
      letter-spacing: 2px;
    }
    
    /* Main app styles */
    .lcars-frame {
      height: 100%;
      display: grid;
      grid-template-columns: 120px 1fr;
      grid-template-rows: 80px 1fr 60px;
      gap: 4px;
      padding: 4px;
    }
    
    .lcars-sidebar {
      grid-row: 1 / -1;
      background: var(--lcars-orange);
      border-radius: 0 0 0 40px;
      display: flex;
      flex-direction: column;
    }
    
    .lcars-sidebar-top {
      height: 80px;
      background: var(--lcars-purple);
      border-radius: 0 0 0 40px;
    }
    
    .lcars-sidebar-content {
      flex: 1;
      padding: 20px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .lcars-btn {
      background: var(--lcars-blue);
      border: none;
      padding: 12px 8px;
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #000;
      cursor: pointer;
      border-radius: 0 20px 20px 0;
      margin-right: 20px;
      transition: all 0.1s;
    }
    
    .lcars-btn:hover { filter: brightness(1.2); }
    .lcars-btn.active { background: var(--lcars-gold); }
    .lcars-btn.danger { background: var(--lcars-red); }
    
    .lcars-header {
      display: flex;
      align-items: stretch;
      gap: 4px;
    }
    
    .lcars-header-curve {
      width: 80px;
      background: var(--lcars-purple);
      border-radius: 0 0 40px 0;
    }
    
    .lcars-header-bar {
      flex: 1;
      background: var(--lcars-tan);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
    }
    
    .lcars-title {
      font-size: 28px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: #000;
    }
    
    .lcars-user {
      background: var(--lcars-cyan);
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      color: #000;
    }
    
    .lcars-header-end {
      width: 40px;
      background: var(--lcars-orange);
      border-radius: 20px;
    }
    
    .lcars-main {
      background: #111;
      border: 3px solid var(--lcars-orange);
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .msg {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.5;
    }
    
    .msg.user {
      align-self: flex-end;
      background: var(--lcars-blue);
      color: #000;
    }
    
    .msg.assistant {
      align-self: flex-start;
      background: #222;
      border-left: 3px solid var(--lcars-orange);
    }
    
    .msg.system {
      align-self: center;
      background: #1a1a1a;
      border: 1px solid var(--lcars-purple);
      font-size: 12px;
    }
    
    .msg.success { border-color: var(--lcars-cyan); color: var(--lcars-cyan); }
    .msg.error { border-color: var(--lcars-red); color: var(--lcars-red); }
    
    .input-bar {
      display: flex;
      gap: 8px;
      padding: 12px;
      background: #0a0a0a;
      border-top: 2px solid var(--lcars-orange);
    }
    
    .input-bar input {
      flex: 1;
      background: #111;
      border: 2px solid var(--lcars-blue);
      border-radius: 8px;
      padding: 12px 16px;
      font-family: inherit;
      font-size: 14px;
      color: var(--lcars-text);
    }
    
    .input-bar input:focus {
      outline: none;
      border-color: var(--lcars-cyan);
    }
    
    .input-bar input.edit-mode {
      border-color: var(--lcars-gold);
    }
    
    .input-bar button {
      background: var(--lcars-orange);
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      color: #000;
      cursor: pointer;
    }
    
    .lcars-footer {
      display: flex;
      align-items: stretch;
      gap: 4px;
    }
    
    .lcars-footer-curve {
      width: 80px;
      background: var(--lcars-purple);
      border-radius: 0 40px 0 0;
    }
    
    .lcars-footer-bar {
      flex: 1;
      background: var(--lcars-tan);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 20px;
    }
    
    .stat { font-size: 14px; font-weight: 700; color: #000; }
    
    .edit-status {
      display: none;
      align-items: center;
      gap: 8px;
    }
    
    .edit-status.active { display: flex; }
    
    .edit-status-dot {
      width: 10px;
      height: 10px;
      background: var(--lcars-cyan);
      border-radius: 50%;
      animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    
    .lcars-footer-end {
      width: 60px;
      background: var(--lcars-orange);
      border-radius: 20px 0 0 0;
    }
    
    .hidden { display: none !important; }
    
    /* Modal */
    .modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.9);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .modal.open { display: flex; }
    
    .modal-content {
      background: #111;
      border: 3px solid var(--lcars-orange);
      border-radius: 20px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .modal-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--lcars-orange);
    }
    
    .modal-close {
      background: var(--lcars-red);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 18px;
      cursor: pointer;
      color: #000;
    }
    
    .modal textarea {
      width: 100%;
      min-height: 200px;
      background: #0a0a0a;
      border: 2px solid var(--lcars-blue);
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      color: var(--lcars-text);
      resize: vertical;
    }
    
    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }
    
    .modal-btn {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    
    .modal-btn.primary { background: var(--lcars-cyan); color: #000; }
    .modal-btn.secondary { background: var(--lcars-purple); color: #000; }
    
    .telemetry-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .telemetry-card {
      background: #1a1a1a;
      border: 1px solid var(--lcars-blue);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    
    .telemetry-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--lcars-cyan);
    }
    
    .telemetry-label {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--lcars-purple);
    }
    
    .event-list {
      max-height: 200px;
      overflow-y: auto;
    }
    
    .event-item {
      padding: 8px;
      border-bottom: 1px solid #333;
      font-size: 11px;
      font-family: monospace;
    }
    
    /* Full screen button */
    .full-screen-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: var(--lcars-orange);
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      color: #000;
      cursor: pointer;
    }
    
    .full-screen-btn:hover {
      background: var(--lcars-gold);
    }
  </style>
</head>
<body>
  <!-- Login Screen -->
  <div id="loginScreen" class="login-screen">
    <div class="login-logo">OMNIBOT</div>
    <div class="login-subtitle">Electric Eel Edition</div>
    <a href="/auth/google" class="login-btn">
      <svg viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Sign in with Google
    </a>
    <div class="version-tag">v5.0 ELECTRIC EEL</div>
  </div>

  <!-- Main App (hidden until logged in) -->
  <div id="mainApp" class="lcars-frame hidden">
    <button class="full-screen-btn" id="fullScreenBtn">Full Screen</button>
    <div class="lcars-sidebar">
      <div class="lcars-sidebar-top"></div>
      <div class="lcars-sidebar-content">
        <button class="lcars-btn active" data-mode="chat">Chat</button>
        <button class="lcars-btn" data-mode="edit">Edit</button>
        <button class="lcars-btn" data-view="telemetry">Stats</button>
        <button class="lcars-btn" data-view="context">Context</button>
        <button class="lcars-btn" data-view="prompt">Prompt</button>
        <button class="lcars-btn danger" id="logoutBtn">Logout</button>
      </div>
    </div>
    
    <div class="lcars-header">
      <div class="lcars-header-curve"></div>
      <div class="lcars-header-bar">
        <span class="lcars-title">OmniBot</span>
        <span id="userEmail" class="lcars-user">...</span>
      </div>
      <div class="lcars-header-end"></div>
    </div>
    
    <div class="lcars-main">
      <div id="messages" class="messages"></div>
      <div class="input-bar">
        <input type="text" id="input" placeholder="Enter command...">
        <button id="sendBtn">Send</button>
      </div>
    </div>
    
    <div class="lcars-footer">
      <div class="lcars-footer-curve"></div>
      <div class="lcars-footer-bar">
        <span id="statContext" class="stat">Context: 0 words</span>
        <span id="statEdits" class="stat">Edits: 0</span>
        <div id="editStatus" class="edit-status">
          <div class="edit-status-dot"></div>
          <span id="editStatusText">Processing...</span>
        </div>
      </div>
      <div class="lcars-footer-end"></div>
    </div>
  </div>

  <!-- Modals -->
  <div id="telemetryModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Telemetry</span>
        <button class="modal-close" onclick="closeModal('telemetryModal')">×</button>
      </div>
      <div id="telemetryGrid" class="telemetry-grid"></div>
      <div id="eventList" class="event-list"></div>
    </div>
  </div>

  <div id="contextModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Shared Context</span>
        <button class="modal-close" onclick="closeModal('contextModal')">×</button>
      </div>
      <textarea id="contextData"></textarea>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="closeModal('contextModal')">Cancel</button>
        <button class="modal-btn primary" onclick="saveContext()">Save</button>
      </div>
    </div>
  </div>

  <div id="promptModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Master Prompt</span>
        <button class="modal-close" onclick="closeModal('promptModal')">×</button>
      </div>
      <textarea id="masterPrompt"></textarea>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="closeModal('promptModal')">Cancel</button>
        <button class="modal-btn primary" onclick="savePrompt()">Save</button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      const $loginScreen = document.getElementById('loginScreen');
      const $mainApp = document.getElementById('mainApp');
      const $messages = document.getElementById('messages');
      const $input = document.getElementById('input');
      const $sendBtn = document.getElementById('sendBtn');
      const $userEmail = document.getElementById('userEmail');
      const $editStatus = document.getElementById('editStatus');
      const $editStatusText = document.getElementById('editStatusText');
      const $fullScreenBtn = document.getElementById('fullScreenBtn');
      
      let mode = 'chat';
      let messages = [];
      let loading = false;
      
      // Check for session cookie
      function getSession() {
        const match = document.cookie.match(/omnibot_session=([^;]+)/);
        return match ? match[1] : null;
      }
      
      function setSession(token) {
        document.cookie = 'omnibot_session=' + token + '; path=/; max-age=' + (24*60*60) + '; SameSite=Lax';
      }
      
      function clearSession() {
        document.cookie = 'omnibot_session=; path=/; max-age=0';
      }
      
      // Check URL for auth callback
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('session');
      const userEmail = urlParams.get('email');
      
      if (sessionToken && userEmail) {
        // Coming back from OAuth
        setSession(sessionToken);
        window.history.replaceState({}, '', '/');
        showApp(userEmail);
      } else if (getSession()) {
        // Already have session - verify it
        fetch('/api/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: getSession() })
        })
        .then(r => r.json())
        .then(data => {
          if (data.valid) {
            showApp(data.email);
          } else {
            clearSession();
            showLogin();
          }
        })
        .catch(() => {
          clearSession();
          showLogin();
        });
      } else {
        showLogin();
      }
      
      function showLogin() {
        $loginScreen.classList.remove('hidden');
        $mainApp.classList.add('hidden');
      }
      
      function showApp(email) {
        $loginScreen.classList.add('hidden');
        $mainApp.classList.remove('hidden');
        $userEmail.textContent = email;
        loadStats();
      }
      
      // Logout
      document.getElementById('logoutBtn').onclick = function() {
        clearSession();
        showLogin();
      };
      
      // Mode switching
      document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.onclick = function() {
          document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          mode = btn.dataset.mode;
          $input.classList.toggle('edit-mode', mode === 'edit');
          $input.placeholder = mode === 'edit' ? 'Describe the change...' : 'Enter command...';
        };
      });
      
      // View modals
      document.querySelectorAll('[data-view]').forEach(btn => {
        btn.onclick = function() {
          const view = btn.dataset.view;
          openModal(view + 'Modal');
          if (view === 'telemetry') loadTelemetry();
          if (view === 'context') loadContext();
          if (view === 'prompt') loadPrompt();
        };
      });
      
      function openModal(id) {
        document.getElementById(id).classList.add('open');
      }
      
      window.closeModal = function(id) {
        document.getElementById(id).classList.remove('open');
      };
      
      function addMessage(role, content, type) {
        messages.push({ role, content, type });
        render();
      }
      
      function render() {
        let html = '';
        for (const m of messages) {
          let cls =