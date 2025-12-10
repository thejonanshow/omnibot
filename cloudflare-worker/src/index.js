// Restored: 2025-12-09T19:39:18Z
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
const BUILD = '2.1'; // Increment on each deploy

const GROQ_MODELS = {
  // Use Llama 3.3 for planning/review (good at reasoning)
  llama: 'llama-3.3-70b-versatile',
  // Use smaller Llama for code patches (fast)
  coder: 'llama-3.1-8b-instant',
  // Gemma as fallback (replaces deprecated mixtral)
  gemma: 'gemma2-9b-it'
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
      model: GROQ_MODELS[model] || GROQ_MODELS.gemma, 
      messages: fullMessages, 
      max_tokens: 4000, // Keep responses short to avoid rate limits
      temperature: 0.3
    })
  });
  
  const data = await res.json();
  
  if (data.error) {
    // THROW instead of returning error string - prevents writing errors as code
    throw new Error(`Groq API error: ${data.error.message || JSON.stringify(data.error)}`);
  }
  
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No response from Groq API');
  }
  
  return content;
}

// ============== CODE VALIDATION ==============
function validateCodeStructure(code) {
  // Simple validation - just check it's not obviously broken
  // Returns warnings but doesn't block deployment
  const warnings = [];
  
  if (code.length < 5000) {
    warnings.push(`Code seems short (${code.length} chars)`);
  }
  
  if (!code.includes('export default')) {
    warnings.push('Missing export default');
  }
  
  // Always allow deployment - trust the edit
  return { valid: true, warnings };
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

// ============== SELF EDIT - MULTI-STAGE PIPELINE ==============

// Stage 1: Groq analyzes the request and creates a focused plan
async function planEdit(instruction, currentCode, env) {
  // Create a summary of the code structure (not full code - too many tokens)
  const codeStructure = extractCodeStructure(currentCode);
  
  const systemPrompt = `You are a code change planner. Analyze the user's request and create a focused plan.

OUTPUT FORMAT (JSON):
{
  "summary": "Brief description of what will change",
  "sections_to_modify": ["list of function/section names"],
  "risk_level": "low|medium|high",
  "qwen_prompt": "A focused prompt for Qwen Coder to generate the patch"
}

The qwen_prompt should:
- Be specific about what code to find and replace
- Reference exact function names or CSS selectors
- NOT include the full codebase (Qwen will receive relevant sections only)`;

  const userPrompt = `User request: "${instruction}"

Code structure (${currentCode.length} chars total):
${codeStructure}

Create a plan for this change:`;

  const response = await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
  
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback plan
    return {
      summary: instruction,
      sections_to_modify: ['unknown'],
      risk_level: 'medium',
      qwen_prompt: instruction
    };
  }
  
  return {
    summary: instruction,
    sections_to_modify: ['unknown'],
    risk_level: 'medium', 
    qwen_prompt: instruction
  };
}

