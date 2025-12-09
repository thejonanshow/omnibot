/**
 * OmniBot - Dumbo Octopus Edition
 * https://en.wikipedia.org/wiki/Grimpoteuthis
 * 
 * Semantic versioning via exotic sea creatures (alphabetical):
 * A: Axolotl, B: Blobfish, C: Cuttlefish, D: Dumbo Octopus...
 * 
 * Current: Dumbo Octopus (D) - Star Trek LCARS UI, Google Auth, Live Updates
 * 
 * Features:
 * - LCARS-style Star Trek TNG interface
 * - Google OAuth for jonanscheffler@gmail.com
 * - Live streaming edit updates
 * - Staging/Production visual indicators
 * - Full telemetry dashboard
 * - KV context viewer & editor
 * - Master prompt configuration
 * - All AIs get full context from KV
 */

const GITHUB_REPO = 'thejonanshow/omnibot';
const GITHUB_API_URL = 'https://api.github.com';
const ALLOWED_EMAIL = 'jonanscheffler@gmail.com';
const VERSION = 'Dumbo Octopus';

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

// Default master prompt for all AI operations
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
    telemetry.events = telemetry.events.slice(0, 100); // Keep last 100 events
    
    // Update stats
    if (!telemetry.stats) telemetry.stats = {};
    telemetry.stats[event] = (telemetry.stats[event] || 0) + 1;
    telemetry.stats.lastActivity = now;
    
    // Track context size
    const context = await env.CONTEXT.get('shared_data') || '';
    telemetry.stats.contextSize = context.length;
    telemetry.stats.contextWords = context.split(/\s+/).filter(w => w).length;
    
    await env.CONTEXT.put('telemetry', JSON.stringify(telemetry));
  } catch (e) {
    console.error('Telemetry error:', e);
  }
}

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
  // Get master prompt from context
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

function validateCodeStructure(code) {
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
  
  if (code.length < 5000) {
    return {
      valid: false,
      reason: `Code too short (${code.length} chars) - appears to be partial or replacement`
    };
  }
  
  if (!code.includes('const HTML =') && !code.includes('<html>')) {
    return {
      valid: false,
      reason: 'Missing HTML UI - structure destroyed'
    };
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
      return {
        success: false,
        error: 'Safety check failed',
        explanation: validation.reason
      };
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
      stats: {
        oldSize: currentCode.length,
        newSize: finalCode.length
      }
    };
    
  } catch (e) {
    await logTelemetry('edit_error', { error: e.message }, env);
    return { success: false, error: e.message, explanation: 'Pipeline error' };
  }
}

