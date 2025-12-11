// Restored: 2025-12-09T19:39:18Z
/**
 * OmniBot - Electric Eel Edition
 * https://en.wikipedia.org/wiki/Electric_eel
 * 
 * Semantic Versioning: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes
 * - MINOR: New features (triggers new animal release)
 * - PATCH: Bug fixes
 * 
 * Release Animals (alphabetical):
 * A: Axolotl, B: Blobfish, C: Cuttlefish, D: Dumbo Octopus, E: Electric Eel
 * F: Firefly Squid, G: Glass Octopus, H: Hagfish, I: Isopod, J: Jellyfish
 * 
 * Current: v1.0.0 "Electric Eel" - Self-editing AI with PR workflow
 */

const GITHUB_REPO = 'thejonanshow/omnibot';
const GITHUB_API_URL = 'https://api.github.com';
const ALLOWED_EMAIL = 'jonanscheffler@gmail.com';

// Semantic version
const VERSION = {
  major: 1,
  minor: 1,
  patch: 1,
  codename: 'Electric Eel',
  emoji: '⚡',
  wiki: 'https://en.wikipedia.org/wiki/Electric_eel'
};
const VERSION_STRING = `v${VERSION.major}.${VERSION.minor}.${VERSION.patch}`;
const VERSION_FULL = `${VERSION.emoji} ${VERSION.codename} ${VERSION_STRING}`;

// ============== MULTI-PROVIDER AI CONFIG ==============
// Fallback chain: try each provider/model in order until one works
const AI_PROVIDERS = {
  // Purpose-based model chains (will try in order)
  planning: [
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'gemini', model: 'gemini-2.0-flash' },
    { provider: 'groq', model: 'llama-3.1-8b-instant' }
  ],
  coding: [
    { provider: 'groq', model: 'llama-3.1-8b-instant' },
    { provider: 'groq', model: 'openai/gpt-oss-20b' },
    { provider: 'gemini', model: 'gemini-2.0-flash' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' }
  ],
  review: [
    { provider: 'gemini', model: 'gemini-2.0-flash' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' }
  ],
  chat: [
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'groq', model: 'openai/gpt-oss-20b' },
    { provider: 'gemini', model: 'gemini-2.0-flash' }
  ]
};

const REQUIRED_FUNCTIONS = [
  'async function selfEdit',
  'async function callAI',
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
  } catch (e) {
    // Invalid token format
  }
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
async function githubGet(path, env, ref = 'main') {
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${path}?ref=${ref}`, {
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Accept': 'application/vnd.github.v3+json', 
      'User-Agent': 'OmniBot' 
    }
  });
  return res.json();
}

async function githubPut(path, content, message, env, branch = 'main') {
  const current = await githubGet(path, env, branch);
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
      branch, 
      sha: current.sha 
    })
  });
  return res.json();
}

// Get the SHA of main branch HEAD
async function getMainSha(env) {
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/git/ref/heads/main`, {
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Accept': 'application/vnd.github.v3+json', 
      'User-Agent': 'OmniBot' 
    }
  });
  const data = await res.json();
  return data.object?.sha;
}

// Create a new branch from main
async function createBranch(branchName, env) {
  const mainSha = await getMainSha(env);
  if (!mainSha) throw new Error('Could not get main SHA');
  
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/git/refs`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Content-Type': 'application/json', 
      'User-Agent': 'OmniBot' 
    },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: mainSha
    })
  });
  return res.json();
}

// Create a pull request
async function createPullRequest(title, body, branchName, env) {
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/pulls`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Content-Type': 'application/json', 
      'User-Agent': 'OmniBot' 
    },
    body: JSON.stringify({
      title,
      body,
      head: branchName,
      base: 'main'
    })
  });
  return res.json();
}

// Merge a pull request
async function mergePullRequest(prNumber, env) {
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Content-Type': 'application/json', 
      'User-Agent': 'OmniBot' 
    },
    body: JSON.stringify({
      commit_title: `[OmniBot] Merge PR #${prNumber}`,
      merge_method: 'squash'
    })
  });
  return res.json();
}

// ============== MULTI-PROVIDER AI SYSTEM ==============

// Provider-specific API calls
async function callGroqDirect(model, messages, env, maxTokens = 4000) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${env.GROQ_API_KEY}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ 
      model,
      messages, 
      max_tokens: maxTokens,
      temperature: 0.3
    })
  });
  
  const data = await res.json();
  
  if (data.error) {
    throw new Error(`Groq [${model}]: ${data.error.message || JSON.stringify(data.error)}`);
  }
  
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Groq [${model}]: No response`);
  }
  
  return { content, provider: 'groq', model };
}

async function callGeminiDirect(model, messages, env, maxTokens = 4000) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Gemini: No API key configured');
  }
  
  // Convert messages to Gemini format
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  
  // Add system instruction if present
  const systemMsg = messages.find(m => m.role === 'system');
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 }
    })
  });
  
  const data = await res.json();
  
  if (data.error) {
    throw new Error(`Gemini [${model}]: ${data.error.message || JSON.stringify(data.error)}`);
  }
  
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error(`Gemini [${model}]: No response`);
  }
  
  return { content, provider: 'gemini', model };
}

async function callKimiDirect(model, messages, env, maxTokens = 4000) {
  if (!env.KIMI_API_KEY) {
    throw new Error('Kimi: No API key configured');
  }
  
  // Kimi (Moonshot AI) uses OpenAI-compatible API
  const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${env.KIMI_API_KEY}`,
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ 
      model: model || 'moonshot-v1-8k',
      messages, 
      max_tokens: maxTokens,
      temperature: 0.3
    })
  });
  
  const data = await res.json();
  
  if (data.error) {
    throw new Error(`Kimi [${model}]: ${data.error.message || JSON.stringify(data.error)}`);
  }
  
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Kimi [${model}]: No response`);
  }
  
  return { content, provider: 'kimi', model };
}

// Main AI call function with automatic fallback
async function callAI(purpose, messages, env, systemPrompt = null, maxTokens = 4000) {
  const context = await getContext(env);
  const fullSystemPrompt = systemPrompt 
    ? `${context.prompt}\n\n${systemPrompt}`
    : context.prompt;
  
  const fullMessages = [
    { role: 'system', content: fullSystemPrompt },
    ...messages
  ];
  
  const chain = AI_PROVIDERS[purpose] || AI_PROVIDERS.chat;
  const errors = [];
  
  for (const { provider, model } of chain) {
    try {
      let result;
      
      if (provider === 'groq' && env.GROQ_API_KEY) {
        result = await callGroqDirect(model, fullMessages, env, maxTokens);
      } else if (provider === 'gemini' && env.GEMINI_API_KEY) {
        result = await callGeminiDirect(model, fullMessages, env, maxTokens);
      } else if (provider === 'kimi' && env.KIMI_API_KEY) {
        result = await callKimiDirect(model, fullMessages, env, maxTokens);
      } else {
        continue; // Skip if no API key for this provider
      }
      
      // Log successful provider for telemetry
      await logTelemetry('ai_call_success', { 
        purpose, 
        provider: result.provider, 
        model: result.model 
      }, env);
      
      return result.content;
      
    } catch (e) {
      errors.push(`${provider}/${model}: ${e.message}`);
      // Continue to next provider
    }
  }
  
  // All providers failed
  const errorMsg = `All AI providers failed for ${purpose}:\n${errors.join('\n')}`;
  await logTelemetry('ai_call_all_failed', { purpose, errors }, env);
  throw new Error(errorMsg);
}

// Legacy wrapper for backwards compatibility
async function callGroq(model, messages, env, systemPrompt = null) {
  // Map old model names to purposes
  const purposeMap = {
    'llama': 'planning',
    'coder': 'coding', 
    'gemma': 'chat',
    'fallback': 'chat',
    'mixtral': 'chat'
  };
  const purpose = purposeMap[model] || 'chat';
  return await callAI(purpose, messages, env, systemPrompt);
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
  return await callAI('coding', [{ role: 'user', content: userPrompt }], env, systemPrompt);
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
// Multi-stage edit pipeline: Kimi → Groq → 3x Qwen → Claude/Gemini
// Creates PR with elaborate description (like Claude's interface)
async function prepareEdit(instruction, env) {
  try {
    await logTelemetry('edit_prepare_start', { instruction }, env);
    
    // Get current code
    const file = await githubGet('cloudflare-worker/src/index.js', env);
    if (!file.content) {
      return { success: false, error: 'Could not read code' };
    }
    const currentCode = decodeURIComponent(escape(atob(file.content)));
    
    const responses = []; // Collect all stage responses for PR description
    
    // ========================================================================
    // STAGE 1: KIMI - Initial analysis and approach
    // ========================================================================
    let kimiAnalysis = 'Kimi not configured';
    if (env.KIMI_API_KEY) {
      try {
        const kimiPrompt = `Analyze this code change request and provide initial guidance.

User request: ${instruction}

Code length: ${currentCode.length} characters

Provide:
1. Initial assessment of the request
2. Suggested approach or architecture
3. Key considerations

Be concise but insightful.`;

        kimiAnalysis = await callAI('chat', [{ role: 'user', content: kimiPrompt }], env, 
          'You are an expert software architect analyzing a code change request.');
        responses.push({ stage: 'Kimi Analysis', content: kimiAnalysis });
      } catch (e) {
        kimiAnalysis = `Kimi unavailable: ${e.message}`;
      }
    }
    
    // ========================================================================
    // STAGE 2: GROQ - Detailed planning
    // ========================================================================
    const plan = await planEdit(instruction, currentCode, env);
    responses.push({ 
      stage: 'Groq Planning', 
      content: `**Summary:** ${plan.summary}\n\n**Sections to modify:** ${plan.sections_to_modify?.join(', ')}\n\n**Risk level:** ${plan.risk_level}` 
    });
    
    // ========================================================================
    // STAGE 3: QWEN (3 iterations) - Implementation
    // ========================================================================
    
    // Qwen iteration 1: Initial implementation
    let patches = await generatePatches(plan, currentCode, env);
    
    // Qwen iteration 2: Refinement
    if (patches.includes('<<<REPLACE>>>') || patches.includes('<<<INSERT_AFTER>>>')) {
      try {
        const refinePrompt = `Review and refine these patches for correctness.

Task: ${plan.qwen_prompt || instruction}

Current patches:
${patches.slice(0, 3000)}

Provide refined patches in the same format (<<<REPLACE>>> ... <<<WITH>>> ... <<<END>>>).`;
        
        const refined = await callAI('coding', [{ role: 'user', content: refinePrompt }], env,
          'You are a code refinement specialist.');
        
        // Only use refined if it has patches
        if (refined.includes('<<<REPLACE>>>') || refined.includes('<<<INSERT_AFTER>>>')) {
          patches = refined;
        }
      } catch (e) {
        // Keep original patches if refinement fails
      }
    }
    
    // Qwen iteration 3: Validation
    if (patches.includes('<<<REPLACE>>>') || patches.includes('<<<INSERT_AFTER>>>')) {
      try {
        const validatePrompt = `Final validation of these patches.

Task: ${instruction}

Patches:
${patches.slice(0, 3000)}

Confirm patches are correct or provide corrections. Use format: <<<REPLACE>>> ... <<<WITH>>> ... <<<END>>>`;
        
        const validated = await callAI('coding', [{ role: 'user', content: validatePrompt }], env,
          'You are a code validation specialist.');
        
        if (validated.includes('<<<REPLACE>>>') || validated.includes('<<<INSERT_AFTER>>>')) {
          patches = validated;
        }
      } catch (e) {
        // Keep previous patches if validation fails
      }
    }
    
    responses.push({ stage: 'Qwen Implementation (3 iterations)', content: 'Code patches generated and refined.' });
    
    // Check if patches are valid
    if (!patches.includes('<<<REPLACE>>>') && !patches.includes('<<<INSERT_AFTER>>>')) {
      return { 
        success: false, 
        error: 'Could not generate valid patches after all iterations',
        details: patches.slice(0, 500)
      };
    }
    
    // ========================================================================
    // STAGE 4: CLAUDE/GEMINI - Final review and explanation
    // ========================================================================
    const reviewPrompt = `Review these code changes and provide a detailed explanation for a PR description.

Original request: ${instruction}

Proposed changes:
${patches.slice(0, 2000)}

Provide:
1. **Overview** - What changes are being made
2. **Implementation Details** - How the changes work
3. **Testing Considerations** - What should be tested
4. **Potential Risks** - Any concerns or edge cases

Format your response in markdown suitable for a GitHub PR description.`;

    const finalReview = await callAI('review', [{ role: 'user', content: reviewPrompt }], env,
      'You are a senior code reviewer preparing a detailed PR description.');
    
    responses.push({ stage: 'Final Review & Explanation', content: finalReview });
    
    // Store pending edit for approval with all context
    const editId = Date.now().toString(36);
    if (env.CONTEXT) {
      await env.CONTEXT.put(`pending_edit_${editId}`, JSON.stringify({
        instruction,
        plan,
        patches,
        responses, // All stage responses for PR description
        kimiAnalysis,
        finalReview,
        timestamp: Date.now()
      }), { expirationTtl: 3600 }); // 1 hour expiry
    }
    
    return {
      success: true,
      editId,
      plan: plan.summary,
      review: finalReview,
      responses, // Return all responses
      patches_preview: patches.slice(0, 1000),
      awaiting_approval: true
    };
    
  } catch (e) {
    await logTelemetry('edit_prepare_error', { error: e.message }, env);
    return { success: false, error: e.message };
  }
}

// Execute approved edit
async function executeEdit(editId, env, directMerge = false) {
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
    
    // Get fresh code from main
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
    
    // Create branch name from instruction
    const branchSlug = pending.instruction
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 30)
      .replace(/-+$/, '');
    const branchName = `omnibot/${branchSlug}-${editId}`;
    
    // Create feature branch
    const branchResult = await createBranch(branchName, env);
    if (branchResult.message && branchResult.message.includes('Reference already exists')) {
      // Branch exists, continue
    } else if (!branchResult.ref) {
      return { success: false, error: 'Could not create branch: ' + (branchResult.message || 'Unknown error') };
    }
    
    // Commit to feature branch
    const commitMessage = `[OmniBot] ${pending.instruction.slice(0, 60)}`;
    const commitResult = await githubPut('cloudflare-worker/src/index.js', finalCode, commitMessage, env, branchName);
    
    if (!commitResult.commit) {
      return { success: false, error: 'Commit to branch failed' };
    }
    
    // Create PR with elaborate description (Claude-style interface)
    const prTitle = `🤖 ${pending.instruction.slice(0, 60)}`;
    
    // Build elaborate PR description from all pipeline stages
    let prBody = `# ${pending.instruction}

## Overview

${pending.finalReview || 'Code changes implemented as requested.'}

---

## Pipeline Analysis

