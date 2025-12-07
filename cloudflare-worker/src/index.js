const PROVIDERS = {
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', format: 'gemini' },
  groq_llama: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', format: 'openai' },
  groq_qwen: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'qwen/qwen3-32b', format: 'openai' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', format: 'openai' },
  claude: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514', format: 'anthropic' }
};

const GITHUB_REPO = 'thejonanshow/omnibot';
const GITHUB_BRANCH = 'main';

async function githubGet(path, env) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`, {
    headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OmniBot' }
  });
  return res.json();
}

async function githubPut(path, content, message, env) {
  const current = await githubGet(path, env);
  const sha = current.sha;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'OmniBot' },
    body: JSON.stringify({
      message: message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: GITHUB_BRANCH,
      sha: sha
    })
  });
  return res.json();
}

async function githubListFiles(path, env) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`, {
    headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OmniBot' }
  });
  return res.json();
}

class SharedContext {
  constructor(kv, sessionId) {
    this.kv = kv;
    this.sessionId = sessionId;
    this.data = { task: '', architecture: '', decisions: [], implementations: {}, combined: '', reviewed: '', final: '', feedback: [], history: [], selfEdits: [] };
  }
  async load() { const s = await this.kv.get(`session:${this.sessionId}`, 'json'); if (s) this.data = s; return this.data; }
  async save() { await this.kv.put(`session:${this.sessionId}`, JSON.stringify(this.data), { expirationTtl: 86400 }); }
  async update(k, v) { this.data[k] = v; await this.save(); }
  async addFeedback(from, msg) { this.data.feedback.push({ from, message: msg, ts: Date.now() }); await this.save(); }
  async logSelfEdit(file, reason) { this.data.selfEdits.push({ file, reason, ts: Date.now() }); await this.save(); }
  getFullContext() {
    return {
      task: this.data.task,
      architecture: this.data.architecture,
      decisions: this.data.decisions,
      recentFeedback: this.data.feedback.slice(-10),
      recentHistory: this.data.history.slice(-20),
      selfEdits: this.data.selfEdits.slice(-10),
      sessionId: this.sessionId
    };
  }

  getContextPrompt() {
    return `## SHARED CONTEXT\nTask: ${this.data.task || 'Not set'}\nArchitecture: ${this.data.architecture ? 'Set' : 'Pending'}\nFeedback: ${this.data.feedback.slice(-3).map(f => f.from + ': ' + f.message).join('; ')}\nSelf-edits: ${this.data.selfEdits.length} total`;
  }
}