async function verifyGoogleToken(token, env) {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const data = await res.json();
    
    if (data.email === ALLOWED_EMAIL && data.email_verified === 'true') {
      return { valid: true, email: data.email };
    }
    return { valid: false, reason: 'Unauthorized email' };
  } catch (e) {
    return { valid: false, reason: e.message };
  }
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OmniBot - LCARS Interface</title>
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
      --env-color: #ff9900;
    }
    
    body.staging { --env-color: #ffcc00; }
    body.production { --env-color: #cc6666; }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      height: 100%;
      font-family: 'Antonio', sans-serif;
      background: var(--lcars-bg);
      color: var(--lcars-text);
      overflow: hidden;
    }
    
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
    
    .lcars-env {
      background: var(--env-color);
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      color: #000;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
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
      animation: fadeIn 0.2s;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .msg.user {
      align-self: flex-end;
      background: var(--lcars-blue);
      color: #000;
    }
    
    .msg.assistant {
      align-self: flex-start;
      background: #222;
      border: 1px solid var(--lcars-orange);
    }
    
    .msg.system {
      align-self: center;
      background: var(--lcars-purple);
      color: #000;
      font-size: 12px;
    }
    
    .msg.success { border-color: #0f0; background: #001100; }
    .msg.error { border-color: var(--lcars-red); background: #110000; }
    
    .edit-status {
      padding: 8px 20px;
      background: #222;
      border-top: 2px solid var(--lcars-orange);
      font-size: 12px;
      display: none;
    }
    
    .edit-status.active {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .edit-status-dot {
      width: 8px;
      height: 8px;
      background: var(--lcars-gold);
      border-radius: 50%;
      animation: blink 0.5s infinite;
    }
    
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    
    .input-area {
      padding: 12px 20px;
      background: #111;
      border-top: 3px solid var(--lcars-orange);
      display: flex;
      gap: 12px;
    }
    
    .input-field {
      flex: 1;
      background: #000;
      border: 2px solid var(--lcars-blue);
      border-radius: 4px;
      padding: 12px 16px;
      font-family: inherit;
      font-size: 14px;
      color: var(--lcars-text);
      outline: none;
      resize: none;
    }
    
    .input-field:focus {
      border-color: var(--lcars-gold);
    }
    
    .input-field.edit-mode {
      border-color: var(--lcars-red);
    }
    
    .send-btn {
      background: var(--lcars-orange);
      border: none;
      border-radius: 4px;
      padding: 12px 24px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      color: #000;
      cursor: pointer;
    }
    
    .send-btn:hover { filter: brightness(1.2); }
    .send-btn:disabled { opacity: 0.5; }
    
    .lcars-footer {
      display: flex;
      align-items: stretch;
      gap: 4px;
    }
    
    .lcars-footer-curve {
      width: 80px;
      background: var(--lcars-blue);
      border-radius: 0 40px 0 0;
    }
    
    .lcars-footer-bar {
      flex: 1;
      background: var(--lcars-purple);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 20px;
    }
    
    .lcars-stat {
      font-size: 12px;
      color: #000;
      font-weight: 700;
      text-transform: uppercase;
    }
    
    .lcars-footer-end {
      width: 40px;
      background: var(--lcars-tan);
      border-radius: 20px 0 0 0;
    }
    
    /* Modal styles */
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.9);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    
    .modal.open { display: flex; }
    
    .modal-content {
      background: #111;
      border: 3px solid var(--lcars-orange);
      border-radius: 20px;
      width: 90%;
      max-width: 800px;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .modal-header {
      background: var(--lcars-orange);
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-title {
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      color: #000;
    }
    
    .modal-close {
      background: var(--lcars-red);
      border: none;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      font-size: 18px;
      color: #000;
      cursor: pointer;
    }
    
    .modal-body {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }
    
    .modal-textarea {
      width: 100%;
      min-height: 300px;
      background: #000;
      border: 2px solid var(--lcars-blue);
      border-radius: 4px;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: var(--lcars-text);
      resize: vertical;
    }
    
    .modal-footer {
      padding: 16px 20px;
      background: #222;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    
    .telemetry-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .telemetry-card {
      background: #222;
      border: 2px solid var(--lcars-blue);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    
    .telemetry-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--lcars-gold);
    }
    
    .telemetry-label {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--lcars-blue);
      margin-top: 4px;
    }
    
    .event-list {
      max-height: 300px;
      overflow-y: auto;
    }
    
    .event-item {
      padding: 8px 12px;
      border-bottom: 1px solid #333;
      font-size: 12px;
      font-family: monospace;
    }
    
    /* Auth overlay */
    .auth-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }
    
    .auth-overlay.hidden { display: none; }
    
    .auth-title {
      font-size: 48px;
      font-weight: 700;
      color: var(--lcars-orange);
      margin-bottom: 40px;
      text-transform: uppercase;
      letter-spacing: 8px;
    }
    
    .google-btn {
      background: var(--lcars-blue);
      border: none;
      padding: 16px 40px;
      font-family: inherit;
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      color: #000;
      cursor: pointer;
      border-radius: 8px;
    }
    
    .google-btn:hover { filter: brightness(1.2); }
    
    @media (max-width: 768px) {
      .lcars-frame {
        grid-template-columns: 80px 1fr;
        grid-template-rows: 60px 1fr 50px;
      }
      
      .lcars-title { font-size: 18px; }
      .lcars-btn { font-size: 9px; padding: 8px 4px; }
    }
  </style>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body class="staging">
  <div class="auth-overlay" id="authOverlay">
    <div class="auth-title">OmniBot</div>
    <div id="googleSignIn"></div>
  </div>

  <div class="lcars-frame">
    <div class="lcars-sidebar">
      <div class="lcars-sidebar-top"></div>
      <div class="lcars-sidebar-content">
        <button class="lcars-btn active" data-mode="chat">Chat</button>
        <button class="lcars-btn" data-mode="edit">Edit</button>
        <button class="lcars-btn" data-view="context">Context</button>
        <button class="lcars-btn" data-view="telemetry">Telemetry</button>
        <button class="lcars-btn" data-view="prompt">Prompt</button>
        <button class="lcars-btn danger" id="promoteBtn">Promote</button>
      </div>
    </div>
    
    <div class="lcars-header">
      <div class="lcars-header-curve"></div>
      <div class="lcars-header-bar">
        <div class="lcars-title">OmniBot</div>
        <div class="lcars-env" id="envBadge">STAGING</div>
      </div>
      <div class="lcars-header-end"></div>
    </div>
    
    <div class="lcars-main">
      <div class="messages" id="messages">
        <div class="msg system">Welcome to OmniBot - LCARS Interface. Authorized: jonanscheffler@gmail.com</div>
      </div>
      <div class="edit-status" id="editStatus">
        <div class="edit-status-dot"></div>
        <span id="editStatusText">Processing...</span>
      </div>
      <div class="input-area">
        <textarea class="input-field" id="input" placeholder="Enter command..." rows="1"></textarea>
        <button class="send-btn" id="sendBtn">ENGAGE</button>
      </div>
    </div>
    
    <div class="lcars-footer">
      <div class="lcars-footer-curve"></div>
      <div class="lcars-footer-bar">
        <span class="lcars-stat" id="statVersion">Version: Dumbo Octopus</span>
        <span class="lcars-stat" id="statContext">Context: 0 words</span>
        <span class="lcars-stat" id="statEdits">Edits: 0</span>
      </div>
      <div class="lcars-footer-end"></div>
    </div>
  </div>
  
  <!-- Context Modal -->
  <div class="modal" id="contextModal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Shared Context</span>
        <button class="modal-close" onclick="closeModal('contextModal')">×</button>
      </div>
      <div class="modal-body">
        <textarea class="modal-textarea" id="contextData" placeholder="Enter shared context data (JSON)..."></textarea>
      </div>
      <div class="modal-footer">
        <button class="lcars-btn" onclick="saveContext()">Save Context</button>
      </div>
    </div>
  </div>
  
  <!-- Telemetry Modal -->
  <div class="modal" id="telemetryModal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Telemetry Dashboard</span>
        <button class="modal-close" onclick="closeModal('telemetryModal')">×</button>
      </div>
      <div class="modal-body">
        <div class="telemetry-grid" id="telemetryGrid"></div>
        <h3 style="margin: 20px 0 10px; color: var(--lcars-orange);">Recent Events</h3>
        <div class="event-list" id="eventList"></div>
      </div>
    </div>
  </div>
  
  <!-- Prompt Modal -->
  <div class="modal" id="promptModal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Master Prompt</span>
        <button class="modal-close" onclick="closeModal('promptModal')">×</button>
      </div>
      <div class="modal-body">
        <textarea class="modal-textarea" id="masterPrompt" placeholder="Enter master prompt for all AI operations..."></textarea>
      </div>
      <div class="modal-footer">
        <button class="lcars-btn" onclick="savePrompt()">Save Prompt</button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      'use strict';
      
      let mode = 'chat';
      let messages = [];
      let loading = false;
      let authToken = null;
      let isProduction = window.location.hostname.includes('omnibot.') && !window.location.hostname.includes('staging');
      
      const $messages = document.getElementById('messages');
      const $input = document.getElementById('input');
      const $sendBtn = document.getElementById('sendBtn');
      const $editStatus = document.getElementById('editStatus');
      const $editStatusText = document.getElementById('editStatusText');
      const $envBadge = document.getElementById('envBadge');
      const $authOverlay = document.getElementById('authOverlay');
      const $promoteBtn = document.getElementById('promoteBtn');
      
      // Set environment
      if (isProduction) {
        document.body.classList.remove('staging');
        document.body.classList.add('production');
        $envBadge.textContent = 'PRODUCTION';
        $envBadge.style.background = 'var(--lcars-red)';
        $promoteBtn.style.display = 'none';
      }
      
      // Google Sign-In
      function initGoogleAuth() {
        if (typeof google === 'undefined') {
          setTimeout(initGoogleAuth, 100);
          return;
        }
        
        google.accounts.id.initialize({
          client_id: '107783640386-ja8kfg90o5hfkgdbbv1pg3s753r24mf7.apps.googleusercontent.com',
          callback: handleCredentialResponse
        });
        
        google.accounts.id.renderButton(
          document.getElementById('googleSignIn'),
          { theme: 'filled_black', size: 'large', text: 'signin_with' }
        );
      }
      
      function handleCredentialResponse(response) {
        authToken = response.credential;
        
        // Verify with backend
        fetch('/api/verify-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: authToken })
        })
        .then(r => r.json())
        .then(data => {
          if (data.valid) {
            $authOverlay.classList.add('hidden');
            loadStats();
          } else {
            alert('Unauthorized: ' + (data.reason || 'Access denied'));
          }
        });
      }
      
      // Check if already authed (for dev/testing)
      const skipAuth = window.location.search.includes('skipauth=1');
      if (skipAuth) {
        $authOverlay.classList.add('hidden');
      } else {
        initGoogleAuth();
      }
      
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
      
      // Promote button
      $promoteBtn.onclick = function() {
        if (confirm('Promote staging to production?')) {
          fetch('/api/promote', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
              if (data.success) {
                addMessage('system', 'Promotion triggered! CI/CD will deploy to production.', 'success');
              } else {
                addMessage('system', 'Promotion failed: ' + data.error, 'error');
              }
            });
        }
      };
      
      function addMessage(role, content, type) {
        messages.push({ role, content, type });
        render();
      }
      
      function render() {
        let html = '';
        for (const m of messages) {
          let cls = 'msg ' + m.role;
          if (m.type) cls += ' ' + m.type;
          html += '<div class="' + cls + '">' + escapeHtml(m.content) + '</div>';
        }
        if (loading) {
          html += '<div class="msg assistant">Processing...</div>';
        }
        $messages.innerHTML = html;
        $messages.scrollTop = $messages.scrollHeight;
      }
      
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/(https?:\\/\\/[^\\s]+)/g, '<a href="$1" target="_blank" style="color: var(--lcars-blue)">$1</a>');
      }
      
      function setEditStatus(text, active) {
        $editStatus.classList.toggle('active', active);
        $editStatusText.textContent = text;
      }
      
      async function send() {
        const text = $input.value.trim();
        if (!text || loading) return;
        
        addMessage('user', text);
        $input.value = '';
        loading = true;
        $sendBtn.disabled = true;
        
        if (mode === 'edit') {
          setEditStatus('Reading current code...', true);
        }
        
        try {
          const endpoint = mode === 'edit' ? '/api/self-edit' : '/api/chat';
          const body = mode === 'edit' 
            ? { instruction: text }
            : { messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })) };
          
          // For edit mode, use event stream for live updates
          if (mode === 'edit') {
            const response = await fetch(endpoint + '?stream=1', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = '';
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value);
              const lines = chunk.split('\\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.status) {
                      setEditStatus(data.message || data.status, true);
                    }
                    if (data.success !== undefined) {
                      result = data;
                    }
                  } catch (e) {}
                }
              }
            }
            
            setEditStatus('', false);
            
            if (result.success) {
              addMessage('system', '✓ ' + result.explanation + (result.url ? '\\n' + result.url : ''), 'success');
            } else {
              addMessage('system', '✗ ' + (result.error || 'Edit failed'), 'error');
            }
          } else {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            
            const data = await response.json();
            addMessage('assistant', data.content || data.error || 'No response');
          }
          
          loadStats();
        } catch (e) {
          addMessage('system', 'Error: ' + e.message, 'error');
        }
        
        loading = false;
        $sendBtn.disabled = false;
        render();
      }
      
      $sendBtn.onclick = send;
      $input.onkeydown = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      };
      
      async function loadStats() {
        try {
          const data = await fetch('/api/telemetry').then(r => r.json());
          document.getElementById('statContext').textContent = 'Context: ' + (data.stats?.contextWords || 0) + ' words';
          document.getElementById('statEdits').textContent = 'Edits: ' + (data.stats?.edit_success || 0);
        } catch (e) {}
      }
      
      async function loadTelemetry() {
        try {
          const data = await fetch('/api/telemetry').then(r => r.json());
          
          const grid = document.getElementById('telemetryGrid');
          const stats = data.stats || {};
          
          grid.innerHTML = Object.entries(stats).map(([key, value]) => 
            '<div class="telemetry-card"><div class="telemetry-value">' + value + '</div><div class="telemetry-label">' + key.replace(/_/g, ' ') + '</div></div>'
          ).join('');
          
          const eventList = document.getElementById('eventList');
          const events = data.events || [];
          
          eventList.innerHTML = events.slice(0, 50).map(e =>
            '<div class="event-item"><strong>' + e.timestamp + '</strong> - ' + e.event + '</div>'
          ).join('');
        } catch (e) {
          console.error(e);
        }
      }
      
      async function loadContext() {
        try {
          const data = await fetch('/api/context').then(r => r.json());
          document.getElementById('contextData').value = JSON.stringify(data.data || {}, null, 2);
        } catch (e) {}
      }
      
      window.saveContext = async function() {
        try {
          const value = document.getElementById('contextData').value;
          JSON.parse(value); // Validate JSON
          
          await fetch('/api/context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: value })
          });
          
          closeModal('contextModal');
          addMessage('system', 'Context saved', 'success');
        } catch (e) {
          alert('Invalid JSON: ' + e.message);
        }
      };
      
      async function loadPrompt() {
        try {
          const data = await fetch('/api/context').then(r => r.json());
          document.getElementById('masterPrompt').value = data.prompt || '';
        } catch (e) {}
      }
      
      window.savePrompt = async function() {
        try {
          const value = document.getElementById('masterPrompt').value;
          
          await fetch('/api/prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: value })
          });
          
          closeModal('promptModal');
          addMessage('system', 'Master prompt saved', 'success');
        } catch (e) {
          alert('Error: ' + e.message);
        }
      };
      
      render();
      loadStats();
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
    
    // Main UI
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    // Health check
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        ok: true,
        version: VERSION,
        creature: 'Dumbo Octopus'
      }), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    // Verify Google auth
    if (url.pathname === '/api/verify-auth' && request.method === 'POST') {
      const { token } = await request.json();
      const result = await verifyGoogleToken(token, env);
      return new Response(JSON.stringify(result), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    // Chat endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages } = await request.json();
        await logTelemetry('chat', { messageCount: messages.length }, env);
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
    
    // Self-edit endpoint with streaming
    if (url.pathname === '/api/self-edit' && request.method === 'POST') {
      try {
        const { instruction } = await request.json();
        const stream = url.searchParams.get('stream') === '1';
        
        if (!instruction || instruction.length < 5) {
          const response = { success: false, error: 'Instruction too short' };
          return new Response(JSON.stringify(response), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
        
        if (stream) {
          // Server-sent events for live updates
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const encoder = new TextEncoder();
          
          (async () => {
            const sendEvent = (data) => {
              writer.write(encoder.encode('data: ' + JSON.stringify(data) + '\n\n'));
            };
            
            const result = await selfEdit(instruction, env, sendEvent);
            sendEvent(result);
            writer.close();
          })();
          
          return new Response(readable, {
            headers: {
              ...cors,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache'
            }
          });
        } else {
          const result = await selfEdit(instruction, env);
          return new Response(JSON.stringify(result), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { 
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Context endpoints
    if (url.pathname === '/api/context') {
      if (request.method === 'GET') {
        const context = await getContext(env);
        return new Response(JSON.stringify(context), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
      
      if (request.method === 'POST') {
        const { data } = await request.json();
        await setContext('shared_data', data, env);
        await logTelemetry('context_update', { size: data.length }, env);
        return new Response(JSON.stringify({ success: true }), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Prompt endpoint
    if (url.pathname === '/api/prompt' && request.method === 'POST') {
      const { prompt } = await request.json();
      await setContext('master_prompt', prompt, env);
      await logTelemetry('prompt_update', { size: prompt.length }, env);
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    // Telemetry endpoint
    if (url.pathname === '/api/telemetry') {
      const context = await getContext(env);
      return new Response(JSON.stringify(context.telemetry || {}), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    // Promote endpoint (trigger GitHub Actions)
    if (url.pathname === '/api/promote' && request.method === 'POST') {
      try {
        // Trigger promote-to-production workflow
        const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/actions/workflows/promote-to-production.yml/dispatches`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'OmniBot'
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: { confirm: 'promote' }
          })
        });
        
        if (res.status === 204) {
          await logTelemetry('promote_triggered', {}, env);
          return new Response(JSON.stringify({ success: true }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        } else {
          const error = await res.text();
          return new Response(JSON.stringify({ success: false, error }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { 
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Test endpoint
    if (url.pathname === '/api/test') {
      return new Response(JSON.stringify({
        ok: true,
        version: VERSION,
        timestamp: new Date().toISOString()
      }), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    return new Response('OmniBot ' + VERSION, { headers: cors });
  }
};