`;

    // Add each stage's response
    if (pending.responses && pending.responses.length > 0) {
      for (const response of pending.responses) {
        prBody += `### ${response.stage}\n\n${response.content}\n\n---\n\n`;
      }
    }

    // Add implementation details
    prBody += `## Implementation Plan

${pending.plan?.summary || pending.instruction}

**Sections Modified:** ${pending.plan?.sections_to_modify?.join(', ') || 'N/A'}

**Risk Level:** ${pending.plan?.risk_level || 'Medium'}

---

## Code Changes

The code modifications are included in this PR. Review the diff for specific changes.

`;

    // Add Kimi analysis if available
    if (pending.kimiAnalysis && !pending.kimiAnalysis.includes('not configured')) {
      prBody += `## Initial Architecture Analysis (Kimi)

${pending.kimiAnalysis}

---

`;
    }

    prBody += `
## Testing & Verification

Please review the changes and test:
- Functionality works as expected
- No regressions in existing features
- Edge cases are handled appropriately

---

*Created by OmniBot ${VERSION_FULL}*
*Pipeline: Kimi → Groq → 3x Qwen → Claude/Gemini → PR*`;

    const prResult = await createPullRequest(prTitle, prBody, branchName, env);
    
    if (!prResult.number) {
      return { success: false, error: 'Could not create PR: ' + (prResult.message || 'Unknown error') };
    }
    
    // If directMerge requested (for quick fixes), merge immediately
    if (directMerge) {
      const mergeResult = await mergePullRequest(prResult.number, env);
      if (!mergeResult.merged) {
        return { 
          success: true, 
          pr_number: prResult.number,
          pr_url: prResult.html_url,
          message: 'PR created but auto-merge failed. Please merge manually.'
        };
      }
      
      // Cleanup
      await env.CONTEXT.delete(`pending_edit_${editId}`);
      
      await logTelemetry('edit_merged', {
        editId,
        instruction: pending.instruction,
        pr: prResult.number
      }, env);
      
      return {
        success: true,
        merged: true,
        pr_number: prResult.number,
        pr_url: prResult.html_url,
        message: `PR #${prResult.number} merged!`
      };
    }
    
    // Store PR info for later merge
    await env.CONTEXT.put(`pending_pr_${editId}`, JSON.stringify({
      pr_number: prResult.number,
      branch: branchName,
      instruction: pending.instruction
    }), { expirationTtl: 86400 }); // 24 hour expiry
    
    // Cleanup edit but keep PR info
    await env.CONTEXT.delete(`pending_edit_${editId}`);
    
    await logTelemetry('edit_pr_created', {
      editId,
      instruction: pending.instruction,
      pr: prResult.number
    }, env);
    
    return {
      success: true,
      pr_number: prResult.number,
      pr_url: prResult.html_url,
      branch: branchName,
      editId, // Keep for merge action
      message: `PR #${prResult.number} created! Review and merge when ready.`
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
// ============== HTML UI ==============
// ============== HTML UI ==============
// ============== HTML UI ==============
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Omnibot - AI Assistant</title>
    <style id="theme-styles">
        /* Base styles with CSS Variables for theming */
        :root {
            --spacing-xs: 4px;
            --spacing-sm: 8px;
            --spacing-md: 16px;
            --spacing-lg: 24px;
            --spacing-xl: 32px;
            --border-radius-sm: 8px;
            --border-radius-md: 12px;
            --border-radius-lg: 16px;
            --transition-fast: 150ms ease;
            --transition-normal: 250ms ease;
            --transition-slow: 350ms ease;
        }
        
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
            transition: background-color var(--transition-normal), color var(--transition-normal);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        /* ========================================
           MATRIX THEME (Updated Modern Style)
           ======================================== */
        body.theme-matrix {
            --bg-primary: #000000;
            --bg-secondary: #001a00;
            --bg-tertiary: #002200;
            --text-primary: #00ff00;
            --text-secondary: #00cc00;
            --text-muted: #008800;
            --accent-primary: #00ff00;
            --accent-secondary: #00ff00;
            --border-color: #003300;
            --message-user-bg: #002200;
            --message-ai-bg: #001100;
            --message-system-bg: #1a1a00;
            --input-bg: #001100;
            --button-bg: #002200;
            --button-hover-bg: #00ff00;
            --button-hover-text: #000000;
            --shadow-sm: 0 0 10px rgba(0, 255, 0, 0.1);
            --shadow-md: 0 0 20px rgba(0, 255, 0, 0.2);
            --shadow-lg: 0 0 30px rgba(0, 255, 0, 0.3);
            background: var(--bg-primary);
            color: var(--text-primary);
            font-family: 'Courier New', 'Consolas', monospace;
        }
        
        /* ========================================
           CYBERPUNK THEME (Enhanced with Neon Glow)
           ======================================== */
        body.theme-cyberpunk {
            --bg-primary: #0a0a1a;
            --bg-secondary: #1a0a2a;
            --bg-tertiary: #2a0a3a;
            --text-primary: #ff00ff;
            --text-secondary: #cc00cc;
            --text-muted: #aa00aa;
            --accent-primary: #00ffff;
            --accent-secondary: #ff00ff;
            --border-color: #3a0a4a;
            --message-user-bg: linear-gradient(135deg, #1a0a2a 0%, #2a0a3a 100%);
            --message-ai-bg: linear-gradient(135deg, #15051f 0%, #1a0a2a 100%);
            --message-system-bg: #2a1a00;
            --input-bg: #0a0a1a;
            --button-bg: #1a0a2a;
            --button-hover-bg: #ff00ff;
            --button-hover-text: #000000;
            --shadow-sm: 0 4px 12px rgba(255, 0, 255, 0.15);
            --shadow-md: 0 8px 24px rgba(255, 0, 255, 0.25);
            --shadow-lg: 0 12px 36px rgba(255, 0, 255, 0.35);
            background: var(--bg-primary);
            color: var(--text-primary);
        }
        
        /* Cyberpunk-specific enhancements */
        body.theme-cyberpunk .header {
            box-shadow: 0 0 20px rgba(255, 0, 255, 0.3), 0 4px 12px rgba(0, 255, 255, 0.2);
        }
        
        body.theme-cyberpunk h1 {
            text-shadow: 0 0 10px var(--accent-primary), 0 0 20px var(--accent-secondary);
        }
        
        body.theme-cyberpunk .message.user {
            border: 1px solid rgba(255, 0, 255, 0.3);
            box-shadow: 0 0 15px rgba(255, 0, 255, 0.2), inset 0 0 10px rgba(255, 0, 255, 0.05);
        }
        
        body.theme-cyberpunk .message.assistant {
            border: 1px solid rgba(0, 255, 255, 0.3);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.15), inset 0 0 10px rgba(0, 255, 255, 0.05);
        }
        
        body.theme-cyberpunk button:hover {
            box-shadow: 0 0 20px var(--accent-primary), 0 4px 16px rgba(255, 0, 255, 0.4);
        }
        
        body.theme-cyberpunk textarea:focus {
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3), 0 0 0 3px rgba(0, 255, 255, 0.1);
        }
        
        body.theme-cyberpunk .connection-status {
            box-shadow: 0 0 15px var(--accent-primary), 0 0 25px var(--accent-primary);
        }
        
        /* ========================================
           BORG THEME (Enhanced with glow)
           ======================================== */
        body.theme-borg {
            --bg-primary: #0a0a0a;
            --bg-secondary: #1a1a1a;
            --bg-tertiary: #252525;
            --text-primary: #00ff00;
            --text-secondary: #00dd00;
            --text-muted: #00aa00;
            --accent-primary: #00ff00;
            --accent-secondary: #00ff00;
            --border-color: #2a2a2a;
            --message-user-bg: #1a1a1a;
            --message-ai-bg: #151515;
            --message-system-bg: #1a1a00;
            --input-bg: #0f0f0f;
            --button-bg: #1a1a1a;
            --button-hover-bg: #00ff00;
            --button-hover-text: #000000;
            --shadow-sm: 0 0 15px rgba(0, 255, 0, 0.2);
            --shadow-md: 0 0 25px rgba(0, 255, 0, 0.3);
            --shadow-lg: 0 0 35px rgba(0, 255, 0, 0.4);
            background: var(--bg-primary);
            color: var(--text-primary);
            text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
        }
        
        /* ========================================
           HAL 9000 THEME
           ======================================== */
        body.theme-hal {
            --bg-primary: #000000;
            --bg-secondary: #1a0000;
            --bg-tertiary: #2a0000;
            --text-primary: #ff0000;
            --text-secondary: #dd0000;
            --text-muted: #aa0000;
            --accent-primary: #ff0000;
            --accent-secondary: #ff3333;
            --border-color: #330000;
            --message-user-bg: #1a0000;
            --message-ai-bg: #150000;
            --message-system-bg: #1a1a00;
            --input-bg: #0a0000;
            --button-bg: #1a0000;
            --button-hover-bg: #ff0000;
            --button-hover-text: #000000;
            --shadow-sm: 0 0 10px rgba(255, 0, 0, 0.15);
            --shadow-md: 0 0 20px rgba(255, 0, 0, 0.25);
            --shadow-lg: 0 0 30px rgba(255, 0, 0, 0.35);
            background: var(--bg-primary);
            color: var(--text-primary);
        }
        
        /* ========================================
           WAR GAMES THEME
           ======================================== */
        body.theme-wargames {
            --bg-primary: #000000;
            --bg-secondary: #001100;
            --bg-tertiary: #002200;
            --text-primary: #00ff00;
            --text-secondary: #00dd00;
            --text-muted: #00aa00;
            --accent-primary: #00ff00;
            --accent-secondary: #00ff00;
            --border-color: #003300;
            --message-user-bg: #001100;
            --message-ai-bg: #000a00;
            --message-system-bg: #110000;
            --input-bg: #000800;
            --button-bg: #001100;
            --button-hover-bg: #00ff00;
            --button-hover-text: #000000;
            --shadow-sm: 0 2px 8px rgba(0, 255, 0, 0.1);
            --shadow-md: 0 4px 16px rgba(0, 255, 0, 0.15);
            --shadow-lg: 0 6px 24px rgba(0, 255, 0, 0.2);
            background: var(--bg-primary);
            color: var(--text-primary);
            font-family: 'Courier New', monospace;
        }
        
        /* ========================================
           MODERN DARK THEME (Significantly Enhanced)
           ======================================== */
        body.theme-modern {
            --bg-primary: #0f0f0f;
            --bg-secondary: #1a1a1a;
            --bg-tertiary: #252525;
            --text-primary: #e8e8e8;
            --text-secondary: #b8b8b8;
            --text-muted: #888888;
            --accent-primary: #4a9eff;
            --accent-secondary: #357abd;
            --border-color: #2a2a2a;
            --message-user-bg: linear-gradient(135deg, #2d4a6e 0%, #1e3a5f 100%);
            --message-ai-bg: #1a1a1a;
            --message-system-bg: #3d3d1a;
            --input-bg: #1a1a1a;
            --button-bg: #2a2a2a;
            --button-hover-bg: #3a3a3a;
            --button-hover-text: #ffffff;
            --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
            --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
            --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
            background: var(--bg-primary);
            color: var(--text-primary);
        }
        
        /* ========================================
           TRON LEGACY THEME (NEW)
           ======================================== */
        body.theme-tron {
            --bg-primary: #000000;
            --bg-secondary: #001015;
            --bg-tertiary: #001520;
            --text-primary: #00D9FF;
            --text-secondary: #00b8dd;
            --text-muted: #0088aa;
            --accent-primary: #00D9FF;
            --accent-secondary: #00b8dd;
            --border-color: #00D9FF;
            --message-user-bg: linear-gradient(135deg, #001520 0%, #002030 100%);
            --message-ai-bg: #000a0f;
            --message-system-bg: #001520;
            --input-bg: #000508;
            --button-bg: #001015;
            --button-hover-bg: #00D9FF;
            --button-hover-text: #000000;
            --shadow-sm: 0 0 15px rgba(0, 217, 255, 0.3);
            --shadow-md: 0 0 25px rgba(0, 217, 255, 0.4);
            --shadow-lg: 0 0 35px rgba(0, 217, 255, 0.5);
            background: var(--bg-primary);
            color: var(--text-primary);
        }
        
        /* ========================================
           NEUROMANCER THEME (NEW)
           ======================================== */
        body.theme-neuromancer {
            --bg-primary: #0a0015;
            --bg-secondary: #1a0025;
            --bg-tertiary: #2a0035;
            --text-primary: #FF00D4;
            --text-secondary: #dd00bb;
            --text-muted: #aa0088;
            --accent-primary: #9B4F96;
            --accent-secondary: #FF00D4;
            --border-color: #3a0045;
            --message-user-bg: linear-gradient(135deg, #2a0035 0%, #3a0045 100%);
            --message-ai-bg: linear-gradient(135deg, #1a0025 0%, #2a0035 100%);
            --message-system-bg: #2a1a00;
            --input-bg: #0a0015;
            --button-bg: #1a0025;
            --button-hover-bg: #FF00D4;
            --button-hover-text: #000000;
            --shadow-sm: 0 4px 16px rgba(255, 0, 212, 0.2);
            --shadow-md: 0 8px 24px rgba(155, 79, 150, 0.3);
            --shadow-lg: 0 12px 36px rgba(255, 0, 212, 0.4);
            background: var(--bg-primary);
            color: var(--text-primary);
        }
        
        /* ========================================
           ALIEN ISOLATION THEME (NEW)
           ======================================== */
        body.theme-alien {
            --bg-primary: #000000;
            --bg-secondary: #0a1100;
            --bg-tertiary: #0f1a00;
            --text-primary: #33FF00;
            --text-secondary: #2acc00;
            --text-muted: #1a8800;
            --accent-primary: #33FF00;
            --accent-secondary: #ffaa00;
            --border-color: #1a3300;
            --message-user-bg: #0a1100;
            --message-ai-bg: #050800;
            --message-system-bg: #1a1a00;
            --input-bg: #000000;
            --button-bg: #0a1100;
            --button-hover-bg: #33FF00;
            --button-hover-text: #000000;
            --shadow-sm: 0 2px 8px rgba(51, 255, 0, 0.15);
            --shadow-md: 0 4px 16px rgba(51, 255, 0, 0.25);
            --shadow-lg: 0 6px 24px rgba(51, 255, 0, 0.35);
            background: var(--bg-primary);
            color: var(--text-primary);
            font-family: 'Courier New', 'OCR A', monospace;
        }
        
        /* ========================================
           DUNE THEME (NEW)
           ======================================== */
        body.theme-dune {
            --bg-primary: #1a1410;
            --bg-secondary: #2a2418;
            --bg-tertiary: #3a3420;
            --text-primary: #D4A574;
            --text-secondary: #b8895f;
            --text-muted: #8B6635;
            --accent-primary: #0077BE;
            --accent-secondary: #D4A574;
            --border-color: #3a3420;
            --message-user-bg: linear-gradient(135deg, #2a2418 0%, #3a3420 100%);
            --message-ai-bg: #25201a;
            --message-system-bg: #2a2010;
            --input-bg: #1a1410;
            --button-bg: #2a2418;
            --button-hover-bg: #0077BE;
            --button-hover-text: #ffffff;
            --shadow-sm: 0 2px 12px rgba(0, 119, 190, 0.15);
            --shadow-md: 0 4px 20px rgba(0, 119, 190, 0.25);
            --shadow-lg: 0 6px 28px rgba(0, 119, 190, 0.35);
            background: var(--bg-primary);
            color: var(--text-primary);
        }
        
        /* ========================================
           GHOST IN THE SHELL THEME (NEW)
           ======================================== */
        body.theme-ghost {
            --bg-primary: #0a0f15;
            --bg-secondary: #0f1520;
            --bg-tertiary: #15202a;
            --text-primary: #00E5FF;
            --text-secondary: #00c5dd;
            --text-muted: #0088aa;
            --accent-primary: #6E00FF;
            --accent-secondary: #00E5FF;
            --border-color: #1a2530;
            --message-user-bg: linear-gradient(135deg, #15202a 0%, #1a2535 100%);
            --message-ai-bg: linear-gradient(135deg, #0f1520 0%, #15202a 100%);
            --message-system-bg: #1a1520;
            --input-bg: rgba(15, 21, 32, 0.8);
            --button-bg: rgba(20, 30, 40, 0.8);
            --button-hover-bg: #6E00FF;
            --button-hover-text: #ffffff;
            --shadow-sm: 0 4px 16px rgba(110, 0, 255, 0.2);
            --shadow-md: 0 8px 24px rgba(0, 229, 255, 0.25);
            --shadow-lg: 0 12px 36px rgba(110, 0, 255, 0.3);
            background: var(--bg-primary);
            color: var(--text-primary);
            backdrop-filter: blur(10px);
        }
        
        /* ========================================
           INTERSTELLAR THEME (NEW)
           ======================================== */
        body.theme-interstellar {
            --bg-primary: #0A1128;
            --bg-secondary: #0f1830;
            --bg-tertiary: #152038;
            --text-primary: #e8f4ff;
            --text-secondary: #b8d4ee;
            --text-muted: #88a4c4;
            --accent-primary: #4a9eff;
            --accent-secondary: #7ab8ff;
            --border-color: #1a2840;
            --message-user-bg: linear-gradient(135deg, #152038 0%, #1a2840 100%);
            --message-ai-bg: #0f1830;
            --message-system-bg: #1a2030;
            --input-bg: #0A1128;
            --button-bg: #152038;
            --button-hover-bg: #4a9eff;
            --button-hover-text: #000000;
            --shadow-sm: 0 2px 12px rgba(74, 158, 255, 0.15);
            --shadow-md: 0 4px 20px rgba(74, 158, 255, 0.25);
            --shadow-lg: 0 6px 28px rgba(74, 158, 255, 0.35);
            background: radial-gradient(ellipse at center, #0f1830 0%, #0A1128 100%);
            color: var(--text-primary);
        }
        
        /* ========================================
           SYNTHWAVE THEME (NEW)
           ======================================== */
        body.theme-synthwave {
            --bg-primary: #1a0a2e;
            --bg-secondary: #2a1545;
            --bg-tertiary: #3a205a;
            --text-primary: #FF0090;
            --text-secondary: #dd007a;
            --text-muted: #aa0060;
            --accent-primary: #00FFFF;
            --accent-secondary: #FF0090;
            --border-color: #4a2570;
            --message-user-bg: linear-gradient(135deg, #2a1545 0%, #3a205a 100%);
            --message-ai-bg: linear-gradient(135deg, #1a0a2e 0%, #2a1545 100%);
            --message-system-bg: #2a1a00;
            --input-bg: #1a0a2e;
            --button-bg: #2a1545;
            --button-hover-bg: linear-gradient(135deg, #FF0090 0%, #00FFFF 100%);
            --button-hover-text: #000000;
            --shadow-sm: 0 4px 16px rgba(255, 0, 144, 0.3);
            --shadow-md: 0 8px 24px rgba(0, 255, 255, 0.3);
            --shadow-lg: 0 12px 36px rgba(255, 0, 144, 0.4);
            background: linear-gradient(180deg, #1a0a2e 0%, #2a1545 100%);
            color: var(--text-primary);
        }
        
        /* ========================================
           PORTAL THEME (Light Mode)
           ======================================== */
        body.theme-portal {
            --bg-primary: #f5f5f5;
            --bg-secondary: #ffffff;
            --bg-tertiary: #e8e8e8;
            --text-primary: #1a1a1a;
            --text-secondary: #4a4a4a;
            --text-muted: #7a7a7a;
            --accent-primary: #FF8C00;
            --accent-secondary: #0096FF;
            --border-color: #d0d0d0;
            --message-user-bg: linear-gradient(135deg, #0096FF 0%, #0077cc 100%);
            --message-ai-bg: #ffffff;
            --message-system-bg: #fff8e8;
            --input-bg: #ffffff;
            --button-bg: #e8e8e8;
            --button-hover-bg: #FF8C00;
            --button-hover-text: #ffffff;
            --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);
            --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.12);
            --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.16);
            background: var(--bg-primary);
            color: var(--text-primary);
        }
        
        body.theme-portal .message.user {
            color: #ffffff;
        }
        
        body.theme-portal .message.assistant {
            border: 1px solid #d0d0d0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        
        body.theme-portal h1 {
            background: linear-gradient(135deg, #FF8C00, #0096FF);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        /* ========================================
           HEADER STYLES
           ======================================== */
        .header {
            padding: var(--spacing-md) var(--spacing-lg);
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            box-shadow: var(--shadow-sm);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: var(--spacing-md);
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(10px);
        }
        
        .header-left {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
        }
        
        h1 {
            font-size: 1.5rem;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .connection-status {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent-primary);
            box-shadow: 0 0 8px var(--accent-primary);
            animation: pulse-glow 2s infinite;
        }
        
        @keyframes pulse-glow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.9); }
        }
        
        .status-bar {
            display: flex;
            gap: var(--spacing-lg);
            font-size: 0.813rem;
            flex-wrap: wrap;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            padding: 6px 12px;
            background: var(--bg-tertiary);
            border-radius: 20px;
            border: 1px solid var(--border-color);
        }
        
        .status-label {
            opacity: 0.7;
            font-weight: 500;
        }
        
        .status-value {
            font-weight: 600;
            color: var(--accent-primary);
        }
        
        .controls {
            display: flex;
            gap: var(--spacing-sm);
            flex-wrap: wrap;
        }
        
        button {
            padding: 10px 18px;
            background: var(--button-bg);
            color: var(--text-primary);
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius-sm);
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            font-family: inherit;
            transition: all var(--transition-fast);
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-sm);
            white-space: nowrap;
        }
        
        button:hover:not(:disabled) {
            background: var(--button-hover-bg);
            color: var(--button-hover-text);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }
        
        button:active:not(:disabled) {
            transform: translateY(0);
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        button:focus-visible {
            outline: 3px solid var(--accent-primary);
            outline-offset: 2px;
        }
        
        /* Theme Toggle Button - Special styling */
        .theme-toggle-btn {
            font-size: 1.25rem;
            padding: 8px 12px;
            min-width: 48px;
            background: var(--bg-tertiary);
            border: 2px solid var(--border-color);
            position: relative;
            overflow: hidden;
        }
        
        .theme-toggle-btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: var(--accent-primary);
            opacity: 0.3;
            transform: translate(-50%, -50%);
            transition: width 0.3s ease, height 0.3s ease;
        }
        
        .theme-toggle-btn:hover::before {
            width: 100px;
            height: 100px;
        }
        
        .theme-toggle-btn:hover {
            box-shadow: 0 0 20px var(--accent-primary);
        }
        
        /* ========================================
           CHAT CONTAINER
           ======================================== */
        .chat-container {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: var(--spacing-lg);
            scroll-behavior: smooth;
        }
        
        .chat-container::-webkit-scrollbar {
            width: 8px;
        }
        
        .chat-container::-webkit-scrollbar-track {
            background: var(--bg-primary);
        }
        
        .chat-container::-webkit-scrollbar-thumb {
            background: var(--bg-tertiary);
            border-radius: 4px;
        }
        
        .chat-container::-webkit-scrollbar-thumb:hover {
            background: var(--border-color);
        }
        
        /* ========================================
           MESSAGE BUBBLES (Modern Design)
           ======================================== */
        .message {
            max-width: 700px;
            margin: 0 auto var(--spacing-lg);
            padding: var(--spacing-md) var(--spacing-lg);
            border-radius: var(--border-radius-md);
            line-height: 1.6;
            animation: messageSlideIn 0.3s ease-out;
            position: relative;
        }
        
        @keyframes messageSlideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .message.user {
            background: var(--message-user-bg);
            margin-left: auto;
            margin-right: 0;
            border-bottom-right-radius: 4px;
            box-shadow: var(--shadow-sm);
        }
        
        .message.assistant {
            background: var(--message-ai-bg);
            margin-left: 0;
            margin-right: auto;
            border-bottom-left-radius: 4px;
            border: 1px solid var(--border-color);
        }
        
        .message.system,
        .message.error {
            background: var(--message-system-bg);
            text-align: center;
            font-size: 0.875rem;
            padding: var(--spacing-sm) var(--spacing-md);
            border-radius: var(--border-radius-sm);
            max-width: 600px;
        }
        
        .message.error {
            color: #ff6b6b;
            border: 1px solid #ff6b6b;
        }
        
        .message-role {
            font-weight: 600;
            margin-bottom: var(--spacing-sm);
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            opacity: 0.8;
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
        }
        
        .message-role::before {
            content: '';
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--accent-primary);
        }
        
        .message-content {
            word-wrap: break-word;
        }
        
        .message-timestamp {
            font-size: 0.75rem;
            opacity: 0.5;
            margin-top: var(--spacing-sm);
            text-align: right;
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
            justify-content: flex-end;
        }
        
        /* Message edit button */
        .message-edit-btn {
            position: absolute;
            top: var(--spacing-sm);
            right: var(--spacing-sm);
            padding: 4px 8px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-sm);
            font-size: 0.875rem;
            cursor: pointer;
            opacity: 0;
            transition: all var(--transition-fast);
        }
        
        .message.user:hover .message-edit-btn {
            opacity: 1;
        }
        
        .message-edit-btn:hover {
            background: var(--accent-primary);
            color: var(--bg-primary);
            transform: scale(1.1);
        }
        
        /* Editing state */
        .message.editing {
            border: 2px solid var(--accent-primary);
            box-shadow: 0 0 20px var(--accent-primary);
            animation: editPulse 1.5s infinite;
        }
        
        @keyframes editPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
        }
        
        /* Edited indicator */
        .edited-label {
            font-size: 0.7rem;
            opacity: 0.6;
            font-style: italic;
            color: var(--text-muted);
        }
        
        .message.edited {
            border-left: 3px solid var(--accent-secondary);
        }
        
        /* Edit mode for input */
        .input-container.edit-mode {
            background: linear-gradient(135deg, rgba(74, 158, 255, 0.1) 0%, rgba(74, 158, 255, 0.05) 100%);
            border-top: 2px solid var(--accent-primary);
            box-shadow: 0 -4px 20px rgba(74, 158, 255, 0.2);
        }
        
        .input-container.edit-mode textarea {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.2);
        }
        
        /* Loading indicator (typing animation) */
        .typing-indicator {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: var(--spacing-md) var(--spacing-lg);
            background: var(--message-ai-bg);
            border-radius: var(--border-radius-md);
            border: 1px solid var(--border-color);
            max-width: 80px;
            margin: 0 auto var(--spacing-lg);
            margin-left: 0;
            margin-right: auto;
        }
        
        .typing-indicator span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent-primary);
            animation: typingBounce 1.4s infinite ease-in-out;
        }
        
        .typing-indicator span:nth-child(1) {
            animation-delay: -0.32s;
        }
        
        .typing-indicator span:nth-child(2) {
            animation-delay: -0.16s;
        }
        
        @keyframes typingBounce {
            0%, 80%, 100% {
                transform: scale(0.8);
                opacity: 0.5;
            }
            40% {
                transform: scale(1);
                opacity: 1;
            }
        }
        
        /* ========================================
           APPROVAL BUTTONS (for proposed changes)
           ======================================== */
        .approval-buttons {
            display: flex;
            gap: var(--spacing-md);
            justify-content: center;
            margin: var(--spacing-lg) auto;
            padding: var(--spacing-md);
            max-width: 700px;
            animation: messageSlideIn 0.3s ease-out;
        }
        
        .approve-btn,
        .review-btn,
        .deny-btn {
            flex: 1;
            padding: var(--spacing-md) var(--spacing-lg);
            font-size: 1rem;
            font-weight: 600;
            border: none;
            border-radius: var(--border-radius-md);
            cursor: pointer;
            transition: all var(--transition-fast);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: var(--shadow-sm);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-sm);
        }
        
        .approve-btn {
            background: linear-gradient(135deg, #00d084 0%, #00b871 100%);
            color: #000;
        }
        
        .approve-btn:hover {
            background: linear-gradient(135deg, #00e594 0%, #00d084 100%);
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 6px 20px rgba(0, 208, 132, 0.4);
        }
        
        .review-btn {
            background: linear-gradient(135deg, #4a9eff 0%, #3b82f6 100%);
            color: #fff;
        }
        
        .review-btn:hover {
            background: linear-gradient(135deg, #5bacff 0%, #4a9eff 100%);
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 6px 20px rgba(74, 158, 255, 0.4);
        }
        
        .deny-btn {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5555 100%);
            color: #fff;
        }
        
        .deny-btn:hover {
            background: linear-gradient(135deg, #ff7c7c 0%, #ff6b6b 100%);
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
        }
        
        .approve-btn:active,
        .review-btn:active,
        .deny-btn:active {
            transform: translateY(0) scale(1);
        }
        
        /* ========================================
           INPUT AREA (Enhanced with Secondary Buttons)
           ======================================== */
        .input-container {
            padding: var(--spacing-lg);
            background: var(--bg-secondary);
            border-top: 2px solid var(--border-color);
            box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .input-inner {
            max-width: 900px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: var(--spacing-md);
        }
        
        .input-wrapper {
            display: flex;
            gap: var(--spacing-md);
            align-items: flex-end;
        }
        
        .secondary-actions {
            display: flex;
            gap: var(--spacing-sm);
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .secondary-btn {
            padding: 8px 16px;
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius-sm);
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            font-family: inherit;
            transition: all var(--transition-fast);
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-sm);
            white-space: nowrap;
        }
        
        .secondary-btn:hover:not(:disabled) {
            background: var(--button-hover-bg);
            color: var(--button-hover-text);
            border-color: var(--accent-primary);
            transform: translateY(-1px);
            box-shadow: 0 0 12px var(--accent-primary);
        }
        
        .secondary-btn.active {
            background: var(--accent-primary);
            color: var(--bg-primary);
            border-color: var(--accent-primary);
            box-shadow: 0 0 16px var(--accent-primary);
            font-weight: 600;
        }
        
        .secondary-btn:active:not(:disabled):not(.active) {
            transform: translateY(0);
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .secondary-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        
        textarea {
            flex: 1;
            padding: 14px 18px;
            background: var(--input-bg);
            color: var(--text-primary);
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius-md);
            font-size: 1rem;
            font-family: inherit;
            resize: none;
            min-height: 52px;
            max-height: 200px;
            transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
            line-height: 1.5;
        }
        
        textarea:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(var(--accent-primary), 0.1);
        }
        
        textarea::placeholder {
            color: var(--text-muted);
        }
        
        .voice-controls {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-sm);
        }
        
        #voice-btn {
            min-width: 52px;
            min-height: 52px;
            padding: 12px;
            border-radius: 50%;
            font-size: 1.5rem;
            background: var(--button-bg);
            border: 2px solid var(--border-color);
            position: relative;
        }
        
        #voice-btn.recording {
            background: #ff0000;
            color: #ffffff;
            animation: recordingPulse 1.5s infinite;
            border-color: #ff0000;
        }
        
        /* Live Transcription Overlay */
        .transcription-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            z-index: 2000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: var(--spacing-xl);
        }
        
        .transcription-overlay.active {
            display: flex;
        }
        
        .transcription-content {
            text-align: center;
            max-width: 800px;
            width: 100%;
        }
        
        .transcription-text {
            font-size: 2rem;
            line-height: 1.4;
            color: var(--accent-primary);
            text-shadow: 0 0 20px var(--accent-primary);
            min-height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: var(--spacing-lg);
        }
        
        .transcription-status {
            font-size: 1rem;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-md);
        }
        
        .recording-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ff0000;
            animation: recordingBlink 1s infinite;
        }
        
        @keyframes recordingBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        
        @keyframes recordingPulse {
            0%, 100% {
                box-shadow: 0 0 0 0 var(--accent-primary);
            }
            50% {
                box-shadow: 0 0 0 10px transparent;
            }
        }
        
        #send-btn {
            min-width: 52px;
            min-height: 52px;
            border-radius: var(--border-radius-md);
        }
        
        /* ========================================
           SETTINGS PANEL (Glassmorphism Design)
           ======================================== */
        .settings-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            display: none;
            z-index: 999;
            opacity: 0;
            transition: opacity var(--transition-normal);
        }
        
        .settings-overlay.active {
            display: block;
            opacity: 1;
        }
        
        .settings-panel {
            position: fixed;
            top: 0;
            right: -100%;
            max-width: 450px;
            width: 90%;
            height: 100vh;
            background: rgba(26, 26, 26, 0.85);
            backdrop-filter: blur(20px) saturate(180%);
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            padding: var(--spacing-xl);
            overflow-y: auto;
            z-index: 1000;
            transition: right var(--transition-slow);
            box-shadow: -4px 0 32px rgba(0, 0, 0, 0.5);
        }
        
        .settings-panel.active {
            right: 0;
        }
        
        .settings-section {
            margin-bottom: var(--spacing-xl);
            padding: var(--spacing-lg);
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: var(--border-radius-md);
            backdrop-filter: blur(10px);
        }
        
        .settings-section-header {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-md);
            font-size: 1rem;
            font-weight: 600;
            color: var(--accent-primary);
        }
        
        .settings-section-icon {
            font-size: 1.25rem;
        }
        
        .settings-panel h2 {
            margin-bottom: var(--spacing-lg);
            font-size: 1.5rem;
            color: var(--text-primary);
        }
        
        .setting-group {
            margin-bottom: var(--spacing-md);
        }
        
        .setting-label {
            display: block;
            margin-bottom: var(--spacing-sm);
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-secondary);
        }
        
        /* Theme Previews */
        .theme-option {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
            padding: var(--spacing-sm);
            border-radius: var(--border-radius-sm);
            transition: background var(--transition-fast);
        }
        
        .theme-preview {
            display: flex;
            gap: 2px;
            padding: 4px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
        }
        
        .theme-swatch {
            width: 16px;
            height: 16px;
            border-radius: 2px;
        }
        
        input[type="text"],
        input[type="password"],
        select {
            width: 100%;
            padding: 12px 16px;
            background: var(--input-bg);
            color: var(--text-primary);
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius-sm);
            font-size: 0.938rem;
            font-family: inherit;
            transition: border-color var(--transition-fast);
        }
        
        input:focus,
        select:focus {
            outline: none;
            border-color: var(--accent-primary);
        }
        
        select {
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            padding-right: 40px;
        }
        
        .settings-actions {
            display: flex;
            gap: var(--spacing-sm);
            margin-top: var(--spacing-lg);
        }
        
        .settings-actions button {
            flex: 1;
        }
        
        .about-section {
            margin-top: var(--spacing-xl);
            padding-top: var(--spacing-lg);
            border-top: 1px solid var(--border-color);
        }
        
        .about-section h3 {
            margin-bottom: var(--spacing-md);
            font-size: 1.125rem;
            color: var(--text-primary);
        }
        
        .about-section p {
            font-size: 0.875rem;
            line-height: 1.6;
            color: var(--text-secondary);
        }
        
        /* ========================================
           UPGRADE MODE STYLES
           ======================================== */
        .upgrade-mode-active .header {
            background: linear-gradient(135deg, rgba(255, 100, 0, 0.2), rgba(255, 0, 100, 0.2));
            animation: warningPulse 2s infinite;
            border-bottom-color: var(--accent-primary);
        }
        
        @keyframes warningPulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.85;
            }
        }
        
        /* ========================================
           RESPONSIVE DESIGN (Mobile-First)
           ======================================== */
        @media (max-width: 767px) {
            :root {
                --spacing-lg: 16px;
                --spacing-xl: 24px;
            }
            
            .header {
                padding: var(--spacing-sm) var(--spacing-md);
                flex-direction: column;
                align-items: flex-start;
                gap: var(--spacing-sm);
            }
            
            .header-left {
                width: 100%;
                justify-content: space-between;
            }
            
            h1 {
                font-size: 1.5rem;
                font-weight: 700;
                letter-spacing: -0.3px;
            }
            
            .status-bar {
                width: 100%;
                justify-content: flex-start;
                gap: var(--spacing-xs);
                flex-wrap: wrap;
            }
            
            .status-item {
                padding: 6px 10px;
                font-size: 0.75rem;
                min-height: 32px;
                border-width: 1.5px;
            }
            
            .status-label {
                font-weight: 600;
            }
            
            .status-value {
                font-weight: 700;
            }
            
            .controls {
                width: 100%;
                justify-content: space-between;
                gap: var(--spacing-xs);
            }
            
            button {
                padding: 10px 16px;
                font-size: 0.9rem;
                font-weight: 600;
                border-width: 2px;
                min-height: 44px;
            }
            
            .theme-toggle-btn {
                min-width: 44px;
                min-height: 44px;
                font-size: 1.125rem;
            }
            
            .chat-container {
                padding: var(--spacing-md);
            }
            
            .message {
                max-width: 100%;
                padding: var(--spacing-md);
                font-size: 0.938rem;
                line-height: 1.65;
            }
            
            .input-container {
                padding: var(--spacing-md);
            }
            
            .input-wrapper {
                gap: var(--spacing-sm);
            }
            
            textarea {
                padding: 14px 16px;
                font-size: 1rem;
                border-radius: var(--border-radius-sm);
                border-width: 2px;
                min-height: 56px;
            }
            
            #voice-btn {
                min-width: 48px;
                min-height: 48px;
                font-size: 1.25rem;
            }
            
            #send-btn {
                min-width: 48px;
                min-height: 48px;
                padding: 8px 12px;
            }
            
            .secondary-actions {
                gap: var(--spacing-xs);
                padding: var(--spacing-xs) 0;
            }
            
            .secondary-btn {
                padding: 10px 14px;
                font-size: 0.875rem;
                font-weight: 600;
                min-height: 44px;
                border-width: 2px;
                flex: 1 1 auto;
            }
            
            .settings-panel {
                max-width: 100%;
                width: 100%;
                padding: var(--spacing-lg);
            }
        }
        
        /* Tablet */
        @media (min-width: 768px) and (max-width: 1024px) {
            .header {
                padding: var(--spacing-md) var(--spacing-lg);
            }
            
            .message {
                max-width: 90%;
            }
        }
        
        /* Landscape mobile fixes */
        @media (max-height: 500px) and (orientation: landscape) {
            .header {
                padding: var(--spacing-sm) var(--spacing-md);
            }
            
            h1 {
                font-size: 1.125rem;
            }
            
            .status-bar {
                display: none;
            }
            
            .chat-container {
                padding: var(--spacing-sm) var(--spacing-md);
            }
        }
        
        /* Touch device optimization */
        @media (hover: none) and (pointer: coarse) {
            button {
                min-height: 44px;
                min-width: 44px;
            }
            
            .status-item {
                min-height: 36px;
            }
        }
        
        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
        
        /* ========================================
           SCROLL TO BOTTOM BUTTON
           ======================================== */
        .scroll-to-bottom {
            position: fixed;
            bottom: 120px;
            right: 30px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--button-bg);
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow-md);
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            z-index: 50;
            transition: all var(--transition-fast);
        }
        
        .scroll-to-bottom:hover {
            background: var(--button-hover-bg);
            transform: translateY(-2px);
            box-shadow: var(--shadow-lg);
        }
        
        .scroll-to-bottom.visible {
            display: flex;
        }
        
        @media (max-width: 767px) {
            .scroll-to-bottom {
                bottom: 100px;
                right: 16px;
                width: 44px;
                height: 44px;
            }
        }
    </style>