async function callProvider(provider, messages, env, systemPrompt = null) {
  const config = PROVIDERS[provider];
  const fullMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  try {
    if (config.format === 'gemini') {
      const res = await fetch(`${config.url}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: fullMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) })
      });
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data.error) || 'Gemini error';
    }
    if (config.format === 'openai') {
      const key = provider.startsWith('groq') ? env.GROQ_API_KEY : env.OPENAI_API_KEY;
      const res = await fetch(config.url, {
        method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages: fullMessages, max_tokens: 4096 })
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || JSON.stringify(data.error) || 'API error';
    }
    if (config.format === 'anthropic') {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: config.model, max_tokens: 4096, system: systemPrompt || 'You are helpful.', messages })
      });
      const data = await res.json();
      return data.content?.[0]?.text || JSON.stringify(data.error) || 'Claude error';
    }
  } catch (e) { return `Error: ${e.message}`; }
}

async function clusterModeCall(multiAnswers, env, ctx) {
  const providers = ['openai', 'groq_llama', 'groq_qwen', 'claude'];
  const responses = [];

  for (const provider of providers) {
    const response = await callProvider(provider, multiAnswers, env);
    responses.push(response);
  }

  const finalResponse = await callProvider('groq_llama', [{ role: 'system', content: `You are OmniBot's final response orchestrator. Combine the following responses into one: ${responses.join(', ')}.` }, { role: 'user', content: '' }], env);

  return finalResponse;
}

async function selfEdit(instruction, env, ctx) {
  const currentCode = await githubGet('cloudflare-worker/src/index.js', env);
  const code = decodeURIComponent(escape(atob(currentCode.content)));
  const editPrompt = `You are OmniBot's self-improvement system. You can edit your own source code.

CURRENT SOURCE CODE:
\`\`\`javascript
${code}
\`\`\`

USER'S INSTRUCTION FOR IMPROVEMENT:
${instruction}

Generate the COMPLETE updated source code. Maintain all existing functionality while implementing the requested improvement.
Output ONLY the code, no explanations. The code must be complete and valid JavaScript.`;
  const newCode = await callProvider('groq_llama', [{ role: 'user', content: editPrompt }], env,
    'You are a code editor. Output only valid JavaScript code. No markdown, no explanations.');
  let cleanCode = newCode;
  if (cleanCode.includes('')) {
    cleanCode = cleanCode.replace(/\n?/g, '').replace(/\n?/g, '').trim();
  }
  if (!cleanCode.includes('export default') || cleanCode.length < 1000) {
    return { success: false, error: 'Generated code appears invalid', preview: cleanCode.slice(0, 500) };
  }
  const result = await githubPut(
    'cloudflare-worker/src/index.js',
    cleanCode,
    `[OmniBot Self-Edit] ${instruction.slice(0, 50)}`,
    env
  );
  if (result.commit) {
    await ctx.logSelfEdit('index.js', instruction);
    return {
      success: true,
      commit: result.commit.sha,
      message: `Code updated! Commit: ${result.commit.sha.slice(0, 7)}. Auto-deploying via GitHub Actions...`,
      deployUrl: `https://github.com/${GITHUB_REPO}/actions`
    };
  } else {
    return { success: false, error: result.message || 'GitHub API error', details: result };
  }
}

async function deployToCloudflare(env) {
  const res = await fetch('https://api.cloudflare.com/client/v4/accounts/' + env.CLOUDFLARE_ACCOUNT_ID + '/workers/scripts/' + env.CLOUDFLARE_WORKER_ID, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + env.CLOUDFLARE_TOKEN,
      'Content-Type': 'application/javascript',
    },
    body: await githubGet('cloudflare-worker/src/index.js', env).then(data => decodeURIComponent(escape(atob(data.content))))
  });
  return res.json();
}

async function readFile(path, env) {
  const file = await githubGet(path, env);
  if (file.content) {
    return { success: true, content: decodeURIComponent(escape(atob(file.content))), path };
  }
  return { success: false, error: file.message || 'File not found' };
}

async function writeFile(path, content, message, env, ctx) {
  const result = await githubPut(path, content, message, env);
  if (result.commit) {
    await ctx.logSelfEdit(path, message);
    return { success: true, commit: result.commit.sha, path };
  }
  return { success: false, error: result.message };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const sessionId = url.searchParams.get('session') || crypto.randomUUID();
    const ctx = new SharedContext(env.CONTEXT, sessionId);
    await ctx.load();

    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }

    // POST to update context
    if (url.pathname === '/api/context' && request.method === 'POST') {
      try {
        const updates = await request.json();
        for (const [key, value] of Object.entries(updates)) {
          if (key !== 'sessionId') await ctx.update(key, value);
        }
        return new Response(JSON.stringify({ success: true, session: sessionId, updated: Object.keys(updates) }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET context
    if (url.pathname === '/api/context') {
      const full = url.searchParams.get('full') === 'true';
      const data = full ? ctx.getFullContext() : { session: sessionId, context: ctx.data };
      return new Response(JSON.stringify(data, null, 2), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages, provider = 'groq_llama', cluster = false } = await request.json();
        if (cluster) {
          const response = await clusterModeCall(messages, env, ctx);
          return new Response(JSON.stringify({ content: response, session: sessionId }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        } else {
          const response = await callProvider(provider, messages, env, ctx.getContextPrompt());
          return new Response(JSON.stringify({ content: response, session: sessionId }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === '/api/self-edit' && request.method === 'POST') {
      try {
        const { instruction } = await request.json();
        const result = await selfEdit(instruction, env, ctx);
        if (result.success) {
          const deploymentResult = await deployToCloudflare(env);
          if (deploymentResult.success) {
            return new Response(JSON.stringify({ ...result, deployment: deploymentResult }), {
              headers: { ...cors, 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({ ...result, deploymentError: deploymentResult.error }), {
              headers: { ...cors, 'Content-Type': 'application/json' }
            });
          }
        } else {
          return new Response(JSON.stringify(result), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/read' && request.method === 'POST') {
      try {
        const { path } = await request.json();
        const result = await readFile(path, env);
        return new Response(JSON.stringify(result), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === '/api/write' && request.method === 'POST') {
      try {
        const { path, content, message } = await request.json();
        const result = await writeFile(path, content, message, env, ctx);
        return new Response(JSON.stringify(result), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === '/api/files' && request.method === 'GET') {
      try {
        const path = url.searchParams.get('path') || 'cloudflare-worker/src';
        const files = await githubListFiles(path, env);
        return new Response(JSON.stringify(files), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(`OmniBot Self-Editing Orchestrator

Endpoints:
- POST /api/chat - Chat with AI
- POST /api/self-edit - Let AI edit its own code
- POST /api/read - Read file from repo  
- POST /api/write - Write file to repo
- GET /api/files?path=X - List files
- GET /api/context - Get shared context

GitHub: ${GITHUB_REPO}
Auto-deploy: On push to main`, { headers: cors });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>OmniBot</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:-apple-system,system-ui,sans-serif;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column}
.header{padding:10px 14px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.header h1{font-size:15px;font-weight:600}
.mode-toggle{display:flex;gap:3px;margin-left:auto}
.mode-btn{padding:4px 8px;border-radius:5px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:10px;cursor:pointer}
.mode-btn.active{background:#6495ED;border-color:#6495ED;color:#fff}
.mode-btn.danger{background:#da3633;border-color:#da3633}
.status{font-size:9px;padding:3px 6px;border-radius:8px;background:#238636;color:#fff}
.status.loading{background:#9e6a03}
.messages{flex:1;overflow-y:auto;padding:10px&display:flex;flex-direction:column;gap:8px}
.msg{max-width:90%;padding:8px 12px;border-radius:14px;line-height:1.4;white-space:pre-wrap;font-size:12px}
.msg-user{align-self:flex-end;background:#238636;border-radius:14px 14px 4px 14px}
.msg-bot{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:14px 14px 14px 4px}
.msg pre{background:#161b22;padding:4px;border-radius:3px;overflow-x:auto;font-size:10px;margin:4px 0}
.msg code{font-family:monospace}
.input-area{padding:8px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:6px}
.input-area textarea{flex:1;padding:8px 12px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:13px;outline:none;resize:none;min-height:40px;max-height:80px;font-family:inherit}
.input-area button{padding:8px 14px;border-radius:8px;border:none;background:#6495ED;color:#fff;font-weight:600;font-size:12px;cursor:pointer}
.input-area button:disabled{background:#21262d;color:#484f58}
.edit-warning{background:#9e6a03;color:#fff;padding:6px 10px;font-size:10px;text-align:center;display:none}
.edit-warning.show{display:block}
.cluster-mode-toggle{display:flex;gap:3px;margin-left:auto}
.cluster-mode-btn{padding:4px 8px;border-radius:5px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:10px;cursor:pointer}
.cluster-mode-btn.active{background:#6495ED;border-color:#6495ED;color:#fff}
</style>
</head>
<body>
<div class="header">
<span style="font-size:18px">🤖</span>
<h1>OmniBot</h1>
<div style="position: absolute; right: 10px; top: 10px" class="mode-toggle">
<button class="mode-btn active" data-mode="chat">Chat</button>
<button class="mode-btn" data-mode="edit">Self-Edit</button>
</div>
<div class="cluster-mode-toggle">
<button class="cluster-mode-btn" id="cluster-mode">Cluster Mode</button>
</div