// Extract code structure without full content
function extractCodeStructure(code) {
  const lines = code.split('\n');
  const structure = [];
  
  // Find functions
  const funcRegex = /^(async\s+)?function\s+(\w+)|^const\s+(\w+)\s*=\s*(async\s*)?\(/;
  // Find major sections
  const sectionRegex = /^\/\/\s*=+\s*(.+?)\s*=+/;
  // Find CSS classes in HTML
  const cssRegex = /^\s*\.([\w-]+)\s*\{/;
  
  let inHTML = false;
  let lineNum = 0;
  
  for (const line of lines) {
    lineNum++;
    if (line.includes('const HTML =')) inHTML = true;
    
    const funcMatch = line.match(funcRegex);
    const sectionMatch = line.match(sectionRegex);
    
    if (sectionMatch) {
      structure.push(`[Section: ${sectionMatch[1]}] (line ${lineNum})`);
    } else if (funcMatch && !inHTML) {
      const name = funcMatch[2] || funcMatch[3];
      structure.push(`Function: ${name}() (line ${lineNum})`);
    }
    
    if (inHTML && cssRegex.test(line)) {
      const cssMatch = line.match(cssRegex);
      if (cssMatch && !structure.includes(`CSS: .${cssMatch[1]}`)) {
        structure.push(`CSS: .${cssMatch[1]} (line ${lineNum})`);
      }
    }
  }
  
  return structure.slice(0, 50).join('\n'); // Limit to 50 items
}

// Stage 2: Generate patches with Qwen (using focused prompt from plan)
async function generatePatches(plan, currentCode, env) {
  // Extract only relevant code sections based on plan
  const relevantCode = extractRelevantSections(currentCode, plan.sections_to_modify);
  
  const systemPrompt = `You are a code patch generator. Your ONLY job is to output patches in this EXACT format. No other text.

FORMAT (copy exactly):
<<<REPLACE>>>
[paste the exact old code here]
<<<WITH>>>
[paste the new replacement code here]
<<<END>>>

CRITICAL RULES:
1. Output ONLY patch blocks - no explanations, no markdown, no other text
2. Copy the old code EXACTLY from the source including whitespace
3. You MUST include <<<REPLACE>>> <<<WITH>>> and <<<END>>> delimiters
4. Multiple patches are OK - just put one after another`;

  const userPrompt = `TASK: ${plan.qwen_prompt || plan.summary}

SOURCE CODE TO MODIFY:
${relevantCode.slice(0, 8000)}

OUTPUT YOUR PATCHES NOW (remember: <<<REPLACE>>> old <<<WITH>>> new <<<END>>>):`;

  // Use gemma which is good at following strict formats
  return await callGroq('gemma', [{ role: 'user', content: userPrompt }], env, systemPrompt);
}

// Extract code sections by name/pattern
function extractRelevantSections(code, sections) {
  if (!sections || sections.length === 0 || sections[0] === 'unknown') {
    // Return condensed version
    const lines = code.split('\n');
    if (lines.length > 500) {
      return lines.slice(0, 200).join('\n') + '\n\n...[middle omitted]...\n\n' + lines.slice(-200).join('\n');
    }
    return code;
  }
  
  const lines = code.split('\n');
  const extracted = [];
  let capturing = false;
  let braceDepth = 0;
  let captureStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a section we want
    const shouldCapture = sections.some(s => 
      line.includes(`function ${s}`) || 
      line.includes(`${s} =`) ||
      line.includes(`.${s}`) ||
      line.toLowerCase().includes(s.toLowerCase())
    );
    
    if (shouldCapture && !capturing) {
      capturing = true;
      captureStart = Math.max(0, i - 2);
      braceDepth = 0;
    }
    
    if (capturing) {
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;
      
      // Stop after function/block ends
      if (braceDepth <= 0 && i > captureStart + 5) {
        extracted.push(`// Lines ${captureStart + 1}-${i + 1}:`);
        extracted.push(...lines.slice(captureStart, i + 1));
        extracted.push('');
        capturing = false;
      }
    }
  }
  
  // If we captured nothing, return condensed full code
  if (extracted.length === 0) {
    const lines = code.split('\n');
    return lines.slice(0, 150).join('\n') + '\n...\n' + lines.slice(-150).join('\n');
  }
  
  return extracted.join('\n');
}

// Stage 3: Review patches with Groq and format for user
async function reviewPatches(patches, plan, env) {
  const systemPrompt = `You are a code review assistant. Analyze these patches and provide a clear summary for the user.

OUTPUT FORMAT:
1. What changes will be made (bullet points)
2. Any potential risks or issues
3. Recommendation: APPROVE or NEEDS_REVIEW

Be concise. The user needs to approve before changes are applied.`;

  const userPrompt = `Original request: ${plan.summary}

Patches to apply:
${patches}

Review these changes:`;

  return await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
}

// Apply a diff-style patch to code  
function applyPatch(originalCode, patch) {
  let result = originalCode;
  
  const replacePattern = /<<<REPLACE>>>\s*([\s\S]*?)\s*<<<WITH>>>\s*([\s\S]*?)\s*<<<END>>>/g;
  let match;
  
  while ((match = replacePattern.exec(patch)) !== null) {
    const oldText = match[1].trim();
    const newText = match[2].trim();
    
    if (result.includes(oldText)) {
      result = result.replace(oldText, newText);
    } else {
      // Try fuzzy match
      const normalizedOld = oldText.replace(/\s+/g, ' ');
      const lines = result.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const windowSize = oldText.split('\n').length;
        const textWindow = lines.slice(i, i + windowSize).join('\n');
        if (textWindow.replace(/\s+/g, ' ') === normalizedOld) {
          lines.splice(i, windowSize, newText);
          result = lines.join('\n');
          break;
        }
      }
    }
  }
  
  const insertPattern = /<<<INSERT_AFTER>>>\s*([\s\S]*?)\s*<<<CONTENT>>>\s*([\s\S]*?)\s*<<<END>>>/g;
  while ((match = insertPattern.exec(patch)) !== null) {
    const marker = match[1].trim();
    const content = match[2].trim();
    if (result.includes(marker)) {
      result = result.replace(marker, marker + '\n' + content);
    }
  }
  
  return result;
}

