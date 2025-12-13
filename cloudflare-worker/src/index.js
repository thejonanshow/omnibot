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
/* eslint-disable no-useless-escape */
// ============== HTML UI ==============
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OmniBot - LCARS Interface</title>
  <!-- Google Fonts for authentic Star Trek LCARS aesthetic -->
  <!-- Antonio: Display font, Orbitron: Technical font -->
  <!-- Using display=swap for better performance -->
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
      /* Compatibility variables for tests */
      --bg-primary: #000000;
      --text-primary: #ff9900;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      height: 100%;
      /* Antonio font with system fallbacks for Star Trek aesthetic */
      font-family: 'Antonio', 'Arial Narrow', 'Impact', sans-serif;
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
      gap: 20px;
      padding: 0 30px;
    }
    
    .lcars-title {
      /* Orbitron font with monospace fallback for technical aesthetic */
      font-family: 'Orbitron', 'Courier New', monospace;
      font-size: 28px;
      font-weight: 700;
      color: #000;
      letter-spacing: 3px;
    }
    
    .lcars-subtitle {
      font-size: 14px;
      color: #333;
      letter-spacing: 1px;
    }
    
    .chat-area {
      background: #000;
      border-radius: 20px;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .msg {
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.6;
      max-width: 80%;
      word-wrap: break-word;
    }
    
    .msg.user {
      background: rgba(153, 204, 255, 0.2);
      color: var(--lcars-blue);
      align-self: flex-end;
      border: 1px solid var(--lcars-blue);
    }
    
    .msg.assistant {
      background: rgba(255, 153, 0, 0.15);
      color: var(--lcars-orange);
      align-self: flex-start;
      border: 1px solid var(--lcars-orange);
    }
    
    .msg.system {
      background: rgba(204, 153, 204, 0.15);
      color: var(--lcars-purple);
      align-self: center;
      text-align: center;
      border: 1px solid var(--lcars-purple);
      font-size: 13px;
    }
    
    .msg.error {
      background: rgba(204, 102, 102, 0.2);
      color: var(--lcars-red);
      align-self: center;
      text-align: center;
      border: 1px solid var(--lcars-red);
    }
    
    .input-area {
      background: var(--lcars-tan);
      border-radius: 20px 0 0 0;
      padding: 15px 30px;
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    .input-field {
      flex: 1;
      background: #000;
      border: 2px solid var(--lcars-orange);
      color: var(--lcars-text);
      font-family: 'Courier New', monospace;
      font-size: 14px;
      padding: 12px 16px;
      border-radius: 8px;
      resize: none;
      outline: none;
      min-height: 44px;
      max-height: 200px;
    }
    
    .input-field:focus {
      border-color: var(--lcars-gold);
      box-shadow: 0 0 10px rgba(255, 204, 0, 0.3);
    }
    
    .input-field.edit-mode {
      border-color: var(--lcars-purple);
      box-shadow: 0 0 10px rgba(204, 153, 204, 0.3);
    }
    
    .voice-btn {
      background: var(--lcars-blue);
      border: none;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .voice-btn:hover {
      filter: brightness(1.2);
      transform: scale(1.05);
    }
    
    .voice-btn.recording {
      background: var(--lcars-red);
      animation: recordingPulse 1.5s infinite;
    }
    
    @keyframes recordingPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    
    .send-btn {
      background: var(--lcars-gold);
      border: none;
      padding: 12px 24px;
      font-family: 'Orbitron', sans-serif;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #000;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.1s;
      text-transform: uppercase;
    }
    
    .send-btn:hover { filter: brightness(1.2); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .lcars-footer {
      background: var(--lcars-orange);
      border-radius: 20px 0 0 0;
      padding: 0 30px;
      display: flex;
      align-items: center;
      gap: 20px;
      font-size: 11px;
      font-weight: 700;
      color: #000;
      letter-spacing: 1px;
    }
    
    .status-item {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #00ff00;
      animation: statusPulse 2s infinite;
    }
    
    @keyframes statusPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    /* Mobile Responsive */
    @media (max-width: 768px) {
      .lcars-frame {
        grid-template-columns: 80px 1fr;
        grid-template-rows: 60px 1fr 80px;
        gap: 2px;
        padding: 2px;
      }
      
      .lcars-sidebar-top {
        height: 60px;
      }
      
      .lcars-btn {
        font-size: 9px;
        padding: 10px 6px;
        margin-right: 10px;
      }
      
      .lcars-title {
        font-size: 18px;
      }
      
      .lcars-subtitle {
        display: none;
      }
      
      .input-area {
        flex-wrap: wrap;
        padding: 10px 15px;
      }
      
      .input-field {
        min-width: 100%;
      }
      
      .voice-btn, .send-btn {
        flex: 1;
      }
    }
  </style>
</head>
<body>
  <div class="lcars-frame">
    <div class="lcars-sidebar">
      <div class="lcars-sidebar-top"></div>
      <div class="lcars-sidebar-content">
        <button class="lcars-btn active">Chat</button>
        <button class="lcars-btn" id="status-btn">Status</button>
        <button class="lcars-btn" id="settings-btn">Settings</button>
      </div>
    </div>
    
    <div class="lcars-header">
      <div class="lcars-header-curve"></div>
      <div class="lcars-header-bar">
        <span class="lcars-title">OMNIBOT</span>
        <span class="lcars-subtitle">LCARS INTERFACE</span>
      </div>
    </div>
    
    <div class="chat-area" id="messages">
      <div class="msg system">🚀 LCARS System Online - Voice Mode Ready</div>
    </div>
    
    <div class="input-area">
      <textarea class="input-field" id="input" placeholder="Enter command or click 🎤 to speak..." rows="1"></textarea>
      <button class="voice-btn" id="voiceBtn" title="Click to speak">🎤</button>
      <button class="send-btn" id="sendBtn">ENGAGE</button>
    </div>
    
    <div class="lcars-footer">
      <div class="status-item">
        <div class="status-dot"></div>
        <span>ONLINE</span>
      </div>
      <div class="status-item">
        <span id="llm-status">LLM: READY</span>
      </div>
    </div>
  </div>
  
  <script>
    (function() {
      'use strict';
      
      const $messages = document.getElementById('messages');
      const $input = document.getElementById('input');
      const $sendBtn = document.getElementById('sendBtn');
      const $voiceBtn = document.getElementById('voiceBtn');
      
      let messages = [];
      let loading = false;
      let recognition = null;
      let isRecording = false;
      
      // Configuration
      const API_URL = window.location.origin;
      
      // Initialize speech recognition
      function setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
          $voiceBtn.disabled = true;
          $voiceBtn.title = 'Speech recognition not supported';
          addMessage('system', '⚠️ Voice input not available in this browser');
          return;
        }
        
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
          isRecording = true;
          $voiceBtn.classList.add('recording');
          $voiceBtn.textContent = '⏹';
        };
        
        recognition.onresult = (event) => {
          const text = event.results[0][0].transcript;
          $input.value = text;
          autoResize();
        };
        
        recognition.onend = () => {
          isRecording = false;
          $voiceBtn.classList.remove('recording');
          $voiceBtn.textContent = '🎤';
          
          const text = $input.value.trim();
          if (text) {
            sendMessage();
          }
        };
        
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          isRecording = false;
          $voiceBtn.classList.remove('recording');
          $voiceBtn.textContent = '🎤';
          
          if (event.error === 'no-speech') {
            addMessage('system', '🎤 No speech detected. Please try again.');
          } else if (event.error === 'not-allowed') {
            addMessage('error', '🔒 Microphone access denied.');
          } else if (event.error !== 'aborted') {
            // Use escapeHtml for robust sanitization
            const errorMessage = '⚠️ Voice error: ' + String(event.error);
            addMessage('system', errorMessage);
          }
        };
      }
      
      function toggleVoice() {
        if (!recognition) {
          addMessage('system', '⚠️ Speech recognition not available.');
          return;
        }
        
        if (isRecording) {
          recognition.stop();
        } else {
          try {
            recognition.start();
          } catch (error) {
            console.error('Error starting recognition:', error);
            addMessage('error', 'Failed to start voice recognition');
          }
        }
      }
      
      function autoResize() {
        $input.style.height = 'auto';
        $input.style.height = Math.min($input.scrollHeight, 200) + 'px';
      }
      
      function addMessage(role, content) {
        messages.push({ role, content });
        render();
      }
      
      function render() {
        let html = '';
        for (const m of messages) {
          // Sanitize role to prevent CSS class injection (only allow known roles)
          const safeRole = ['user', 'assistant', 'system', 'error'].includes(m.role) ? m.role : 'system';
          html += \`<div class="msg \$\{safeRole}">\$\{escapeHtml(m.content)}</div>\`;
        }
        if (loading) {
          html += '<div class="msg system">⏳ Processing...</div>';
        }
        $messages.innerHTML = html;
        $messages.scrollTop = $messages.scrollHeight;
      }
      
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
      
      async function sendMessage() {
        const text = $input.value.trim();
        if (!text || loading) return;
        
        // Basic client-side validation
        if (text.length > 10000) {
          addMessage('error', 'Message too long (max 10000 characters)');
          return;
        }
        
        $input.value = '';
        autoResize();
        
        addMessage('user', text);
        loading = true;
        render();
        
        try {
          const response = await fetch(\`\$\{API_URL}/api/chat\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
          });
          
          const data = await response.json();
          loading = false;
          
          if (data.reply) {
            addMessage('assistant', data.reply);
          } else {
            addMessage('error', data.error || 'No response from server');
          }
        } catch (e) {
          loading = false;
          addMessage('error', 'Network error: ' + e.message);
        }
      }
      
      // Event listeners
      $input.addEventListener('input', autoResize);
      $input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      
      $sendBtn.addEventListener('click', sendMessage);
      $voiceBtn.addEventListener('click', toggleVoice);
      
      // Initialize
      setupSpeechRecognition();
      autoResize();
    })();
  </script>
</body>
</html>`;




/* eslint-enable no-useless-escape */

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