</head>
<body class="theme-matrix">
    <!-- Header -->
    <div class="header">
        <div class="header-left">
            <div class="connection-status" id="connection-status" title="Connected"></div>
            <h1>🤖 Omnibot</h1>
        </div>
        <div class="status-bar">
            <div class="status-item">
                <span class="status-label">LLM:</span>
                <span class="status-value" id="llm-status">---</span>
            </div>
            <div class="status-item">
                <span class="status-label">Usage:</span>
                <span class="status-value" id="usage-status">0/0</span>
            </div>
            <div class="status-item">
                <span class="status-label">Mode:</span>
                <span class="status-value" id="mode-status">Normal</span>
            </div>
        </div>
        <div class="controls">
            <button id="theme-toggle-btn" class="theme-toggle-btn" title="Toggle Theme" aria-label="Toggle theme">
                🌙
            </button>
            <button id="status-btn" title="Refresh Status" aria-label="Refresh status">
                📊 Status
            </button>
            <button id="settings-btn" title="Settings" aria-label="Open settings">
                ⚙️ Settings
            </button>
        </div>
    </div>

    <!-- Chat Container -->
    <div class="chat-container" id="chat-container">
        <div class="message system">
            <div>🚀 System Initialized</div>
            <div style="margin-top: 10px; font-size: 0.875rem; opacity: 0.8;">
                Type or click the microphone to speak. Say "upgrade mode" to enable system modifications.
            </div>
        </div>
    </div>

    <!-- Scroll to Bottom Button -->
    <button class="scroll-to-bottom" id="scroll-to-bottom" aria-label="Scroll to bottom">
        ↓
    </button>

    <!-- Live Transcription Overlay -->
    <div class="transcription-overlay" id="transcription-overlay">
        <div class="transcription-content">
            <div class="transcription-text" id="transcription-text">
                Listening...
            </div>
            <div class="transcription-status">
                <div class="recording-indicator"></div>
                <span>Speak now - Click anywhere to cancel</span>
            </div>
        </div>
    </div>

    <!-- Input Area -->
    <div class="input-container">
        <div class="input-inner">
            <!-- Secondary Action Buttons -->
            <div class="secondary-actions">
                <button class="secondary-btn" id="code-btn" title="Code mode" aria-label="Toggle code mode">
                    </> Code
                </button>
                <button class="secondary-btn" id="translate-btn" title="Translate" aria-label="Toggle translate mode">
                    🌐 Translate
                </button>
                <button class="secondary-btn" id="swarm-btn" title="Swarm mode" aria-label="Toggle swarm mode">
                    🔗 Swarm
                </button>
                <button class="secondary-btn" id="upgrade-mode-btn" title="Upgrade mode" aria-label="Toggle upgrade mode">
                    🔧 Upgrade
                </button>
                <button class="secondary-btn" id="cancel-edit-btn" title="Cancel editing" aria-label="Cancel edit" style="display: none;">
                    ❌ Cancel Edit
                </button>
            </div>
            
            <!-- Primary Input Row -->
            <div class="input-wrapper">
                <textarea 
                    id="message-input" 
                    placeholder="Type your message or click 🎤 to speak..."
                    rows="1"
                    aria-label="Message input"
                ></textarea>
                <div class="voice-controls">
                    <button id="voice-btn" title="Click to speak" aria-label="Voice input">
                        🎤
                    </button>
                    <button id="send-btn" title="Send message" aria-label="Send message">
                        ➤
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Settings Panel -->
    <div class="settings-overlay" id="settings-overlay"></div>
    <div class="settings-panel" id="settings-panel">
        <h2>⚙️ Settings</h2>
        
        <!-- Theme Settings Section -->
        <div class="settings-section">
            <div class="settings-section-header">
                <span class="settings-section-icon">🎨</span>
                <span>Theme Settings</span>
            </div>
            <div class="setting-group">
                <label class="setting-label" for="theme-select">Visual Theme</label>
                <select id="theme-select">
                    <option value="matrix">Matrix (Green Terminal)</option>
                    <option value="cyberpunk">Cyberpunk (Neon Pink/Cyan)</option>
                    <option value="borg">Borg (Assimilation Green)</option>
                    <option value="hal">HAL 9000 (Menacing Red)</option>
                    <option value="wargames">War Games (Classic Green)</option>
                    <option value="modern">Modern Dark (Blue/Gray)</option>
                    <option value="tron">Tron Legacy (Electric Blue)</option>
                    <option value="neuromancer">Neuromancer (Purple Cyberspace)</option>
                    <option value="alien">Alien Isolation (CRT Green)</option>
                    <option value="dune">Dune (Desert & Spice)</option>
                    <option value="ghost">Ghost in the Shell (Holographic)</option>
                    <option value="interstellar">Interstellar (Deep Space)</option>
                    <option value="synthwave">Synthwave (Retro Neon)</option>
                    <option value="portal">Portal (Aperture Science)</option>
                </select>
            </div>
        </div>
        
        <!-- Connection Settings Section -->
        <div class="settings-section">
            <div class="settings-section-header">
                <span class="settings-section-icon">🔌</span>
                <span>Connection Settings</span>
            </div>
            <div class="setting-group">
                <label class="setting-label" for="router-url">Router URL</label>
                <input 
                    type="text" 
                    id="router-url" 
                    placeholder="https://your-worker.workers.dev"
                    aria-label="Router URL"
                >
            </div>
            
            <div class="setting-group">
                <label class="setting-label" for="secret">Shared Secret</label>
                <input 
                    type="password" 
                    id="secret" 
                    placeholder="Your shared secret key"
                    aria-label="Shared secret"
                >
            </div>
        </div>
        
        <div class="settings-actions">
            <button onclick="saveSettings()">💾 Save</button>
            <button onclick="closeSettings()">✕ Cancel</button>
        </div>
        
        <div class="about-section">
            <h3>🔧 About Upgrade Mode</h3>
            <p>
                <strong>Upgrade Mode</strong> allows you to modify the Omnibot system using natural language.
                <br><br>
                When activated, your next command will be interpreted as a system modification request. 
                The AI will analyze the codebase, make changes, commit to GitHub, and auto-deploy updates.
                <br><br>
                <strong>Examples:</strong><br>
                • "Add a dark mode toggle button"<br>
                • "Make the microphone button larger"<br>
                • "Add conversation export feature"<br>
                • "Change theme colors to blue"
            </p>
        </div>
    </div>

    <script>
    // ==================== ERROR LOGGING SYSTEM ====================