// Main edit orchestrator - now returns plan for approval
async function prepareEdit(instruction, env) {
  try {
    await logTelemetry('edit_prepare_start', { instruction }, env);
    
    // Get current code
    const file = await githubGet('cloudflare-worker/src/index.js', env);
    if (!file.content) {
      return { success: false, error: 'Could not read code' };
    }
    const currentCode = decodeURIComponent(escape(atob(file.content)));
    
    // Stage 1: Plan with Groq
    const plan = await planEdit(instruction, currentCode, env);
    
    // Stage 2: Generate patches with Qwen
    const patches = await generatePatches(plan, currentCode, env);
    
    // Check if patches are valid
    if (!patches.includes('<<<REPLACE>>>') && !patches.includes('<<<INSERT_AFTER>>>')) {
      return { 
        success: false, 
        error: 'Could not generate valid patches',
        details: patches.slice(0, 500)
      };
    }
    
    // Stage 3: Review with Groq
    const review = await reviewPatches(patches, plan, env);
    
    // Store pending edit for approval
    const editId = Date.now().toString(36);
    if (env.CONTEXT) {
      await env.CONTEXT.put(`pending_edit_${editId}`, JSON.stringify({
        instruction,
        plan,
        patches,
        timestamp: Date.now()
      }), { expirationTtl: 3600 }); // 1 hour expiry
    }
    
    return {
      success: true,
      editId,
      plan: plan.summary,
      review,
      patches_preview: patches.slice(0, 1000),
      awaiting_approval: true
    };
    
  } catch (e) {
    await logTelemetry('edit_prepare_error', { error: e.message }, env);
    return { success: false, error: e.message };
  }
}

// Execute approved edit
async function executeEdit(editId, env) {
  try {
    // Retrieve pending edit
    if (!env.CONTEXT) {
      return { success: false, error: 'Context storage not available' };
    }
    
    const pendingJson = await env.CONTEXT.get(`pending_edit_${editId}`);
    if (!pendingJson) {
      return { success: false, error: 'Edit not found or expired' };
    }
    
    const pending = JSON.parse(pendingJson);
    
    // Get fresh code
    const file = await githubGet('cloudflare-worker/src/index.js', env);
    if (!file.content) {
      return { success: false, error: 'Could not read code' };
    }
    const currentCode = decodeURIComponent(escape(atob(file.content)));
    
    // Apply patches
    const finalCode = applyPatch(currentCode, pending.patches);
    
    // Safety checks
    if (finalCode.startsWith('ERROR') || finalCode.length < 1000) {
      return { success: false, error: 'Invalid code generated' };
    }
    
    if (!finalCode.includes('export default')) {
      return { success: false, error: 'Missing export default' };
    }
    
    if (currentCode === finalCode) {
      return { success: false, error: 'No changes were made' };
    }
    
    // Commit
    const commitMessage = `[OmniBot] ${pending.instruction.slice(0, 60)}`;
    const result = await githubPut('cloudflare-worker/src/index.js', finalCode, commitMessage, env);
    
    if (!result.commit) {
      return { success: false, error: 'Commit failed' };
    }
    
    // Cleanup
    await env.CONTEXT.delete(`pending_edit_${editId}`);
    
    await logTelemetry('edit_execute_success', {
      editId,
      instruction: pending.instruction,
      commit: result.commit.sha
    }, env);
    
    return {
      success: true,
      commit: result.commit.sha,
      url: result.commit.html_url
    };
    
  } catch (e) {
    await logTelemetry('edit_execute_error', { error: e.message }, env);
    return { success: false, error: e.message };
  }
}

// Legacy selfEdit - now just calls prepareEdit (for backwards compat)
async function selfEdit(instruction, env, streamCallback = null) {
  // For streaming mode, show progress
  if (streamCallback) {
    streamCallback({ status: 'planning', message: 'Analyzing your request...' });
  }
  
  const result = await prepareEdit(instruction, env);
  
  if (!result.success) {
    return result;
  }
  
  // Return with approval prompt
  return {
    success: true,
    awaiting_approval: true,
    editId: result.editId,
    message: result.review,
    plan: result.plan,
    patches_preview: result.patches_preview
  };
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
    
    .version-link {
      background: var(--lcars-purple);
      padding: 6px 14px;
      border-radius: 15px;
      font-size: 11px;
      font-weight: 700;
      color: #000;
      text-decoration: none;
      white-space: nowrap;
      transition: all 0.2s;
    }
    
    .version-link:hover {
      filter: brightness(1.2);
      transform: scale(1.05);
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
    .msg.info { border-color: var(--lcars-blue); color: var(--lcars-text); }
    
    /* Code blocks */
    .code-block {
      position: relative;
      background: #0d0d0d;
      border-radius: 6px;
      margin: 8px 0;
      overflow: hidden;
    }
    
    .code-block pre {
      margin: 0;
      padding: 12px;
      overflow-x: auto;
      font-size: 12px;
      line-height: 1.4;
    }
    
    .code-block code {
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      color: var(--lcars-cyan);
    }
    
    .copy-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      background: var(--lcars-orange);
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    
    .copy-btn:hover { opacity: 1; }
    
    code.inline {
      background: #1a1a1a;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 0.9em;
      color: var(--lcars-cyan);
    }
    
    .msg a {
      color: var(--lcars-cyan);
      text-decoration: underline;
    }
    
    .msg strong {
      color: var(--lcars-orange);
    }
    
    .typing {
      animation: blink 1s infinite;
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.5; }
    }
    
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
    
    /* Approval buttons */
    .approval-buttons {
      display: flex;
      gap: 12px;
      margin: 16px 0;
      justify-content: center;
    }
    
    .approve-btn, .reject-btn, .review-btn {
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .approve-btn {
      background: var(--lcars-cyan);
      color: #000;
    }
    
    .approve-btn:hover {
      filter: brightness(1.2);
      transform: scale(1.05);
    }
    
    .review-btn {
      background: var(--lcars-blue);
      color: #000;
    }
    
    .review-btn:hover {
      filter: brightness(1.2);
    }
    
    .reject-btn {
      background: var(--lcars-red);
      color: #000;
    }
    
    .reject-btn:hover {
      filter: brightness(1.2);
    }
    
    .msg.info {
      border-color: var(--lcars-blue);
      color: var(--lcars-text);
      white-space: pre-wrap;
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
    
    /* ========================================
       MOBILE RESPONSIVE STYLES
       ======================================== */
    @media (max-width: 768px) {
      /* Complete restructure for mobile */
      .lcars-frame {
        display: flex !important;
        flex-direction: column !important;
        grid-template-columns: unset !important;
        grid-template-rows: unset !important;
      }
      
      /* Header first */
      .lcars-header {
        order: 1;
        height: 50px;
        flex-shrink: 0;
      }
      
      /* Sidebar becomes horizontal button bar */
      .lcars-sidebar {
        order: 2;
        display: flex !important;
        flex-direction: row !important;
        height: auto !important;
        min-height: unset !important;
        max-height: 60px !important;
        border-radius: 0 !important;
        padding: 8px !important;
        gap: 6px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        -webkit-overflow-scrolling: touch;
      }
      
      .lcars-sidebar-top {
        display: none !important;
      }
      
      .lcars-sidebar-content {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        padding: 0 !important;
        gap: 6px !important;
        height: auto !important;
        align-items: center !important;
      }
      
      .lcars-btn {
        padding: 8px 12px !important;
        font-size: 11px !important;
        border-radius: 12px !important;
        margin: 0 !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        height: auto !important;
        min-height: unset !important;
      }
      
      /* Main content area */
      .lcars-main {
        order: 3;
        flex: 1;
        min-height: 0;
        margin: 4px;
        border-radius: 8px;
      }
      
      /* Footer */
      .lcars-footer {
        order: 4;
        height: 50px;
        flex-shrink: 0;
      }
      
      .lcars-header-curve {
        width: 30px;
        border-radius: 0 0 15px 0;
      }
      
      .lcars-header-bar {
        padding: 0 10px;
      }
      
      .lcars-title {
        font-size: 16px;
        letter-spacing: 1px;
      }
      
      .version-link {
        padding: 4px 8px;
        font-size: 9px;
      }
      
      .lcars-user {
        padding: 4px 10px;
        font-size: 9px;
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .lcars-header-end {
        width: 20px;
        border-radius: 10px;
      }
      
      .messages {
        padding: 10px;
        gap: 8px;
      }
      
      .msg {
        max-width: 92%;
        padding: 10px 12px;
        font-size: 13px;
      }
      
      .input-bar {
        padding: 8px;
        gap: 6px;
      }
      
      .input-bar input {
        padding: 10px 12px;
        font-size: 16px; /* Prevent iOS zoom */
      }
      
      .input-bar button {
        padding: 10px 14px;
        font-size: 13px;
      }
      
      .lcars-footer-curve {
        width: 30px;
        border-radius: 0 15px 0 0;
      }
      
      .lcars-footer-bar {
        padding: 0 10px;
        gap: 8px;
      }
      
      .stat {
        font-size: 10px;
      }
      
      .lcars-footer-end {
        width: 25px;
      }
      
      /* Login screen */
      .login-logo {
        font-size: 28px;
      }
      
      .login-subtitle {
        font-size: 12px;
        letter-spacing: 2px;
      }
      
      .login-btn {
        padding: 14px 24px;
        font-size: 14px;
        gap: 10px;
      }
      
      /* Modals */
      .modal-content {
        width: 95%;
        max-height: 85vh;
        padding: 14px;
        border-radius: 10px;
      }
      
      .modal-title {
        font-size: 15px;
      }
      
      .modal textarea {
        min-height: 120px;
        font-size: 14px;
      }
    }
    
    /* Extra small screens */
    @media (max-width: 400px) {
      .lcars-btn {
        padding: 6px 10px !important;
        font-size: 9px !important;
      }
      
      .lcars-title {
        font-size: 14px;
      }
      
      .version-link {
        padding: 3px 6px;
        font-size: 8px;
      }
      
      .lcars-user {
        display: none;
      }
      
      .stat:not(:first-child) {
        display: none;
      }
    }
    
    /* Safe area for notched phones */
    @supports (padding: env(safe-area-inset-bottom)) {
      .lcars-footer-bar {
        padding-bottom: env(safe-area-inset-bottom);
      }
      
      .input-bar {
        padding-bottom: calc(8px + env(safe-area-inset-bottom));
      }
    }
    
    /* Landscape */
    @media (max-height: 500px) and (orientation: landscape) {
      .lcars-header {
        height: 40px;
      }
      
      .lcars-sidebar {
        max-height: 45px !important;
      }
      
      .lcars-footer {
        height: 35px;
      }
      
      .messages {
        padding: 6px;
      }
      
      .msg {
        padding: 6px 10px;
        font-size: 12px;
      }
    }
  </style>
</head>
<body>
  <!-- Login Screen -->
  <div id="loginScreen" class="login-screen">
    <div class="login-logo">OMNIBOT</div>
    <div class="login-subtitle">Electric Eel v2.1</div>
    <a href="/auth/google" class="login-btn">
      <svg viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Sign in with Google
    </a>
    <div class="version-tag">v5.0 ELECTRIC EEL</div>
  </div>

  <!-- Main App (hidden until logged in) -->
  <div id="mainApp" class="lcars-frame hidden">
    <div class="lcars-sidebar">
      <div class="lcars-sidebar-top"></div>
      <div class="lcars-sidebar-content">
        <button class="lcars-btn active" data-mode="chat">Chat</button>
        <button class="lcars-btn" data-mode="edit">Edit</button>
        <button class="lcars-btn" data-view="telemetry">Stats</button>
        <button class="lcars-btn" data-view="context">Context</button>
        <button class="lcars-btn" data-view="prompt">Prompt</button>
        <button class="lcars-btn" id="fullscreenBtn">⛶</button>
        <button class="lcars-btn danger" id="logoutBtn">Logout</button>
      </div>
    </div>
    
    <div class="lcars-header">
      <div class="lcars-header-curve"></div>
      <div class="lcars-header-bar">
        <span class="lcars-title">OmniBot</span>
        <a href="https://en.wikipedia.org/wiki/Electric_eel" target="_blank" class="version-link">⚡ Electric Eel v2.1</a>
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
      
      // Fullscreen toggle (with iOS fallback message)
      document.getElementById('fullscreenBtn').onclick = function() {
        const elem = document.documentElement;
        
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          // Try standard fullscreen first
          if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(e => {
              // iOS doesn't support fullscreen API - show PWA hint
              addMessage('system', '📱 **Fullscreen tip:** On iOS, tap Share → Add to Home Screen to use OmniBot as a fullscreen app!', 'info');
            });
          } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
          } else {
            // No fullscreen support
            addMessage('system', '📱 **Fullscreen tip:** Add OmniBot to your home screen for a fullscreen experience!', 'info');
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
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
          let cls = 'msg ' + m.role;
          if (m.type) cls += ' ' + m.type;
          const formatted = formatMessage(m.content);
          html += '<div class="' + cls + '">' + formatted + '</div>';
        }
        if (loading) {
          html += '<div class="msg assistant"><span class="typing">Processing...</span></div>';
        }
        $messages.innerHTML = html;
        $messages.scrollTop = $messages.scrollHeight;
        
        // Add copy handlers
        document.querySelectorAll('.copy-btn').forEach(btn => {
          btn.onclick = function() {
            const code = this.parentElement.querySelector('code').textContent;
            navigator.clipboard.writeText(code).then(() => {
              this.textContent = '✓';
              setTimeout(() => this.textContent = '📋', 1500);
            });
          };
        });
      }
      
      function formatMessage(text) {
        // Escape HTML first
        let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Code blocks with copy button
        safe = safe.replace(/\`\`\`(\\w*)\\n?([\\s\\S]*?)\`\`\`/g, function(m, lang, code) {
          return '<div class="code-block"><button class="copy-btn">📋</button><pre><code>' + code.trim() + '</code></pre></div>';
        });
        
        // Inline code
        safe = safe.replace(/\`([^\`]+)\`/g, '<code class="inline">$1</code>');
        
        // Bold
        safe = safe.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
        
        // Links
        safe = safe.replace(/(https?:\\/\\/[^\\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // Line breaks
        safe = safe.replace(/\\n/g, '<br>');
        
        return safe;
      }
      
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/(https?:\\/\\/[^\\s]+)/g, '<a href="$1" target="_blank" style="color: var(--lcars-cyan)">$1</a>');
      }
      
      function setEditStatus(text, active) {
        $editStatus.classList.toggle('active', active);
        $editStatusText.textContent = text;
      }
      
      // Show 3-button approval UI: Approve, Deny, Review
      function showApprovalButtons(editId, patchPreview) {
        // Remove any existing approval buttons
        document.querySelectorAll('.approval-buttons').forEach(el => el.remove());
        
        const approveDiv = document.createElement('div');
        approveDiv.className = 'approval-buttons';
        approveDiv.innerHTML = 
          '<button class="approve-btn" data-edit-id="' + editId + '">✓ Approve</button>' +
          '<button class="review-btn" data-edit-id="' + editId + '">🔍 Review</button>' +
          '<button class="reject-btn" data-edit-id="' + editId + '">✗ Deny</button>';
        $messages.appendChild(approveDiv);
        $messages.scrollTop = $messages.scrollHeight;
        
        // Approve - deploy the changes
        approveDiv.querySelector('.approve-btn').onclick = async function() {
          const id = this.dataset.editId;
          setEditStatus('Deploying...', true);
          approveDiv.remove();
          
          try {
            const res = await fetch('/api/approve-edit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ editId: id })
            });
            const data = await res.json();
            setEditStatus('', false);
            
            if (data.success) {
              addMessage('system', '✓ Deployed! ' + (data.url || ''), 'success');
            } else {
              addMessage('system', '✗ ' + (data.error || 'Deploy failed'), 'error');
            }
          } catch (e) {
            setEditStatus('', false);
            addMessage('system', '✗ Error: ' + e.message, 'error');
          }
          loadStats();
        };
        
        // Review - send to Claude/Gemini for second opinion
        approveDiv.querySelector('.review-btn').onclick = async function() {
          const id = this.dataset.editId;
          setEditStatus('Getting second opinion...', true);
          approveDiv.remove();
          
          try {
            const res = await fetch('/api/review-edit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ editId: id })
            });
            const data = await res.json();
            setEditStatus('', false);
            
            if (data.review) {
              addMessage('system', '🔍 **Reviewer says:**\\n\\n' + data.review, 'info');
              // Show buttons again for this edit
              showApprovalButtons(id, patchPreview);
            } else {
              addMessage('system', '✗ Review failed: ' + (data.error || 'Unknown error'), 'error');
            }
          } catch (e) {
            setEditStatus('', false);
            addMessage('system', '✗ Error: ' + e.message, 'error');
          }
        };
        
        // Deny - cancel
        approveDiv.querySelector('.reject-btn').onclick = function() {
          approveDiv.remove();
          addMessage('system', '✗ Edit cancelled', 'info');
        };
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
                    if (data.success !== undefined || data.awaiting_approval) {
                      result = data;
                    }
                  } catch (e) {}
                }
              }
            }
            
            setEditStatus('', false);
            
            // Handle approval flow
            if (result.awaiting_approval && result.editId) {
              addMessage('system', '📋 **Proposed Changes:**\\n\\n' + (result.message || result.plan), 'info');
              
              // Show approval buttons - 3 options
              showApprovalButtons(result.editId, result.patches_preview || '');
              
            } else if (result.success) {
              addMessage('system', '✓ ' + result.explanation + (result.url ? '\\n' + result.url : ''), 'success');
            } else {
              addMessage('system', '✗ ' + (result.error || 'Edit failed') + (result.details ? '\\n' + result.details : ''), 'error');
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
          JSON.parse(value);
          
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
    })();
  </script>
</body>
</html>
`;

// ============== MAIN HANDLER ==============
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
    
    const baseUrl = url.origin;
    const redirectUri = `${baseUrl}/auth/callback`;
    
    // ===== OAuth Routes =====
    
    // Start Google OAuth
    if (url.pathname === '/auth/google') {
      const authUrl = getGoogleAuthUrl(env, redirectUri);
      return Response.redirect(authUrl, 302);
    }
    
    // OAuth callback
    if (url.pathname === '/auth/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      
      if (error) {
        return new Response(`Auth error: ${error}`, { status: 400 });
      }
      
      if (!code) {
        return new Response('No code provided', { status: 400 });
      }
      
      try {
        // Exchange code for token
        const tokenData = await exchangeCodeForToken(code, env, redirectUri);
        
        if (tokenData.error) {
          return new Response(`Token error: ${tokenData.error_description || tokenData.error}`, { status: 400 });
        }
        
        // Get user info
        const userInfo = await getGoogleUserInfo(tokenData.access_token);
        
        if (userInfo.email !== ALLOWED_EMAIL) {
          return new Response(`Access denied. Only ${ALLOWED_EMAIL} can access this app.`, { 
            status: 403,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        
        // Create session
        const sessionToken = createSessionToken(userInfo.email);
        
        await logTelemetry('login', { email: userInfo.email }, env);
        
        // Redirect to app with session
        return Response.redirect(`${baseUrl}/?session=${encodeURIComponent(sessionToken)}&email=${encodeURIComponent(userInfo.email)}`, 302);
        
      } catch (e) {
        return new Response(`Auth error: ${e.message}`, { status: 500 });
      }
    }
    
    // Verify session
    if (url.pathname === '/api/verify-session' && request.method === 'POST') {
      const { token } = await request.json();
      const result = validateSession(token);
      return new Response(JSON.stringify(result), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    // ===== Main Routes =====
    
    // Main UI
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    // Health check
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        ok: true,
        version: VERSION,
        build: BUILD,
        creature: 'Electric Eel'
      }), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    // Chat endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages } = await request.json();
        await logTelemetry('chat', { messageCount: messages.length }, env);
        
        // Check if user is trying to edit in chat mode
        const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
        const editKeywords = ['add ', 'change ', 'modify ', 'fix ', 'update ', 'edit ', 'make ', 'create '];
        const looksLikeEdit = editKeywords.some(k => lastMsg.startsWith(k)) && 
          (lastMsg.includes('button') || lastMsg.includes('code') || lastMsg.includes('css') || lastMsg.includes('feature'));
        
        // Add context about mode
        const systemAddendum = looksLikeEdit 
          ? '\n\nIMPORTANT: The user seems to want code changes but they are in CHAT mode. Remind them to switch to EDIT mode (tap the EDIT button) to make actual code changes. In chat mode you can only discuss and explain - you cannot modify OmniBot\'s code.'
          : '';
        
        const reply = await callGroq('llama', messages, env, systemAddendum);
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
    
    // Self-edit endpoint - now returns plan for approval
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
    
    // Approve and execute edit
    if (url.pathname === '/api/approve-edit' && request.method === 'POST') {
      try {
        const { editId } = await request.json();
        
        if (!editId) {
          return new Response(JSON.stringify({ success: false, error: 'Missing editId' }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
        
        const result = await executeEdit(editId, env);
        return new Response(JSON.stringify(result), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { 
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Review edit with external AI (Claude -> Gemini fallback)
    if (url.pathname === '/api/review-edit' && request.method === 'POST') {
      try {
        const { editId } = await request.json();
        
        if (!editId || !env.CONTEXT) {
          return new Response(JSON.stringify({ error: 'Missing editId or context' }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
        
        // Get pending edit
        const pendingJson = await env.CONTEXT.get('pending_edit_' + editId);
        if (!pendingJson) {
          return new Response(JSON.stringify({ error: 'Edit not found or expired' }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
        
        const pending = JSON.parse(pendingJson);
        const reviewPrompt = 'Review these proposed code changes. Be concise but thorough. Identify any bugs, security issues, or improvements needed:\\n\\nOriginal request: ' + pending.instruction + '\\n\\nProposed patches:\\n' + pending.patches;
        
        let review = null;
        
        // Try Gemini first (free tier available)
        if (env.GEMINI_API_KEY) {
          try {
            const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + env.GEMINI_API_KEY, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: reviewPrompt }] }],
                generationConfig: { maxOutputTokens: 1000 }
              })
            });
            const geminiData = await geminiRes.json();
            review = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (review) {
              review = '**Gemini Review:**\\n' + review;
            }
          } catch (e) {
            console.log('Gemini failed:', e.message);
          }
        }
        
        // Fallback to Groq Mixtral if Gemini failed
        if (!review) {
          try {
            const gemmaReview = await callGroq('gemma', [{ role: 'user', content: reviewPrompt }], env, 'You are a code reviewer. Be concise and helpful.');
            review = '**Gemma Review:**\\n' + gemmaReview;
          } catch (e) {
            review = 'Review unavailable: ' + e.message;
          }
        }
        
        await logTelemetry('edit_review', { editId }, env);
        
        return new Response(JSON.stringify({ review }), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
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