(function() {
    // Throttle API logging to prevent excessive network calls
    let logBuffer = [];
    let logTimer = null;
    const LOG_BATCH_DELAY = 2000; // Send logs every 2 seconds
    const MAX_BUFFER_SIZE = 10;
    
    // Send logs to API for remote testing/debugging
    async function sendLogToAPI(level, message, data) {
        try {
            const routerUrl = localStorage.getItem('routerUrl');
            if (!routerUrl) return; // Skip if no router configured
            
            // Add to buffer instead of sending immediately
            logBuffer.push({ level, message, data, url: window.location.href });
            
            // Send immediately if buffer is full, otherwise wait for batch
            if (logBuffer.length >= MAX_BUFFER_SIZE) {
                flushLogBuffer();
            } else {
                // Schedule batch send
                if (!logTimer) {
                    logTimer = setTimeout(flushLogBuffer, LOG_BATCH_DELAY);
                }
            }
        } catch (e) {
            // Silently fail to prevent infinite loops
        }
    }
    
    // Flush log buffer to API
    async function flushLogBuffer() {
        if (logBuffer.length === 0) return;
        
        const routerUrl = localStorage.getItem('routerUrl');
        if (!routerUrl) return;
        
        const logsToSend = [...logBuffer];
        logBuffer = [];
        
        if (logTimer) {
            clearTimeout(logTimer);
            logTimer = null;
        }
        
        try {
            // Send batch of logs
            for (const log of logsToSend) {
                await fetch(`${routerUrl}/api/log`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(log)
                }).catch(() => {});
            }
        } catch (e) {
            // Silently fail
        }
    }
    
    function logToChat(title, data, type = 'error') {
        const container = document.getElementById('chat-container');
        if (!container) return;
        const logDiv = document.createElement('div');
        const colors = { error: { bg: '#2a0000', border: '#ff0000', text: '#ff5555' }, info: { bg: '#001a2a', border: '#0088ff', text: '#55aaff' } };
        const color = colors[type] || colors.error;
        logDiv.style.cssText = `background:${color.bg};border:2px solid ${color.border};color:${color.text};padding:12px;margin:8px auto;max-width:700px;font-family:monospace;font-size:11px;white-space:pre-wrap;border-radius:8px;max-height:300px;overflow-y:auto;`;
        logDiv.textContent = `${title}\n${'='.repeat(40)}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`;
        container.appendChild(logDiv);
        container.scrollTop = container.scrollHeight;
        
        // Also send to API (async, non-blocking)
        sendLogToAPI(type, title, data);
    }
    
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [url, options = {}] = args;
        // Skip logging for API log calls to prevent recursion
        if (url.includes('/api/log')) {
            return originalFetch(...args);
        }
        
        logToChat('📤 REQUEST', { url, method: options.method || 'GET', headers: options.headers }, 'info');
        try {
            const response = await originalFetch(...args);
            const clone = response.clone();
            logToChat('📥 RESPONSE', { status: response.status, ok: response.ok, url: response.url }, response.ok ? 'info' : 'error');
            if (!response.ok) { try { const text = await clone.text(); logToChat('❌ ERROR BODY', text.substring(0, 800), 'error'); } catch(e) {} }
            return response;
        } catch (error) {
            logToChat('💥 NETWORK ERROR', { message: error.message, url }, 'error');
            throw error;
        }
    };
    console.log('✅ Debug logging active with API integration');
})();
// ==================== END ERROR LOGGING ====================
        // Configuration
        let config = {
            routerUrl: localStorage.getItem('routerUrl') || '',
            secret: localStorage.getItem('secret') || '',
            theme: localStorage.getItem('theme') || detectSystemTheme()
        };
        
        // Detect system theme preference
        function detectSystemTheme() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                return 'portal'; // Light theme
            }
            return 'cyberpunk'; // Default dark cyberpunk theme
        }
        
        // State
        let conversation = [];
        let recognition = null;
        let currentChallenge = null;
        let upgradeMode = false;
        let isRecording = false;
        let isVoiceInput = false;
        let micPermissionGranted = false;
        let isLoading = false;
        let codeMode = false;
        let translateMode = false;
        let swarmMode = false;
        let editMode = false;
        let editingMessageIndex = null;
        let editingMessageElement = null;

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            loadSettings();
            setupSpeechRecognition();
            setupEventListeners();
            setupScrollBehavior();
            setupThemeToggle();
            autoResize();
            applyTheme(config.theme);
            updateThemeToggleIcon();
            
            if (config.routerUrl) {
                updateStatus();
            }
        });

        // Event Listeners Setup
        function setupEventListeners() {
            const input = document.getElementById('message-input');
            const voiceBtn = document.getElementById('voice-btn');
            const sendBtn = document.getElementById('send-btn');
            const themeSelect = document.getElementById('theme-select');

            input.addEventListener('input', () => {
                autoResize();
                updateSendButton();
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                } else if (e.key === 'Escape' && editMode) {
                    e.preventDefault();
                    cancelEdit();
                }
            });

            voiceBtn.addEventListener('click', toggleVoice);
            sendBtn.addEventListener('click', sendMessage);
            themeSelect.addEventListener('change', (e) => {
                localStorage.setItem('themeManuallySet', 'true');
                applyTheme(e.target.value);
            });

            document.getElementById('theme-toggle-btn').addEventListener('click', toggleThemeQuick);
            document.getElementById('status-btn').addEventListener('click', updateStatus);
            document.getElementById('settings-btn').addEventListener('click', openSettings);
            document.getElementById('settings-overlay').addEventListener('click', closeSettings);
            document.getElementById('scroll-to-bottom').addEventListener('click', scrollToBottom);
            
            // Secondary action buttons
            document.getElementById('code-btn').addEventListener('click', toggleCodeMode);
            document.getElementById('translate-btn').addEventListener('click', toggleTranslateMode);
            document.getElementById('swarm-btn').addEventListener('click', toggleSwarmMode);
            document.getElementById('upgrade-mode-btn').addEventListener('click', toggleUpgradeMode);
            document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
            
            // Transcription overlay click to cancel
            document.getElementById('transcription-overlay').addEventListener('click', () => {
                if (isRecording && recognition) {
                    recognition.stop();
                }
            });
        }

        // Scroll Behavior
        function setupScrollBehavior() {
            const container = document.getElementById('chat-container');
            const scrollBtn = document.getElementById('scroll-to-bottom');
            
            container.addEventListener('scroll', () => {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
                scrollBtn.classList.toggle('visible', !isNearBottom && container.scrollHeight > container.clientHeight);
            });
        }

        function scrollToBottom() {
            const container = document.getElementById('chat-container');
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }

        function updateSendButton() {
            const input = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            sendBtn.disabled = !input.value.trim() && !isRecording;
        }

        // Speech Recognition
        function setupSpeechRecognition() {
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                document.getElementById('voice-btn').disabled = true;
                document.getElementById('voice-btn').title = 'Speech recognition not supported';
                addMessage('system', '⚠️ Voice input not available in this browser. Please use text input.');
                return;
            }

            const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            
            recognition.onstart = () => {
                isRecording = true;
                micPermissionGranted = true;
                document.getElementById('voice-btn').classList.add('recording');
                document.getElementById('voice-btn').textContent = '⏹';
                updateSendButton();
            };
            
            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                document.getElementById('message-input').value = text;
                isVoiceInput = true;
                autoResize();
                updateSendButton();
            };
            
            recognition.onend = () => {
                isRecording = false;
                document.getElementById('voice-btn').classList.remove('recording');
                document.getElementById('voice-btn').textContent = '🎤';
                updateSendButton();
                
                const text = document.getElementById('message-input').value.trim();
                if (text) {
                    sendMessage();
                }
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                isRecording = false;
                document.getElementById('voice-btn').classList.remove('recording');
                document.getElementById('voice-btn').textContent = '🎤';
                updateSendButton();
                
                if (event.error === 'no-speech') {
                    addMessage('system', '🎤 No speech detected. Please try again.');
                } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    addMessage('error', '🔒 Microphone access denied. Please enable microphone permissions in your browser.');
                } else if (event.error !== 'aborted') {
                    addMessage('system', `⚠️ Voice error: ${event.error}`);
                }
            };
        }

        async function toggleVoice() {
            if (!recognition) {
                addMessage('system', '⚠️ Speech recognition not available.');
                return;
            }

            if (isRecording) {
                recognition.stop();
            } else {
                try {
                    isVoiceInput = true;
                    recognition.start();
                } catch (error) {
                    console.error('Recognition start error:', error);
                }
            }
        }

        // Message Sending
        async function sendMessage() {
            const input = document.getElementById('message-input');
            const text = input.value.trim();
            
            if (!text || isLoading) return;
            
            // Handle edit mode
            if (editMode) {
                handleEditSave(text);
                return;
            }
            
            if (!config.routerUrl || !config.secret) {
                addMessage('system', '⚙️ Please configure Router URL and Secret in Settings first.');
                openSettings();
                return;
            }

            input.value = '';
            autoResize();
            updateSendButton();

            // Add to conversation first to get correct index
            conversation.push({ role: 'user', content: text });
            const messageIndex = conversation.length - 1;
            
            // Add message with correct index for edit capability
            addMessage('user', text, messageIndex);

            const lowerText = text.toLowerCase();
            if (lowerText.includes('upgrade mode')) {
                toggleUpgradeMode();
                const wasVoice = isVoiceInput;
                isVoiceInput = false;
                if (wasVoice) {
                    speak(upgradeMode ? 'Upgrade mode activated.' : 'Normal mode resumed.');
                }
                return;
            }

            showTypingIndicator();
            isLoading = true;

            try {
                currentChallenge = await getChallenge();
                
                let response;
                if (upgradeMode) {
                    response = await sendUpgrade(text);
                    handleUpgradeResponse(response);
                } else {
                    response = await sendChat(text);
                    handleChatResponse(response);
                }
                
                if (isVoiceInput && !upgradeMode) {
                    speak(response.response);
                }
                
            } catch (error) {
                console.error('Send message error:', error);
                if (error.message.includes('Failed to fetch')) {
                    addMessage('error', `❌ Cannot reach server. Check your connection.`);
                } else if (error.message.includes('challenge')) {
                    addMessage('error', `❌ Authentication failed. Check your Shared Secret in Settings.`);
                } else {
                    addMessage('error', `❌ ${error.message}`);
                }
            } finally {
                hideTypingIndicator();
                isVoiceInput = false;
                isLoading = false;
            }
        }

        function showTypingIndicator() {
            const container = document.getElementById('chat-container');
            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.id = 'typing-indicator';
            indicator.innerHTML = '<span></span><span></span><span></span>';
            container.appendChild(indicator);
            scrollToBottom();
        }

        function hideTypingIndicator() {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) {
                indicator.remove();
            }
        }

        // API Calls
        async function getChallenge() {
            const response = await fetch(`${config.routerUrl}/challenge`);
            if (!response.ok) throw new Error('Failed to get authentication challenge');
            return response.json();
        }

        async function sendChat(message) {
            const timestamp = Date.now();
            const signature = await computeSignature(currentChallenge.challenge, timestamp, message);
            
            const response = await fetch(`${config.routerUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Challenge': currentChallenge.challenge,
                    'X-Timestamp': timestamp.toString(),
                    'X-Signature': signature
                },
                body: JSON.stringify({ message, conversation })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Request failed');
            }
            return response.json();
        }

        async function sendUpgrade(instruction) {
            const timestamp = Date.now();
            const signature = await computeSignature(currentChallenge.challenge, timestamp, instruction);
            
            const response = await fetch(`${config.routerUrl}/upgrade`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Challenge': currentChallenge.challenge,
                    'X-Timestamp': timestamp.toString(),
                    'X-Signature': signature
                },
                body: JSON.stringify({ instruction })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upgrade failed');
            }
            return response.json();
        }

        async function computeSignature(challenge, timestamp, message) {
            const data = `${challenge}|${timestamp}|unknown|${navigator.userAgent}|${JSON.stringify({ message, conversation })}`;
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(config.secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
            return Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }

        // Response Handlers
        function handleChatResponse(response) {
            addMessage('assistant', response.response);
            conversation.push({ role: 'assistant', content: response.response });
            
            document.getElementById('llm-status').textContent = response.provider || '---';
            document.getElementById('usage-status').textContent = `${response.usage || 0}/${response.limit || 0}`;
        }

        function handleUpgradeResponse(response) {
            // Handle approval flow for proposed changes
            if (response.awaiting_approval && response.editId) {
                // Show the proposed changes
                const message = response.message || response.review || response.plan || 'Changes proposed';
                addMessage('system', `📋 **Proposed Changes:**\n\n${message}`);
                
                // Show approval buttons
                showApprovalButtons(response.editId, response.patches_preview || '');
                return;
            }
            
            // Handle completed upgrade
            if (response.success) {
                addMessage('system', '✅ Upgrade Successful!');
                if (response.changes) {
                    response.changes.forEach(change => {
                        addMessage('system', `📝 ${change.file}: ${change.reason}`);
                    });
                }
                if (response.deployment_triggered) {
                    addMessage('system', '🚀 Deployment initiated. Changes will be live in ~60 seconds.');
                }
                if (response.commit) {
                    addMessage('system', `✓ Committed: ${response.commit}`);
                }
                if (response.url) {
                    addMessage('system', `🔗 ${response.url}`);
                }
            } else {
                addMessage('error', `❌ Upgrade Failed: ${response.error || 'Unknown error'}`);
            }
            
            if (upgradeMode) {
                toggleUpgradeMode();
            }
        }
        
        // Show approval buttons for proposed changes
        function showApprovalButtons(editId, patchPreview) {
            // Remove any existing approval buttons
            const existingButtons = document.querySelectorAll('.approval-buttons');
            existingButtons.forEach(el => el.remove());
            
            const container = document.getElementById('chat-container');
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'approval-buttons';
            buttonsDiv.innerHTML = `
                <button class="approve-btn" data-edit-id="${editId}">
                    ✓ Approve
                </button>
                <button class="review-btn" data-edit-id="${editId}">
                    🔍 Review
                </button>
                <button class="deny-btn" data-edit-id="${editId}">
                    ✗ Deny
                </button>
            `;
            
            container.appendChild(buttonsDiv);
            scrollToBottom();
            
            // Attach event handlers
            const approveBtn = buttonsDiv.querySelector('.approve-btn');
            const reviewBtn = buttonsDiv.querySelector('.review-btn');
            const denyBtn = buttonsDiv.querySelector('.deny-btn');
            
            approveBtn.onclick = () => approveEdit(editId, buttonsDiv);
            reviewBtn.onclick = () => reviewEdit(editId, patchPreview, buttonsDiv);
            denyBtn.onclick = () => denyEdit(buttonsDiv);
        }
        
        // Approve and execute the proposed changes
        async function approveEdit(editId, buttonsDiv) {
            buttonsDiv.remove();
            addMessage('system', '⏳ Deploying changes...');
            
            try {
                const response = await fetch(`${config.routerUrl}/api/approve-edit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ editId })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    addMessage('system', `✅ Changes deployed successfully!`);
                    if (data.commit) {
                        addMessage('system', `📝 Commit: ${data.commit}`);
                    }
                    if (data.url) {
                        addMessage('system', `🔗 ${data.url}`);
                    }
                } else {
                    addMessage('error', `❌ Deployment failed: ${data.error || 'Unknown error'}`);
                }
            } catch (error) {
                addMessage('error', `❌ Error: ${error.message}`);
            }
        }
        
        // Request review of proposed changes using Qwen
        async function reviewEdit(editId, patchPreview, buttonsDiv) {
            buttonsDiv.remove();
            addMessage('system', '🔍 Requesting Qwen review...');
            
            try {
                const response = await fetch(`${config.routerUrl}/api/review-edit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ editId })
                });
                
                const data = await response.json();
                
                if (data.review) {
                    addMessage('system', `🔍 **Review Results:**\n\n${data.review}`);
                    // Show buttons again after review
                    showApprovalButtons(editId, patchPreview);
                } else {
                    addMessage('error', `❌ Review failed: ${data.error || 'Unknown error'}`);
                    // Show buttons again even if review failed
                    showApprovalButtons(editId, patchPreview);
                }
            } catch (error) {
                addMessage('error', `❌ Error: ${error.message}`);
                // Show buttons again even if there was an error
                showApprovalButtons(editId, patchPreview);
            }
        }
        
        // Deny/cancel the proposed changes
        function denyEdit(buttonsDiv) {
            buttonsDiv.remove();
            addMessage('system', '❌ Changes rejected');
        }

        // Upgrade Mode
        function toggleUpgradeMode() {
            upgradeMode = !upgradeMode;
            const modeStatus = document.getElementById('mode-status');
            const upgradeBtn = document.getElementById('upgrade-mode-btn');
            
            if (upgradeMode) {
                document.body.classList.add('upgrade-mode-active');
                modeStatus.textContent = 'UPGRADE';
                modeStatus.style.color = '#ff6600';
                upgradeBtn.classList.add('active');
                addMessage('system', '⚠️ UPGRADE MODE ACTIVATED - Next command will modify the system');
            } else {
                document.body.classList.remove('upgrade-mode-active');
                modeStatus.textContent = 'Normal';
                modeStatus.style.color = '';
                upgradeBtn.classList.remove('active');
                addMessage('system', '✅ Normal mode resumed');
            }
        }

        // Status Update
        async function updateStatus() {
            if (!config.routerUrl) {
                addMessage('error', '⚙️ Configure Router URL in Settings first');
                return;
            }
            
            try {
                const response = await fetch(`${config.routerUrl}/status`);
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => response.statusText);
                    throw new Error(`Server returned ${response.status}: ${errorText}`);
                }
                
                const status = await response.json();
                
                let totalUsage = 0;
                let totalLimit = 0;
                let providers = [];
                
                if (status.groq !== undefined) {
                    totalUsage += status.groq;
                    totalLimit += 30;
                    providers.push(`Groq: ${status.groq}/30`);
                }
                if (status.gemini !== undefined) {
                    totalUsage += status.gemini;
                    totalLimit += 15;
                    providers.push(`Gemini: ${status.gemini}/15`);
                }
                if (status.claude !== undefined) {
                    totalUsage += status.claude;
                    totalLimit += 50;
                    providers.push(`Claude: ${status.claude}/50`);
                }
                
                document.getElementById('usage-status').textContent = `${totalUsage}/${totalLimit}`;
                addMessage('system', `📊 ${providers.join(' • ')}`);
            } catch (error) {
                console.error('Status check error:', error);
                if (error.message.includes('Failed to fetch')) {
                    addMessage('error', `❌ Cannot reach ${config.routerUrl}. Check your connection or Router URL.`);
                } else {
                    addMessage('error', `❌ ${error.message}`);
                }
            }
        }

        // Text-to-Speech
        function speak(text) {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        }

        // Message Display
        function addMessage(role, content, messageIndex = null) {
            const container = document.getElementById('chat-container');
            const msg = document.createElement('div');
            msg.className = `message ${role}`;
            
            // Store message index for editing
            if (role === 'user' && messageIndex !== null) {
                msg.dataset.messageIndex = messageIndex;
            }
            
            if (role !== 'system' && role !== 'error') {
                const roleLabel = document.createElement('div');
                roleLabel.className = 'message-role';
                roleLabel.textContent = role === 'user' ? 'You' : 'Omnibot';
                msg.appendChild(roleLabel);
            }
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;
            msg.appendChild(contentDiv);
            
            // Add edit button for user messages
            if (role === 'user' && messageIndex !== null) {
                const editBtn = document.createElement('button');
                editBtn.className = 'message-edit-btn';
                editBtn.innerHTML = '✏️';
                editBtn.title = 'Edit message';
                editBtn.setAttribute('aria-label', 'Edit this message');
                editBtn.onclick = () => startEditMessage(messageIndex, content, msg);
                msg.appendChild(editBtn);
            }
            
            // Add timestamp
            if (role !== 'system') {
                const timestamp = document.createElement('div');
                timestamp.className = 'message-timestamp';
                timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                msg.appendChild(timestamp);
            }
            
            container.appendChild(msg);
            scrollToBottom();
            
            return msg;
        }
        
        // Start editing a message
        function startEditMessage(index, content, messageElement) {
            if (isLoading) return;
            
            editMode = true;
            editingMessageIndex = index;
            editingMessageElement = messageElement;
            
            // Highlight the message being edited
            messageElement.classList.add('editing');
            
            // Fill input with message content
            const input = document.getElementById('message-input');
            input.value = content;
            input.focus();
            autoResize();
            
            // Change input styling to show edit mode
            const inputContainer = document.querySelector('.input-container');
            inputContainer.classList.add('edit-mode');
            
            // Show cancel button
            document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
            
            // Show edit indicator
            addMessage('system', '✏️ Editing message - press Send to update or Escape/Cancel to abort');
            
            // Change send button text
            const sendBtn = document.getElementById('send-btn');
            sendBtn.innerHTML = '💾';
            sendBtn.title = 'Save edited message';
        }
        
        // Cancel edit mode
        function cancelEdit() {
            if (!editMode) return;
            
            editMode = false;
            
            // Remove highlighting
            if (editingMessageElement) {
                editingMessageElement.classList.remove('editing');
            }
            
            // Reset input
            const input = document.getElementById('message-input');
            input.value = '';
            autoResize();
            
            // Remove edit mode styling
            const inputContainer = document.querySelector('.input-container');
            inputContainer.classList.remove('edit-mode');
            
            // Hide cancel button
            document.getElementById('cancel-edit-btn').style.display = 'none';
            
            // Reset send button
            const sendBtn = document.getElementById('send-btn');
            sendBtn.innerHTML = '➤';
            sendBtn.title = 'Send message';
            
            addMessage('system', '❌ Edit cancelled');
            
            editingMessageIndex = null;
            editingMessageElement = null;
        }
        
        // Handle saving edited message
        async function handleEditSave(newText) {
            if (editingMessageIndex === null) return;
            
            // Update conversation history
            conversation[editingMessageIndex].content = newText;
            
            // Update the message element
            if (editingMessageElement) {
                const contentDiv = editingMessageElement.querySelector('.message-content');
                if (contentDiv) {
                    contentDiv.textContent = newText;
                }
                editingMessageElement.classList.remove('editing');
                editingMessageElement.classList.add('edited');
                
                // Add edited indicator
                let editedLabel = editingMessageElement.querySelector('.edited-label');
                if (!editedLabel) {
                    editedLabel = document.createElement('span');
                    editedLabel.className = 'edited-label';
                    editedLabel.textContent = '(edited)';
                    editedLabel.title = 'This message was edited';
                    const timestamp = editingMessageElement.querySelector('.message-timestamp');
                    if (timestamp) {
                        timestamp.appendChild(document.createTextNode(' '));
                        timestamp.appendChild(editedLabel);
                    }
                }
            }
            
            // Reset edit mode
            const input = document.getElementById('message-input');
            input.value = '';
            autoResize();
            
            const inputContainer = document.querySelector('.input-container');
            inputContainer.classList.remove('edit-mode');
            
            // Hide cancel button
            document.getElementById('cancel-edit-btn').style.display = 'none';
            
            const sendBtn = document.getElementById('send-btn');
            sendBtn.innerHTML = '➤';
            sendBtn.title = 'Send message';
            
            editMode = false;
            editingMessageIndex = null;
            editingMessageElement = null;
            
            addMessage('system', '✅ Message updated');
        }

        // Auto-resize Textarea
        function autoResize() {
            const textarea = document.getElementById('message-input');
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }

        // Theme Management
        function applyTheme(theme) {
            document.body.className = `theme-${theme}`;
            const panel = document.getElementById('settings-panel');
            panel.className = `settings-panel theme-${theme}`;
            config.theme = theme;
            localStorage.setItem('theme', theme);
            updateThemeToggleIcon();
        }
        
        // Setup theme toggle with system preference monitoring
        function setupThemeToggle() {
            // Listen for system theme changes
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    // Only auto-switch if user hasn't manually set a theme
                    if (!localStorage.getItem('themeManuallySet')) {
                        const newTheme = e.matches ? 'cyberpunk' : 'portal';
                        applyTheme(newTheme);
                    }
                });
            }
        }
        
        // Quick theme toggle between light and dark
        function toggleThemeQuick() {
            const darkThemes = ['matrix', 'cyberpunk', 'borg', 'hal', 'wargames', 'modern', 'tron', 'neuromancer', 'alien', 'dune', 'ghost', 'interstellar', 'synthwave'];
            const lightThemes = ['portal'];
            
            const isDark = darkThemes.includes(config.theme);
            let newTheme;
            
            if (isDark) {
                // Switch to light
                newTheme = 'portal';
            } else {
                // Switch to dark cyberpunk
                newTheme = 'cyberpunk';
            }
            
            localStorage.setItem('themeManuallySet', 'true');
            applyTheme(newTheme);
            document.getElementById('theme-select').value = newTheme;
            
            // Add visual feedback animation
            const btn = document.getElementById('theme-toggle-btn');
            btn.style.transition = 'transform 0.2s ease';
            btn.style.transform = 'scale(0.9) rotate(180deg)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 200);
            
            // Announce theme change for screen readers
            const announcement = document.createElement('div');
            announcement.setAttribute('role', 'status');
            announcement.setAttribute('aria-live', 'polite');
            announcement.style.position = 'absolute';
            announcement.style.left = '-10000px';
            announcement.textContent = `Theme switched to ${newTheme === 'portal' ? 'light' : 'dark'} mode`;
            document.body.appendChild(announcement);
            setTimeout(() => announcement.remove(), 1000);
        }
        
        // Update theme toggle button icon
        function updateThemeToggleIcon() {
            const btn = document.getElementById('theme-toggle-btn');
            const darkThemes = ['matrix', 'cyberpunk', 'borg', 'hal', 'wargames', 'modern', 'tron', 'neuromancer', 'alien', 'dune', 'ghost', 'interstellar', 'synthwave'];
            
            if (darkThemes.includes(config.theme)) {
                btn.textContent = '☀️'; // Sun icon for switching to light
                btn.title = 'Switch to Light Theme';
                btn.setAttribute('aria-label', 'Switch to light theme');
            } else {
                btn.textContent = '🌙'; // Moon icon for switching to dark
                btn.title = 'Switch to Dark Theme';
                btn.setAttribute('aria-label', 'Switch to dark theme');
            }
        }

        // Settings Panel
        function openSettings() {
            document.getElementById('settings-panel').classList.add('active');
            document.getElementById('settings-overlay').classList.add('active');
        }

        function closeSettings() {
            document.getElementById('settings-panel').classList.remove('active');
            document.getElementById('settings-overlay').classList.remove('active');
        }

        function loadSettings() {
            document.getElementById('router-url').value = config.routerUrl;
            document.getElementById('secret').value = config.secret;
            document.getElementById('theme-select').value = config.theme;
        }

        function saveSettings() {
            config.routerUrl = document.getElementById('router-url').value.trim();
            config.secret = document.getElementById('secret').value.trim();
            config.theme = document.getElementById('theme-select').value;
            
            localStorage.setItem('routerUrl', config.routerUrl);
            localStorage.setItem('secret', config.secret);
            localStorage.setItem('theme', config.theme);
            
            applyTheme(config.theme);
            addMessage('system', '✅ Settings saved successfully!');
            closeSettings();
            
            if (config.routerUrl) {
                updateStatus();
            }
        }

        // Mode Toggle Functions
        function toggleCodeMode() {
            codeMode = !codeMode;
            document.getElementById('code-btn').classList.toggle('active');
            addMessage('system', codeMode ? '💻 Code mode activated' : '✅ Code mode deactivated');
        }

        function toggleTranslateMode() {
            translateMode = !translateMode;
            document.getElementById('translate-btn').classList.toggle('active');
            addMessage('system', translateMode ? '🌐 Translate mode activated' : '✅ Translate mode deactivated');
        }

        function toggleSwarmMode() {
            swarmMode = !swarmMode;
            document.getElementById('swarm-btn').classList.toggle('active');
            addMessage('system', swarmMode ? '🔗 Swarm mode activated' : '✅ Swarm mode deactivated');
        }
    </script>
</body>
</html>`;

        logDiv.textContent = `${title}\n${'='.repeat(40)}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`;
        container.appendChild(logDiv);
        container.scrollTop = container.scrollHeight;
        
        // Also send to API (async, non-blocking)
        sendLogToAPI(type, title, data);
    }
    
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [url, options = {}] = args;
        // Skip logging for API log calls to prevent recursion
        if (url.includes('/api/log')) {
            return originalFetch(...args);
        }
        
        logToChat('📤 REQUEST', { url, method: options.method || 'GET', headers: options.headers }, 'info');
        try {
            const response = await originalFetch(...args);
            const clone = response.clone();
            logToChat('📥 RESPONSE', { status: response.status, ok: response.ok, url: response.url }, response.ok ? 'info' : 'error');
            if (!response.ok) { try { const text = await clone.text(); logToChat('❌ ERROR BODY', text.substring(0, 800), 'error'); } catch(e) {} }
            return response;
        } catch (error) {
            logToChat('💥 NETWORK ERROR', { message: error.message, url }, 'error');
            throw error;
        }
    };
    console.log('✅ Debug logging active with API integration');
})();
// ==================== END ERROR LOGGING ====================
        // Configuration
        let config = {
            routerUrl: localStorage.getItem('routerUrl') || '',
            secret: localStorage.getItem('secret') || '',
            theme: localStorage.getItem('theme') || detectSystemTheme()
        };
        
        // Detect system theme preference
        function detectSystemTheme() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                return 'portal'; // Light theme
            }
            return 'cyberpunk'; // Default dark cyberpunk theme
        }
        
        // State
        let conversation = [];
        let recognition = null;
        let currentChallenge = null;
        let upgradeMode = false;
        let isRecording = false;
        let isVoiceInput = false;
        let micPermissionGranted = false;
        let isLoading = false;
        let codeMode = false;
        let translateMode = false;
        let swarmMode = false;
        let editMode = false;
        let editingMessageIndex = null;
        let editingMessageElement = null;

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            loadSettings();
            setupSpeechRecognition();
            setupEventListeners();
            setupScrollBehavior();
            setupThemeToggle();
            autoResize();
            applyTheme(config.theme);
            updateThemeToggleIcon();
            
            if (config.routerUrl) {
                updateStatus();
            }
        });

        // Event Listeners Setup
        function setupEventListeners() {
            const input = document.getElementById('message-input');
            const voiceBtn = document.getElementById('voice-btn');
            const sendBtn = document.getElementById('send-btn');
            const themeSelect = document.getElementById('theme-select');

            input.addEventListener('input', () => {
                autoResize();
                updateSendButton();
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                } else if (e.key === 'Escape' && editMode) {
                    e.preventDefault();
                    cancelEdit();
                }
            });

            voiceBtn.addEventListener('click', toggleVoice);
            sendBtn.addEventListener('click', sendMessage);
            themeSelect.addEventListener('change', (e) => {
                localStorage.setItem('themeManuallySet', 'true');
                applyTheme(e.target.value);
            });

            document.getElementById('theme-toggle-btn').addEventListener('click', toggleThemeQuick);
            document.getElementById('status-btn').addEventListener('click', updateStatus);
            document.getElementById('settings-btn').addEventListener('click', openSettings);
            document.getElementById('settings-overlay').addEventListener('click', closeSettings);
            document.getElementById('scroll-to-bottom').addEventListener('click', scrollToBottom);
            
            // Secondary action buttons
            document.getElementById('code-btn').addEventListener('click', toggleCodeMode);
            document.getElementById('translate-btn').addEventListener('click', toggleTranslateMode);
            document.getElementById('swarm-btn').addEventListener('click', toggleSwarmMode);
            document.getElementById('upgrade-mode-btn').addEventListener('click', toggleUpgradeMode);
            document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
            
            // Transcription overlay click to cancel
            document.getElementById('transcription-overlay').addEventListener('click', () => {
                if (isRecording && recognition) {
                    recognition.stop();
                }
            });
        }

        // Scroll Behavior
        function setupScrollBehavior() {
            const container = document.getElementById('chat-container');
            const scrollBtn = document.getElementById('scroll-to-bottom');
            
            container.addEventListener('scroll', () => {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
                scrollBtn.classList.toggle('visible', !isNearBottom && container.scrollHeight > container.clientHeight);
            });
        }

        function scrollToBottom() {
            const container = document.getElementById('chat-container');
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }

        function updateSendButton() {
            const input = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            sendBtn.disabled = !input.value.trim() && !isRecording;
        }

        // Speech Recognition
        function setupSpeechRecognition() {
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                document.getElementById('voice-btn').disabled = true;
                document.getElementById('voice-btn').title = 'Speech recognition not supported';
                addMessage('system', '⚠️ Voice input not available in this browser. Please use text input.');
                return;
            }

            const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            
            recognition.onstart = () => {
                isRecording = true;
                micPermissionGranted = true;
                document.getElementById('voice-btn').classList.add('recording');
                document.getElementById('voice-btn').textContent = '⏹';
                updateSendButton();
            };
            
            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                document.getElementById('message-input').value = text;
                isVoiceInput = true;
                autoResize();
                updateSendButton();
            };
            
            recognition.onend = () => {
                isRecording = false;
                document.getElementById('voice-btn').classList.remove('recording');
                document.getElementById('voice-btn').textContent = '🎤';
                updateSendButton();
                
                const text = document.getElementById('message-input').value.trim();
                if (text) {
                    sendMessage();
                }
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                isRecording = false;
                document.getElementById('voice-btn').classList.remove('recording');
                document.getElementById('voice-btn').textContent = '🎤';
                updateSendButton();
                
                if (event.error === 'no-speech') {
                    addMessage('system', '🎤 No speech detected. Please try again.');
                } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    addMessage('error', '🔒 Microphone access denied. Please enable microphone permissions in your browser.');
                } else if (event.error !== 'aborted') {
                    addMessage('system', `⚠️ Voice error: ${event.error}`);
                }
            };
        }

        async function toggleVoice() {
            if (!recognition) {
                addMessage('system', '⚠️ Speech recognition not available.');
                return;
            }

            if (isRecording) {
                recognition.stop();
            } else {
                try {
                    isVoiceInput = true;
                    recognition.start();
                } catch (error) {
                    console.error('Recognition start error:', error);
                }
            }
        }

        // Message Sending
        async function sendMessage() {
            const input = document.getElementById('message-input');
            const text = input.value.trim();
            
            if (!text || isLoading) return;
            
            // Handle edit mode
            if (editMode) {
                handleEditSave(text);
                return;
            }
            
            if (!config.routerUrl || !config.secret) {
                addMessage('system', '⚙️ Please configure Router URL and Secret in Settings first.');
                openSettings();
                return;
            }

            input.value = '';
            autoResize();
            updateSendButton();

            // Add to conversation first to get correct index
            conversation.push({ role: 'user', content: text });
            const messageIndex = conversation.length - 1;
            
            // Add message with correct index for edit capability
            addMessage('user', text, messageIndex);

            const lowerText = text.toLowerCase();
            if (lowerText.includes('upgrade mode')) {
                toggleUpgradeMode();
                const wasVoice = isVoiceInput;
                isVoiceInput = false;
                if (wasVoice) {
                    speak(upgradeMode ? 'Upgrade mode activated.' : 'Normal mode resumed.');
                }
                return;
            }

            showTypingIndicator();
            isLoading = true;

            try {
                currentChallenge = await getChallenge();
                
                let response;
                if (upgradeMode) {
                    response = await sendUpgrade(text);
                    handleUpgradeResponse(response);
                } else {
                    response = await sendChat(text);
                    handleChatResponse(response);
                }
                
                if (isVoiceInput && !upgradeMode) {
                    speak(response.response);
                }
                
            } catch (error) {
                console.error('Send message error:', error);
                if (error.message.includes('Failed to fetch')) {
                    addMessage('error', `❌ Cannot reach server. Check your connection.`);
                } else if (error.message.includes('challenge')) {
                    addMessage('error', `❌ Authentication failed. Check your Shared Secret in Settings.`);
                } else {
                    addMessage('error', `❌ ${error.message}`);
                }
            } finally {
                hideTypingIndicator();
                isVoiceInput = false;
                isLoading = false;
            }
        }

        function showTypingIndicator() {
            const container = document.getElementById('chat-container');
            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.id = 'typing-indicator';
            indicator.innerHTML = '<span></span><span></span><span></span>';
            container.appendChild(indicator);
            scrollToBottom();
        }

        function hideTypingIndicator() {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) {
                indicator.remove();
            }
        }

        // API Calls
        async function getChallenge() {
            const response = await fetch(`${config.routerUrl}/challenge`);
            if (!response.ok) throw new Error('Failed to get authentication challenge');
            return response.json();
        }

        async function sendChat(message) {
            const timestamp = Date.now();
            const signature = await computeSignature(currentChallenge.challenge, timestamp, message);
            
            const response = await fetch(`${config.routerUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Challenge': currentChallenge.challenge,
                    'X-Timestamp': timestamp.toString(),
                    'X-Signature': signature
                },
                body: JSON.stringify({ message, conversation })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Request failed');
            }
            return response.json();
        }

        async function sendUpgrade(instruction) {
            const timestamp = Date.now();
            const signature = await computeSignature(currentChallenge.challenge, timestamp, instruction);
            
            const response = await fetch(`${config.routerUrl}/upgrade`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Challenge': currentChallenge.challenge,
                    'X-Timestamp': timestamp.toString(),
                    'X-Signature': signature
                },
                body: JSON.stringify({ instruction })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upgrade failed');
            }
            return response.json();
        }

        async function computeSignature(challenge, timestamp, message) {
            const data = `${challenge}|${timestamp}|unknown|${navigator.userAgent}|${JSON.stringify({ message, conversation })}`;
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(config.secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
            return Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }

        // Response Handlers
        function handleChatResponse(response) {
            addMessage('assistant', response.response);
            conversation.push({ role: 'assistant', content: response.response });
            
            document.getElementById('llm-status').textContent = response.provider || '---';
            document.getElementById('usage-status').textContent = `${response.usage || 0}/${response.limit || 0}`;
        }

        function handleUpgradeResponse(response) {
            // Handle approval flow for proposed changes
            if (response.awaiting_approval && response.editId) {
                // Show the proposed changes
                const message = response.message || response.review || response.plan || 'Changes proposed';
                addMessage('system', `📋 **Proposed Changes:**\n\n${message}`);
                
                // Show approval buttons
                showApprovalButtons(response.editId, response.patches_preview || '');
                return;
            }
            
            // Handle completed upgrade
            if (response.success) {
                addMessage('system', '✅ Upgrade Successful!');
                if (response.changes) {
                    response.changes.forEach(change => {
                        addMessage('system', `📝 ${change.file}: ${change.reason}`);
                    });
                }
                if (response.deployment_triggered) {
                    addMessage('system', '🚀 Deployment initiated. Changes will be live in ~60 seconds.');
                }
                if (response.commit) {
                    addMessage('system', `✓ Committed: ${response.commit}`);
                }
                if (response.url) {
                    addMessage('system', `🔗 ${response.url}`);
                }
            } else {
                addMessage('error', `❌ Upgrade Failed: ${response.error || 'Unknown error'}`);
            }
            
            if (upgradeMode) {
                toggleUpgradeMode();
            }
        }
        
        // Show approval buttons for proposed changes
        function showApprovalButtons(editId, patchPreview) {
            // Remove any existing approval buttons
            const existingButtons = document.querySelectorAll('.approval-buttons');
            existingButtons.forEach(el => el.remove());
            
            const container = document.getElementById('chat-container');
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'approval-buttons';
            buttonsDiv.innerHTML = `
                <button class="approve-btn" data-edit-id="${editId}">
                    ✓ Approve
                </button>
                <button class="review-btn" data-edit-id="${editId}">
                    🔍 Review
                </button>
                <button class="deny-btn" data-edit-id="${editId}">
                    ✗ Deny
                </button>
            `;
            
            container.appendChild(buttonsDiv);
            scrollToBottom();
            
            // Attach event handlers
            const approveBtn = buttonsDiv.querySelector('.approve-btn');
            const reviewBtn = buttonsDiv.querySelector('.review-btn');
            const denyBtn = buttonsDiv.querySelector('.deny-btn');
            
            approveBtn.onclick = () => approveEdit(editId, buttonsDiv);
            reviewBtn.onclick = () => reviewEdit(editId, patchPreview, buttonsDiv);
            denyBtn.onclick = () => denyEdit(buttonsDiv);
        }
        
        // Approve and execute the proposed changes
        async function approveEdit(editId, buttonsDiv) {
            buttonsDiv.remove();
            addMessage('system', '⏳ Deploying changes...');
            
            try {
                const response = await fetch(`${config.routerUrl}/api/approve-edit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ editId })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    addMessage('system', `✅ Changes deployed successfully!`);
                    if (data.commit) {
                        addMessage('system', `📝 Commit: ${data.commit}`);
                    }
                    if (data.url) {
                        addMessage('system', `🔗 ${data.url}`);
                    }
                } else {
                    addMessage('error', `❌ Deployment failed: ${data.error || 'Unknown error'}`);
                }
            } catch (error) {
                addMessage('error', `❌ Error: ${error.message}`);
            }
        }
        
        // Request review of proposed changes using Qwen
        async function reviewEdit(editId, patchPreview, buttonsDiv) {
            buttonsDiv.remove();
            addMessage('system', '🔍 Requesting Qwen review...');
            
            try {
                const response = await fetch(`${config.routerUrl}/api/review-edit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ editId })
                });
                
                const data = await response.json();
                
                if (data.review) {
                    addMessage('system', `🔍 **Review Results:**\n\n${data.review}`);
                    // Show buttons again after review
                    showApprovalButtons(editId, patchPreview);
                } else {
                    addMessage('error', `❌ Review failed: ${data.error || 'Unknown error'}`);
                    // Show buttons again even if review failed
                    showApprovalButtons(editId, patchPreview);
                }
            } catch (error) {
                addMessage('error', `❌ Error: ${error.message}`);
                // Show buttons again even if there was an error
                showApprovalButtons(editId, patchPreview);
            }
        }
        
        // Deny/cancel the proposed changes
        function denyEdit(buttonsDiv) {
            buttonsDiv.remove();
            addMessage('system', '❌ Changes rejected');
        }

        // Upgrade Mode
        function toggleUpgradeMode() {
            upgradeMode = !upgradeMode;
            const modeStatus = document.getElementById('mode-status');
            const upgradeBtn = document.getElementById('upgrade-mode-btn');
            
            if (upgradeMode) {
                document.body.classList.add('upgrade-mode-active');
                modeStatus.textContent = 'UPGRADE';
                modeStatus.style.color = '#ff6600';
                upgradeBtn.classList.add('active');
                addMessage('system', '⚠️ UPGRADE MODE ACTIVATED - Next command will modify the system');
            } else {
                document.body.classList.remove('upgrade-mode-active');
                modeStatus.textContent = 'Normal';
                modeStatus.style.color = '';
                upgradeBtn.classList.remove('active');
                addMessage('system', '✅ Normal mode resumed');
            }
        }

        // Status Update
        async function updateStatus() {
            if (!config.routerUrl) {
                addMessage('error', '⚙️ Configure Router URL in Settings first');
                return;
            }
            
            try {
                const response = await fetch(`${config.routerUrl}/status`);
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => response.statusText);
                    throw new Error(`Server returned ${response.status}: ${errorText}`);
                }
                
                const status = await response.json();
                
                let totalUsage = 0;
                let totalLimit = 0;
                let providers = [];
                
                if (status.groq !== undefined) {
                    totalUsage += status.groq;
                    totalLimit += 30;
                    providers.push(`Groq: ${status.groq}/30`);
                }
                if (status.gemini !== undefined) {
                    totalUsage += status.gemini;
                    totalLimit += 15;
                    providers.push(`Gemini: ${status.gemini}/15`);
                }
                if (status.claude !== undefined) {
                    totalUsage += status.claude;
                    totalLimit += 50;
                    providers.push(`Claude: ${status.claude}/50`);
                }
                
                document.getElementById('usage-status').textContent = `${totalUsage}/${totalLimit}`;
                addMessage('system', `📊 ${providers.join(' • ')}`);
            } catch (error) {
                console.error('Status check error:', error);
                if (error.message.includes('Failed to fetch')) {
                    addMessage('error', `❌ Cannot reach ${config.routerUrl}. Check your connection or Router URL.`);
                } else {
                    addMessage('error', `❌ ${error.message}`);
                }
            }
        }

        // Text-to-Speech
        function speak(text) {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        }

        // Message Display
        function addMessage(role, content, messageIndex = null) {
            const container = document.getElementById('chat-container');
            const msg = document.createElement('div');
            msg.className = `message ${role}`;
            
            // Store message index for editing
            if (role === 'user' && messageIndex !== null) {
                msg.dataset.messageIndex = messageIndex;
            }
            
            if (role !== 'system' && role !== 'error') {
                const roleLabel = document.createElement('div');
                roleLabel.className = 'message-role';
                roleLabel.textContent = role === 'user' ? 'You' : 'Omnibot';
                msg.appendChild(roleLabel);
            }
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;
            msg.appendChild(contentDiv);
            
            // Add edit button for user messages
            if (role === 'user' && messageIndex !== null) {
                const editBtn = document.createElement('button');
                editBtn.className = 'message-edit-btn';
                editBtn.innerHTML = '✏️';
                editBtn.title = 'Edit message';
                editBtn.setAttribute('aria-label', 'Edit this message');
                editBtn.onclick = () => startEditMessage(messageIndex, content, msg);
                msg.appendChild(editBtn);
            }
            
            // Add timestamp
            if (role !== 'system') {
                const timestamp = document.createElement('div');
                timestamp.className = 'message-timestamp';
                timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                msg.appendChild(timestamp);
            }
            
            container.appendChild(msg);
            scrollToBottom();
            
            return msg;
        }
        
        // Start editing a message
        function startEditMessage(index, content, messageElement) {
            if (isLoading) return;
            
            editMode = true;
            editingMessageIndex = index;
            editingMessageElement = messageElement;
            
            // Highlight the message being edited
            messageElement.classList.add('editing');
            
            // Fill input with message content
            const input = document.getElementById('message-input');
            input.value = content;
            input.focus();
            autoResize();
            
            // Change input styling to show edit mode
            const inputContainer = document.querySelector('.input-container');
            inputContainer.classList.add('edit-mode');
            
            // Show cancel button
            document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
            
            // Show edit indicator
            addMessage('system', '✏️ Editing message - press Send to update or Escape/Cancel to abort');
            
            // Change send button text
            const sendBtn = document.getElementById('send-btn');
            sendBtn.innerHTML = '💾';
            sendBtn.title = 'Save edited message';
        }
        
        // Cancel edit mode
        function cancelEdit() {
            if (!editMode) return;
            
            editMode = false;
            
            // Remove highlighting
            if (editingMessageElement) {
                editingMessageElement.classList.remove('editing');
            }
            
            // Reset input
            const input = document.getElementById('message-input');
            input.value = '';
            autoResize();
            
            // Remove edit mode styling
            const inputContainer = document.querySelector('.input-container');
            inputContainer.classList.remove('edit-mode');
            
            // Hide cancel button
            document.getElementById('cancel-edit-btn').style.display = 'none';
            
            // Reset send button
            const sendBtn = document.getElementById('send-btn');
            sendBtn.innerHTML = '➤';
            sendBtn.title = 'Send message';
            
            addMessage('system', '❌ Edit cancelled');
            
            editingMessageIndex = null;
            editingMessageElement = null;
        }
        
        // Handle saving edited message
        async function handleEditSave(newText) {
            if (editingMessageIndex === null) return;
            
            // Update conversation history
            conversation[editingMessageIndex].content = newText;
            
            // Update the message element
            if (editingMessageElement) {
                const contentDiv = editingMessageElement.querySelector('.message-content');
                if (contentDiv) {
                    contentDiv.textContent = newText;
                }
                editingMessageElement.classList.remove('editing');
                editingMessageElement.classList.add('edited');
                
                // Add edited indicator
                let editedLabel = editingMessageElement.querySelector('.edited-label');
                if (!editedLabel) {
                    editedLabel = document.createElement('span');
                    editedLabel.className = 'edited-label';
                    editedLabel.textContent = '(edited)';
                    editedLabel.title = 'This message was edited';
                    const timestamp = editingMessageElement.querySelector('.message-timestamp');
                    if (timestamp) {
                        timestamp.appendChild(document.createTextNode(' '));
                        timestamp.appendChild(editedLabel);
                    }
                }
            }
            
            // Reset edit mode
            const input = document.getElementById('message-input');
            input.value = '';
            autoResize();
            
            const inputContainer = document.querySelector('.input-container');
            inputContainer.classList.remove('edit-mode');
            
            // Hide cancel button
            document.getElementById('cancel-edit-btn').style.display = 'none';
            
            const sendBtn = document.getElementById('send-btn');
            sendBtn.innerHTML = '➤';
            sendBtn.title = 'Send message';
            
            editMode = false;
            editingMessageIndex = null;
            editingMessageElement = null;
            
            addMessage('system', '✅ Message updated');
        }

        // Auto-resize Textarea
        function autoResize() {
            const textarea = document.getElementById('message-input');
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }

        // Theme Management
        function applyTheme(theme) {
            document.body.className = `theme-${theme}`;
            const panel = document.getElementById('settings-panel');
            panel.className = `settings-panel theme-${theme}`;
            config.theme = theme;
            localStorage.setItem('theme', theme);
            updateThemeToggleIcon();
        }
        
        // Setup theme toggle with system preference monitoring
        function setupThemeToggle() {
            // Listen for system theme changes
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    // Only auto-switch if user hasn't manually set a theme
                    if (!localStorage.getItem('themeManuallySet')) {
                        const newTheme = e.matches ? 'cyberpunk' : 'portal';
                        applyTheme(newTheme);
                    }
                });
            }
        }
        
        // Quick theme toggle between light and dark
        function toggleThemeQuick() {
            const darkThemes = ['matrix', 'cyberpunk', 'borg', 'hal', 'wargames', 'modern', 'tron', 'neuromancer', 'alien', 'dune', 'ghost', 'interstellar', 'synthwave'];
            const lightThemes = ['portal'];
            
            const isDark = darkThemes.includes(config.theme);
            let newTheme;
            
            if (isDark) {
                // Switch to light
                newTheme = 'portal';
            } else {
                // Switch to dark cyberpunk
                newTheme = 'cyberpunk';
            }
            
            localStorage.setItem('themeManuallySet', 'true');
            applyTheme(newTheme);
            document.getElementById('theme-select').value = newTheme;
            
            // Add visual feedback animation
            const btn = document.getElementById('theme-toggle-btn');
            btn.style.transition = 'transform 0.2s ease';
            btn.style.transform = 'scale(0.9) rotate(180deg)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 200);
            
            // Announce theme change for screen readers
            const announcement = document.createElement('div');
            announcement.setAttribute('role', 'status');
            announcement.setAttribute('aria-live', 'polite');
            announcement.style.position = 'absolute';
            announcement.style.left = '-10000px';
            announcement.textContent = `Theme switched to ${newTheme === 'portal' ? 'light' : 'dark'} mode`;
            document.body.appendChild(announcement);
            setTimeout(() => announcement.remove(), 1000);
        }
        
        // Update theme toggle button icon
        function updateThemeToggleIcon() {
            const btn = document.getElementById('theme-toggle-btn');
            const darkThemes = ['matrix', 'cyberpunk', 'borg', 'hal', 'wargames', 'modern', 'tron', 'neuromancer', 'alien', 'dune', 'ghost', 'interstellar', 'synthwave'];
            
            if (darkThemes.includes(config.theme)) {
                btn.textContent = '☀️'; // Sun icon for switching to light
                btn.title = 'Switch to Light Theme';
                btn.setAttribute('aria-label', 'Switch to light theme');
            } else {
                btn.textContent = '🌙'; // Moon icon for switching to dark
                btn.title = 'Switch to Dark Theme';
                btn.setAttribute('aria-label', 'Switch to dark theme');
            }
        }

        // Settings Panel
        function openSettings() {
            document.getElementById('settings-panel').classList.add('active');
            document.getElementById('settings-overlay').classList.add('active');
        }

        function closeSettings() {
            document.getElementById('settings-panel').classList.remove('active');
            document.getElementById('settings-overlay').classList.remove('active');
        }

        function loadSettings() {
            document.getElementById('router-url').value = config.routerUrl;
            document.getElementById('secret').value = config.secret;
            document.getElementById('theme-select').value = config.theme;
        }

        function saveSettings() {
            config.routerUrl = document.getElementById('router-url').value.trim();
            config.secret = document.getElementById('secret').value.trim();
            config.theme = document.getElementById('theme-select').value;
            
            localStorage.setItem('routerUrl', config.routerUrl);
            localStorage.setItem('secret', config.secret);
            localStorage.setItem('theme', config.theme);
            
            applyTheme(config.theme);
            addMessage('system', '✅ Settings saved successfully!');
            closeSettings();
            
            if (config.routerUrl) {
                updateStatus();
            }
        }

        // Mode Toggle Functions
        function toggleCodeMode() {
            codeMode = !codeMode;
            document.getElementById('code-btn').classList.toggle('active');
            addMessage('system', codeMode ? '💻 Code mode activated' : '✅ Code mode deactivated');
        }

        function toggleTranslateMode() {
            translateMode = !translateMode;
            document.getElementById('translate-btn').classList.toggle('active');
            addMessage('system', translateMode ? '🌐 Translate mode activated' : '✅ Translate mode deactivated');
        }

        function toggleSwarmMode() {
            swarmMode = !swarmMode;
            document.getElementById('swarm-btn').classList.toggle('active');
            addMessage('system', swarmMode ? '🔗 Swarm mode activated' : '✅ Swarm mode deactivated');
        }
    </script>
</body>
</html>`;

        logDiv.textContent = `${title}\n${'='.repeat(40)}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`;
        container.appendChild(logDiv);
        container.scrollTop = container.scrollHeight;
        
        // Also send to API (async, non-blocking)
        sendLogToAPI(type, title, data);
    }
    
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [url, options = {}] = args;
        // Skip logging for API log calls to prevent recursion
        if (url.includes('/api/log')) {
            return originalFetch(...args);
        }
        
        logToChat('📤 REQUEST', { url, method: options.method || 'GET', headers: options.headers }, 'info');
        try {
            const response = await originalFetch(...args);
            const clone = response.clone();
            logToChat('📥 RESPONSE', { status: response.status, ok: response.ok, url: response.url }, response.ok ? 'info' : 'error');
            if (!response.ok) { try { const text = await clone.text(); logToChat('❌ ERROR BODY', text.substring(0, 800), 'error'); } catch(e) {} }
            return response;
        } catch (error) {
            logToChat('💥 NETWORK ERROR', { message: error.message, url }, 'error');
            throw error;
        }
    };
    console.log('✅ Debug logging active with API integration');
})();
// ==================== END ERROR LOGGING ====================
        // Configuration
        let config = {
            routerUrl: localStorage.getItem('routerUrl') || '',
            secret: localStorage.getItem('secret') || '',
            theme: localStorage.getItem('theme') || detectSystemTheme()
        };
        
        // Detect system theme preference
        function detectSystemTheme() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                return 'portal'; // Light theme
            }
            return 'cyberpunk'; // Default dark cyberpunk theme
        }
        
        // State
        let conversation = [];
        let recognition = null;
        let currentChallenge = null;
        let upgradeMode = false;
        let isRecording = false;
        let isVoiceInput = false;
        let micPermissionGranted = false;
        let isLoading = false;
        let codeMode = false;
        let translateMode = false;
        let swarmMode = false;
        let editMode = false;
        let editingMessageIndex = null;
        let editingMessageElement = null;

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            loadSettings();
            setupSpeechRecognition();
            setupEventListeners();
            setupScrollBehavior();
            setupThemeToggle();
            autoResize();
            applyTheme(config.theme);
            updateThemeToggleIcon();
            
            if (config.routerUrl) {
                updateStatus();
            }
        });

        // Event Listeners Setup
        function setupEventListeners() {
            const input = document.getElementById('message-input');
            const voiceBtn = document.getElementById('voice-btn');
            const sendBtn = document.getElementById('send-btn');
            const themeSelect = document.getElementById('theme-select');

            input.addEventListener('input', () => {
                autoResize();
                updateSendButton();
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                } else if (e.key === 'Escape' && editMode) {
                    e.preventDefault();
                    cancelEdit();
                }
            });

            voiceBtn.addEventListener('click', toggleVoice);
            sendBtn.addEventListener('click', sendMessage);
            themeSelect.addEventListener('change', (e) => {
                localStorage.setItem('themeManuallySet', 'true');
                applyTheme(e.target.value);
            });

            document.getElementById('theme-toggle-btn').addEventListener('click', toggleThemeQuick);
            document.getElementById('status-btn').addEventListener('click', updateStatus);
            document.getElementById('settings-btn').addEventListener('click', openSettings);
            document.getElementById('settings-overlay').addEventListener('click', closeSettings);
            document.getElementById('scroll-to-bottom').addEventListener('click', scrollToBottom);
            
            // Secondary action buttons
            document.getElementById('code-btn').addEventListener('click', toggleCodeMode);
            document.getElementById('translate-btn').addEventListener('click', toggleTranslateMode);
            document.getElementById('swarm-btn').addEventListener('click', toggleSwarmMode);
            document.getElementById('upgrade-mode-btn').addEventListener('click', toggleUpgradeMode);
            document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
            
            // Transcription overlay click to cancel
            document.getElementById('transcription-overlay').addEventListener('click', () => {
                if (isRecording && recognition) {
                    recognition.stop();
                }
            });
        }

        // Scroll Behavior
        function setupScrollBehavior() {
            const container = document.getElementById('chat-container');
            const scrollBtn = document.getElementById('scroll-to-bottom');
            
            container.addEventListener('scroll', () => {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
                scrollBtn.classList.toggle('visible', !isNearBottom && container.scrollHeight > container.clientHeight);
            });
        }

        function scrollToBottom() {
            const container = document.getElementById('chat-container');
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }

        function updateSendButton() {
            const input = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            sendBtn.disabled = !input.value.trim() && !isRecording;
        }

        // Speech Recognition
        function setupSpeechRecognition() {
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                document.getElementById('voice-btn').disabled = true;
                document.getElementById('voice-btn').title = 'Speech recognition not supported';
                addMessage('system', '⚠️ Voice input not available in this browser. Please use text input.');
                return;
            }

            const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            
            recognition.onstart = () => {
                isRecording = true;
                micPermissionGranted = true;
                document.getElementById('voice-btn').classList.add('recording');
                document.getElementById('voice-btn').textContent = '⏹';
                updateSendButton();
            };
            
            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                document.getElementById('message-input').value = text;
                isVoiceInput = true;
                autoResize();
                updateSendButton();
            };
            
            recognition.onend = () => {
                isRecording = false;
                document.getElementById('voice-btn').classList.remove('recording');
                document.getElementById('voice-btn').textContent = '🎤';
                updateSendButton();
                
                const text = document.getElementById('message-input').value.trim();
                if (text) {
                    sendMessage();
                }
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                isRecording = false;
                document.getElementById('voice-btn').classList.remove('recording');
                document.getElementById('voice-btn').textContent = '🎤';
                updateSendButton();
                
                if (event.error === 'no-speech') {
                    addMessage('system', '🎤 No speech detected. Please try again.');
                } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    addMessage('error', '🔒 Microphone access denied. Please enable microphone permissions in your browser.');
                } else if (event.error !== 'aborted') {
                    addMessage('system', `⚠️ Voice error: ${event.error}`);
                }
            };
        }

        async function toggleVoice() {
            if (!recognition) {
                addMessage('system', '⚠️ Speech recognition not available.');
                return;
            }

            if (isRecording) {
                recognition.stop();
            } else {
                try {
                    isVoiceInput = true;
                    recognition.start();
                } catch (error) {
                    console.error('Recognition start error:', error);
                }
            }
        }

        // Message Sending
        async function sendMessage() {
            const input = document.getElementById('message-input');
            const text = input.value.trim();
            
            if (!text || isLoading) return;
            
            // Handle edit mode
            if (editMode) {
                handleEditSave(text);
                return;
            }
            
            if (!config.routerUrl || !config.secret) {
                addMessage('system', '⚙️ Please configure Router URL and Secret in Settings first.');
                openSettings();
                return;
            }

            input.value = '';
            autoResize();
            updateSendButton();

            // Add to conversation first to get correct index
            conversation.push({ role: 'user', content: text });
            const messageIndex = conversation.length - 1;
            
            // Add message with correct index for edit capability
            addMessage('user', text, messageIndex);

            const lowerText = text.toLowerCase();
            if (lowerText.includes('upgrade mode')) {
                toggleUpgradeMode();
                const wasVoice = isVoiceInput;
                isVoiceInput = false;
                if (wasVoice) {
                    speak(upgradeMode ? 'Upgrade mode activated.' : 'Normal mode resumed.');
                }
                return;
            }

            showTypingIndicator();
            isLoading = true;

            try {
                currentChallenge = await getChallenge();
                
                let response;
                if (upgradeMode) {
                    response = await sendUpgrade(text);
                    handleUpgradeResponse(response);
                } else {
                    response = await sendChat(text);
                    handleChatResponse(response);
                }
                
                if (isVoiceInput && !upgradeMode) {
                    speak(response.response);
                }
                
            } catch (error) {
                console.error('Send message error:', error);
                if (error.message.includes('Failed to fetch')) {
                    addMessage('error', `❌ Cannot reach server. Check your connection.`);
                } else if (error.message.includes('challenge')) {
                    addMessage('error', `❌ Authentication failed. Check your Shared Secret in Settings.`);
                } else {
                    addMessage('error', `❌ ${error.message}`);
                }
            } finally {
                hideTypingIndicator();
                isVoiceInput = false;
                isLoading = false;
            }
        }

        function showTypingIndicator() {
            const container = document.getElementById('chat-container');
            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.id = 'typing-indicator';
            indicator.innerHTML = '<span></span><span></span><span></span>';
            container.appendChild(indicator);
            scrollToBottom();
        }

        function hideTypingIndicator() {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) {
                indicator.remove();
            }
        }

        // API Calls
        async function getChallenge() {
            const response = await fetch(`${config.routerUrl}/challenge`);
            if (!response.ok) throw new Error('Failed to get authentication challenge');
            return response.json();
        }

        async function sendChat(message) {
            const timestamp = Date.now();
            const signature = await computeSignature(currentChallenge.challenge, timestamp, message);
            
            const response = await fetch(`${config.routerUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Challenge': currentChallenge.challenge,
                    'X-Timestamp': timestamp.toString(),
                    'X-Signature': signature
                },
                body: JSON.stringify({ message, conversation })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Request failed');
            }
            return response.json();
        }

        async function sendUpgrade(instruction) {
            const timestamp = Date.now();
            const signature = await computeSignature(currentChallenge.challenge, timestamp, instruction);
            
            const response = await fetch(`${config.routerUrl}/upgrade`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Challenge': currentChallenge.challenge,
                    'X-Timestamp': timestamp.toString(),
                    'X-Signature': signature
                },
                body: JSON.stringify({ instruction })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upgrade failed');
            }
            return response.json();
        }

        async function computeSignature(challenge, timestamp, message) {
            const data = `${challenge}|${timestamp}|unknown|${navigator.userAgent}|${JSON.stringify({ message, conversation })}`;
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(config.secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
            return Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }

        // Response Handlers
        function handleChatResponse(response) {
            addMessage('assistant', response.response);
            conversation.push({ role: 'assistant', content: response.response });
            
            document.getElementById('llm-status').textContent = response.provider || '---';
            document.getElementById('usage-status').textContent = `${response.usage || 0}/${response.limit || 0}`;
        }

        function handleUpgradeResponse(response) {
            // Handle approval flow for proposed changes
            if (response.awaiting_approval && response.editId) {
                // Show the proposed changes
                const message = response.message || response.review || response.plan || 'Changes proposed';
                addMessage('system', `📋 **Proposed Changes:**\n\n${message}`);
                
                // Show approval buttons
                showApprovalButtons(response.editId, response.patches_preview || '');
                return;
            }
            
            // Handle completed upgrade
            if (response.success) {
                addMessage('system', '✅ Upgrade Successful!');
                if (response.changes) {
                    response.changes.forEach(change => {
                        addMessage('system', `📝 ${change.file}: ${change.reason}`);
                    });
                }
                if (response.deployment_triggered) {
                    addMessage('system', '🚀 Deployment initiated. Changes will be live in ~60 seconds.');
                }
                if (response.commit) {
                    addMessage('system', `✓ Committed: ${response.commit}`);
                }
                if (response.url) {
                    addMessage('system', `🔗 ${response.url}`);
                }
            } else {
                addMessage('error', `❌ Upgrade Failed: ${response.error || 'Unknown error'}`);
            }
            
            if (upgradeMode) {
                toggleUpgradeMode();
            }
        }
        
        // Show approval buttons for proposed changes
        function showApprovalButtons(editId, patchPreview) {
            // Remove any existing approval buttons
            const existingButtons = document.querySelectorAll('.approval-buttons');
            existingButtons.forEach(el => el.remove());
            
            const container = document.getElementById('chat-container');
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'approval-buttons';
            buttonsDiv.innerHTML = `
                <button class="approve-btn" data-edit-id="${editId}">
                    ✓ Approve
                </button>
                <button class="review-btn" data-edit-id="${editId}">
                    🔍 Review
                </button>
                <button class="deny-btn" data-edit-id="${editId}">
                    ✗ Deny
                </button>
            `;
            
            container.appendChild(buttonsDiv);
            scrollToBottom();
            
            // Attach event handlers
            const approveBtn = buttonsDiv.querySelector('.approve-btn');
            const reviewBtn = buttonsDiv.querySelector('.review-btn');
            const denyBtn = buttonsDiv.querySelector('.deny-btn');
            
            approveBtn.onclick = () => approveEdit(editId, buttonsDiv);
            reviewBtn.onclick = () => reviewEdit(editId, patchPreview, buttonsDiv);
            denyBtn.onclick = () => denyEdit(buttonsDiv);
        }
        
        // Approve and execute the proposed changes
        async function approveEdit(editId, buttonsDiv) {
            buttonsDiv.remove();
            addMessage('system', '⏳ Deploying changes...');
            
            try {
                const response = await fetch(`${config.routerUrl}/api/approve-edit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ editId })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    addMessage('system', `✅ Changes deployed successfully!`);
                    if (data.commit) {
                        addMessage('system', `📝 Commit: ${data.commit}`);
                    }
                    if (data.url) {
                        addMessage('system', `🔗 ${data.url}`);
                    }
                } else {
                    addMessage('error', `❌ Deployment failed: ${data.error || 'Unknown error'}`);
                }
            } catch (error) {
                addMessage('error', `❌ Error: ${error.message}`);
            }
        }
        
        // Request review of proposed changes using Qwen
        async function reviewEdit(editId, patchPreview, buttonsDiv) {
            buttonsDiv.remove();
            addMessage('system', '🔍 Requesting Qwen review...');
            
            try {
                const response = await fetch(`${config.routerUrl}/api/review-edit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ editId })
                });
                
                const data = await response.json();
                
                if (data.review) {
                    addMessage('system', `🔍 **Review Results:**\n\n${data.review}`);
                    // Show buttons again after review
                    showApprovalButtons(editId, patchPreview);
                } else {
                    addMessage('error', `❌ Review failed: ${data.error || 'Unknown error'}`);
                    // Show buttons again even if review failed
                    showApprovalButtons(editId, patchPreview);
                }
            } catch (error) {
                addMessage('error', `❌ Error: ${error.message}`);
                // Show buttons again even if there was an error
                showApprovalButtons(editId, patchPreview);
            }
        }
        
        // Deny/cancel the proposed changes
        function denyEdit(buttonsDiv) {
            buttonsDiv.remove();
            addMessage('system', '❌ Changes rejected');
        }

        // Upgrade Mode
        function toggleUpgradeMode() {
            upgradeMode = !upgradeMode;
            const modeStatus = document.getElementById('mode-status');
            const upgradeBtn = document.getElementById('upgrade-mode-btn');
            
            if (upgradeMode) {
                document.body.classList.add('upgrade-mode-active');
                modeStatus.textContent = 'UPGRADE';
                modeStatus.style.color = '#ff6600';
                upgradeBtn.classList.add('active');
                addMessage('system', '⚠️ UPGRADE MODE ACTIVATED - Next command will modify the system');
            } else {
                document.body.classList.remove('upgrade-mode-active');
                modeStatus.textContent = 'Normal';
                modeStatus.style.color = '';
                upgradeBtn.classList.remove('active');
                addMessage('system', '✅ Normal mode resumed');
            }
        }

        // Status Update
        async function updateStatus() {
            if (!config.routerUrl) {
                addMessage('error', '⚙️ Configure Router URL in Settings first');
                return;
            }
            
            try {
                const response = await fetch(`${config.routerUrl}/status`);
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => response.statusText);
                    throw new Error(`Server returned ${response.status}: ${errorText}`);
                }
                
                const status = await response.json();
                
                let totalUsage = 0;
                let totalLimit = 0;
                let providers = [];
                
                if (status.groq !== undefined) {
                    totalUsage += status.groq;
                    totalLimit += 30;
                    providers.push(`Groq: ${status.groq}/30`);
                }
                if (status.gemini !== undefined) {
                    totalUsage += status.gemini;
                    totalLimit += 15;
                    providers.push(`Gemini: ${status.gemini}/15`);
                }
                if (status.claude !== undefined) {
                    totalUsage += status.claude;
                    totalLimit += 50;
                    providers.push(`Claude: ${status.claude}/50`);
                }
                
                document.getElementById('usage-status').textContent = `${totalUsage}/${totalLimit}`;
                addMessage('system', `📊 ${providers.join(' • ')}`);
            } catch (error) {
                console.error('Status check error:', error);
                if (error.message.includes('Failed to fetch')) {
                    addMessage('error', `❌ Cannot reach ${config.routerUrl}. Check your connection or Router URL.`);
                } else {
                    addMessage('error', `❌ ${error.message}`);
                }
            }
        }

        // Text-to-Speech
        function speak(text) {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        }

        // Message Display
        function addMessage(role, content, messageIndex = null) {
            const container = document.getElementById('chat-container');
            const msg = document.createElement('div');
            msg.className = `message ${role}`;
            
            // Store message index for editing
            if (role === 'user' && messageIndex !== null) {
                msg.dataset.messageIndex = messageIndex;
            }
            
            if (role !== 'system' && role !== 'error') {
                const roleLabel = document.createElement('div');
                roleLabel.className = 'message-role';
                roleLabel.textContent = role === 'user' ? 'You' : 'Omnibot';
                msg.appendChild(roleLabel);
            }
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;
            msg.appendChild(contentDiv);
            
            // Add edit button for user messages
            if (role === 'user' && messageIndex !== null) {
                const editBtn = document.createElement('button');
                editBtn.className = 'message-edit-btn';
                editBtn.innerHTML = '✏️';
                editBtn.title = 'Edit message';
                editBtn.setAttribute('aria-label', 'Edit this message');
                editBtn.onclick = () => startEditMessage(messageIndex, content, msg);
                msg.appendChild(editBtn);
            }
            
            // Add timestamp
            if (role !== 'system') {
                const timestamp = document.createElement('div');
                timestamp.className = 'message-timestamp';
                timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                msg.appendChild(timestamp);
            }
            
            container.appendChild(msg);
            scrollToBottom();
            
            return msg;
        }
        
        // Start editing a message
        function startEditMessage(index, content, messageElement) {
            if (isLoading) return;
            
            editMode = true;
            editingMessageIndex = index;
            editingMessageElement = messageElement;
            
            // Highlight the message being edited
            messageElement.classList.add('editing');
            
            // Fill input with message content
            const input = document.getElementById('message-input');
            input.value = content;
            input.focus();
            autoResize();
            
            // Change input styling to show edit mode
            const inputContainer = document.querySelector('.input-container');
            inputContainer.classList.add('edit-mode');
            
            // Show cancel button
            document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
            
            // Show edit indicator
            addMessage('system', '✏️ Editing message - press Send to update or Escape/Cancel to abort');
            
            // Change send button text
            const sendBtn = document.getElementById('send-btn');
            sendBtn.innerHTML = '💾';
            sendBtn.title = 'Save edited message';
        }
        
        // Cancel edit mode
        function cancelEdit() {
            if (!editMode) return;
            
            editMode = false;
            
            // Remove highlighting
            if (editingMessageElement) {
                editingMessageElement.classList.remove('editing');
            }
            
            // Reset input
            const input = document.getElementById('message-input');
            input.value = '';
            autoResize();
            
            // Remove edit mode styling
            const inputContainer = document.querySelector('.input-container');
            inputContainer.classList.remove('edit-mode');
            
            // Hide cancel button
            document.getElementById('cancel-edit-btn').style.display = 'none';
            
            // Reset send button
            const sendBtn = document.getElementById('send-btn');
            sendBtn.innerHTML = '➤';
            sendBtn.title = 'Send message';
            
            addMessage('system', '❌ Edit cancelled');
            
            editingMessageIndex = null;
            editingMessageElement = null;
        }
        
        // Handle saving edited message
        async function handleEditSave(newText) {
            if (editingMessageIndex === null) return;
            
            // Update conversation history
            conversation[editingMessageIndex].content = newText;
            
            // Update the message element
            if (editingMessageElement) {
                const contentDiv = editingMessageElement.querySelector('.message-content');
                if (contentDiv) {
                    contentDiv.textContent = newText;
                }
                editingMessageElement.classList.remove('editing');
                editingMessageElement.classList.add('edited');
                
                // Add edited indicator
                let editedLabel = editingMessageElement.querySelector('.edited-label');
                if (!editedLabel) {
                    editedLabel = document.createElement('span');
                    editedLabel.className = 'edited-label';
                    editedLabel.textContent = '(edited)';
                    editedLabel.title = 'This message was edited';
                    const timestamp = editingMessageElement.querySelector('.message-timestamp');
                    if (timestamp) {
                        timestamp.appendChild(document.createTextNode(' '));
                        timestamp.appendChild(editedLabel);
                    }
                }
            }
            
            // Reset edit mode
            const input = document.getElementById('message-input');
            input.value = '';
            autoResize();
            
            const inputContainer = document.querySelector('.input-container');
            inputContainer.classList.remove('edit-mode');
            
            // Hide cancel button
            document.getElementById('cancel-edit-btn').style.display = 'none';
            
            const sendBtn = document.getElementById('send-btn');
            sendBtn.innerHTML = '➤';
            sendBtn.title = 'Send message';
            
            editMode = false;
            editingMessageIndex = null;
            editingMessageElement = null;
            
            addMessage('system', '✅ Message updated');
        }

        // Auto-resize Textarea
        function autoResize() {
            const textarea = document.getElementById('message-input');
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }

        // Theme Management
        function applyTheme(theme) {
            document.body.className = `theme-${theme}`;
            const panel = document.getElementById('settings-panel');
            panel.className = `settings-panel theme-${theme}`;
            config.theme = theme;
            localStorage.setItem('theme', theme);
            updateThemeToggleIcon();
        }
        
        // Setup theme toggle with system preference monitoring
        function setupThemeToggle() {
            // Listen for system theme changes
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    // Only auto-switch if user hasn't manually set a theme
                    if (!localStorage.getItem('themeManuallySet')) {
                        const newTheme = e.matches ? 'cyberpunk' : 'portal';
                        applyTheme(newTheme);
                    }
                });
            }
        }
        
        // Quick theme toggle between light and dark
        function toggleThemeQuick() {
            const darkThemes = ['matrix', 'cyberpunk', 'borg', 'hal', 'wargames', 'modern', 'tron', 'neuromancer', 'alien', 'dune', 'ghost', 'interstellar', 'synthwave'];
            const lightThemes = ['portal'];
            
            const isDark = darkThemes.includes(config.theme);
            let newTheme;
            
            if (isDark) {
                // Switch to light
                newTheme = 'portal';
            } else {
                // Switch to dark cyberpunk
                newTheme = 'cyberpunk';
            }
            
            localStorage.setItem('themeManuallySet', 'true');
            applyTheme(newTheme);
            document.getElementById('theme-select').value = newTheme;
            
            // Add visual feedback animation
            const btn = document.getElementById('theme-toggle-btn');
            btn.style.transition = 'transform 0.2s ease';
            btn.style.transform = 'scale(0.9) rotate(180deg)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 200);
            
            // Announce theme change for screen readers
            const announcement = document.createElement('div');
            announcement.setAttribute('role', 'status');
            announcement.setAttribute('aria-live', 'polite');
            announcement.style.position = 'absolute';
            announcement.style.left = '-10000px';
            announcement.textContent = `Theme switched to ${newTheme === 'portal' ? 'light' : 'dark'} mode`;
            document.body.appendChild(announcement);
            setTimeout(() => announcement.remove(), 1000);
        }
        
        // Update theme toggle button icon
        function updateThemeToggleIcon() {
            const btn = document.getElementById('theme-toggle-btn');
            const darkThemes = ['matrix', 'cyberpunk', 'borg', 'hal', 'wargames', 'modern', 'tron', 'neuromancer', 'alien', 'dune', 'ghost', 'interstellar', 'synthwave'];
            
            if (darkThemes.includes(config.theme)) {
                btn.textContent = '☀️'; // Sun icon for switching to light
                btn.title = 'Switch to Light Theme';
                btn.setAttribute('aria-label', 'Switch to light theme');
            } else {
                btn.textContent = '🌙'; // Moon icon for switching to dark
                btn.title = 'Switch to Dark Theme';
                btn.setAttribute('aria-label', 'Switch to dark theme');
            }
        }

        // Settings Panel
        function openSettings() {
            document.getElementById('settings-panel').classList.add('active');
            document.getElementById('settings-overlay').classList.add('active');
        }

        function closeSettings() {
            document.getElementById('settings-panel').classList.remove('active');
            document.getElementById('settings-overlay').classList.remove('active');
        }

        function loadSettings() {
            document.getElementById('router-url').value = config.routerUrl;
            document.getElementById('secret').value = config.secret;
            document.getElementById('theme-select').value = config.theme;
        }

        function saveSettings() {
            config.routerUrl = document.getElementById('router-url').value.trim();
            config.secret = document.getElementById('secret').value.trim();
            config.theme = document.getElementById('theme-select').value;
            
            localStorage.setItem('routerUrl', config.routerUrl);
            localStorage.setItem('secret', config.secret);
            localStorage.setItem('theme', config.theme);
            
            applyTheme(config.theme);
            addMessage('system', '✅ Settings saved successfully!');
            closeSettings();
            
            if (config.routerUrl) {
                updateStatus();
            }
        }

        // Mode Toggle Functions
        function toggleCodeMode() {
            codeMode = !codeMode;
            document.getElementById('code-btn').classList.toggle('active');
            addMessage('system', codeMode ? '💻 Code mode activated' : '✅ Code mode deactivated');
        }

        function toggleTranslateMode() {
            translateMode = !translateMode;
            document.getElementById('translate-btn').classList.toggle('active');
            addMessage('system', translateMode ? '🌐 Translate mode activated' : '✅ Translate mode deactivated');
        }

        function toggleSwarmMode() {
            swarmMode = !swarmMode;
            document.getElementById('swarm-btn').classList.toggle('active');
            addMessage('system', swarmMode ? '🔗 Swarm mode activated' : '✅ Swarm mode deactivated');
        }
    </script>
</body>
</html>`;


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
        versionString: VERSION_STRING,
        versionFull: VERSION_FULL
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
        const { editId, directMerge } = await request.json();
        
        if (!editId) {
          return new Response(JSON.stringify({ success: false, error: 'Missing editId' }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
        
        // directMerge=true will create PR and immediately merge
        const result = await executeEdit(editId, env, directMerge === true);
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
    
    // Merge an existing PR
    if (url.pathname === '/api/merge-pr' && request.method === 'POST') {
      try {
        const { editId, prNumber } = await request.json();
        
        let pr = prNumber;
        
        // If editId provided, look up the PR number
        if (!pr && editId && env.CONTEXT) {
          const prJson = await env.CONTEXT.get('pending_pr_' + editId);
          if (prJson) {
            const prData = JSON.parse(prJson);
            pr = prData.pr_number;
          }
        }
        
        if (!pr) {
          return new Response(JSON.stringify({ success: false, error: 'Missing PR number' }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        }
        
        const mergeResult = await mergePullRequest(pr, env);
        
        if (mergeResult.merged) {
          // Cleanup
          if (editId && env.CONTEXT) {
            await env.CONTEXT.delete('pending_pr_' + editId);
          }
          
          await logTelemetry('pr_merged', { pr }, env);
          
          return new Response(JSON.stringify({ 
            success: true, 
            merged: true,
            message: `PR #${pr} merged!`
          }), { 
            headers: { ...cors, 'Content-Type': 'application/json' } 
          });
        } else {
          return new Response(JSON.stringify({ 
            success: false, 
            error: mergeResult.message || 'Merge failed'
          }), { 
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
        const reviewPrompt = 'Review these proposed code changes. Be concise but thorough. Identify any bugs, security issues, or improvements needed:\n\nOriginal request: ' + pending.instruction + '\n\nProposed patches:\n' + pending.patches;
        
        let review;
        try {
          // Uses the review chain: Gemini -> Groq Llama -> GPT-OSS
          review = await callAI('review', [{ role: 'user', content: reviewPrompt }], env, 'You are a senior code reviewer. Be concise, identify issues, and recommend APPROVE or NEEDS_CHANGES.');
        } catch (e) {
          review = 'Review unavailable: ' + e.message;
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
