/**
 * OmniBot Self-Editing Multi-AI Orchestrator
 * 
 * Features:
 * - Full instruction preservation in self-edit mode
 * - Detailed feedback on changes made
 * - Claude (this session) can access shared context
 * - All AIs share memory via KV
 */

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
    body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(content))), branch: GITHUB_BRANCH, sha })
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
    this.data = { 
      task: '', 
      architecture: '', 
      decisions: [], 
      implementations: {}, 
      combined: '', 
      reviewed: '', 
      final: '', 
      feedback: [], 
      history: [], 
      selfEdits: [],
      pendingInstructions: [] // Store full instructions
    };
  }
  
  async load() { 
    const s = await this.kv.get(`session:${this.sessionId}`, 'json'); 
    if (s) this.data = { ...this.data, ...s }; 
    return this.data; 
  }
  
  async save() { 
    await this.kv.put(`session:${this.sessionId}`, JSON.stringify(this.data), { expirationTtl: 86400 * 7 }); // 7 days
  }
  
  async update(k, v) { this.data[k] = v; await this.save(); }
  
  async addFeedback(from, msg) { 
    this.data.feedback.push({ from, message: msg, ts: Date.now() }); 
    if (this.data.feedback.length > 50) this.data.feedback = this.data.feedback.slice(-50);
    await this.save(); 
  }
  
  async addHistory(role, content, provider = null) {
    this.data.history.push({ role, content: content.slice(0, 2000), provider, ts: Date.now() });
    if (this.data.history.length > 100) this.data.history = this.data.history.slice(-100);
    await this.save();
  }
  
  async logSelfEdit(file, instruction, summary) { 
    this.data.selfEdits.push({ file, instruction: instruction.slice(0, 500), summary, ts: Date.now() }); 
    await this.save(); 
  }
  
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
    const edits = this.data.selfEdits.slice(-5).map(e => `- ${e.file}: ${e.summary || e.instruction.slice(0, 50)}`).join('\n');
    const feedback = this.data.feedback.slice(-5).map(f => `[${f.from}]: ${f.message}`).join('\n');
    return `## SHARED PROJECT CONTEXT

### Current Task
${this.data.task || 'No task set'}

### Architecture
${this.data.architecture || 'Not yet designed'}

### Recent Self-Edits
${edits || 'None'}

### Recent Feedback
${feedback || 'None'}

### Session ID
${this.sessionId}

Use this context to understand the project state.`;
  }
}

async function callProvider(provider, messages, env, systemPrompt = null) {
  const config = PROVIDERS[provider];
  const fullMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  
  try {
    if (config.format === 'gemini') {
      const res = await fetch(`${config.url}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: fullMessages.map(m => ({ 
            role: m.role === 'assistant' ? 'model' : 'user', 
            parts: [{ text: m.content }] 
          })) 
        })
      });
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data.error) || 'Gemini error';
    }
    
    if (config.format === 'openai') {
      const key = provider.startsWith('groq') ? env.GROQ_API_KEY : env.OPENAI_API_KEY;
      const res = await fetch(config.url, {
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages: fullMessages, max_tokens: 8192 })
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || JSON.stringify(data.error) || 'API error';
    }
    
    if (config.format === 'anthropic') {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: { 
          'x-api-key': env.ANTHROPIC_API_KEY, 
          'Content-Type': 'application/json', 
          'anthropic-version': '2023-06-01' 
        },
        body: JSON.stringify({ 
          model: config.model, 
          max_tokens: 8192, 
          system: systemPrompt || 'You are helpful.', 
          messages 
        })
      });
      const data = await res.json();
      return data.content?.[0]?.text || JSON.stringify(data.error) || 'Claude error';
    }
  } catch (e) { 
    return `Error calling ${provider}: ${e.message}`; 
  }
}

async function selfEdit(instruction, env, ctx) {
  // Store the full instruction
  await ctx.addHistory('user', `[SELF-EDIT REQUEST] ${instruction}`);
  
  // Get current code
  const currentCode = await githubGet('cloudflare-worker/src/index.js', env);
  if (!currentCode.content) {
    return { success: false, error: 'Could not read current code', details: currentCode };
  }
  const code = decodeURIComponent(escape(atob(currentCode.content)));
  
  // First, ask AI to analyze what changes are needed
  const analysisPrompt = `You are OmniBot's self-improvement analyzer.

FULL USER INSTRUCTION:
"""
${instruction}
"""

CURRENT SOURCE CODE LENGTH: ${code.length} characters

Analyze this instruction and explain:
1. What specific changes are needed
2. Which functions/sections need modification
3. Any potential risks or considerations
4. A brief summary of the improvement

Be concise but thorough.`;

  const analysis = await callProvider('groq_llama', 
    [{ role: 'user', content: analysisPrompt }], 
    env,
    'You are a code analyst. Analyze the requested changes.'
  );
  
  // Now generate the actual code
  const editPrompt = `You are OmniBot's self-improvement system.

FULL USER INSTRUCTION:
"""
${instruction}
"""

ANALYSIS OF REQUIRED CHANGES:
${analysis}

CURRENT SOURCE CODE:
\`\`\`javascript
${code}
\`\`\`

Generate the COMPLETE updated source code implementing the requested changes.

IMPORTANT:
- Output ONLY valid JavaScript code
- NO markdown code blocks
- NO explanations before or after
- Preserve ALL existing functionality
- The code must be complete and runnable
- Start directly with the code (const, function, etc.)`;

  const newCode = await callProvider('groq_llama', 
    [{ role: 'user', content: editPrompt }], 
    env,
    'You are a code editor. Output ONLY valid JavaScript code. No markdown, no explanations, no backticks.'
  );
  
  // Clean up response
  let cleanCode = newCode.trim();
  
  // Remove markdown if present
  if (cleanCode.startsWith('```')) {
    cleanCode = cleanCode.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '');
  }
  
  // Validate
  if (!cleanCode.includes('export default') && !cleanCode.includes('addEventListener')) {
    // Try to extract code from response
    const codeMatch = cleanCode.match(/(?:const|let|var|function|class|export|import|async)\s+[\s\S]+/);
    if (codeMatch) {
      cleanCode = codeMatch[0];
    }
  }
  
  if (cleanCode.length < 1000) {
    await ctx.addFeedback('SelfEdit', `Failed: Generated code too short (${cleanCode.length} chars)`);
    return { 
      success: false, 
      error: 'Generated code appears invalid or incomplete',
      analysis: analysis,
      preview: cleanCode.slice(0, 1000),
      originalLength: code.length,
      newLength: cleanCode.length
    };
  }
  
  // Generate a summary of changes
  const summaryPrompt = `Compare these two code versions and summarize what changed in 2-3 sentences:

BEFORE: ${code.length} chars
AFTER: ${cleanCode.length} chars

Key changes based on instruction: "${instruction.slice(0, 200)}"`;

  const summary = await callProvider('groq_qwen',
    [{ role: 'user', content: summaryPrompt }],
    env,
    'Summarize code changes briefly.'
  );
  
  // Commit to GitHub
  const commitMessage = `[OmniBot] ${instruction.slice(0, 72)}`;
  const result = await githubPut('cloudflare-worker/src/index.js', cleanCode, commitMessage, env);
  
  if (result.commit) {
    await ctx.logSelfEdit('index.js', instruction, summary);
    await ctx.addFeedback('SelfEdit', `Success: ${summary.slice(0, 100)}`);
    await ctx.addHistory('assistant', `[SELF-EDIT COMPLETE] ${summary}`);
    
    return { 
      success: true, 
      commit: result.commit.sha,
      commitUrl: `https://github.com/${GITHUB_REPO}/commit/${result.commit.sha}`,
      actionsUrl: `https://github.com/${GITHUB_REPO}/actions`,
      analysis: analysis,
      summary: summary,
      message: `✅ Code updated successfully!

**Commit:** ${result.commit.sha.slice(0, 7)}

**Analysis:**
${analysis}

**Changes Made:**
${summary}

**Next Steps:**
- Auto-deploying via GitHub Actions
- View deployment: ${`https://github.com/${GITHUB_REPO}/actions`}
- View commit: ${`https://github.com/${GITHUB_REPO}/commit/${result.commit.sha}`}`
    };
  } else {
    await ctx.addFeedback('SelfEdit', `GitHub error: ${result.message}`);
    return { 
      success: false, 
      error: result.message || 'GitHub API error', 
      analysis: analysis,
      details: result 
    };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 
      'Access-Control-Allow-Headers': 'Content-Type' 
    };
    
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    
    const sessionId = url.searchParams.get('session') || crypto.randomUUID();
    const ctx = new SharedContext(env.CONTEXT, sessionId);
    await ctx.load();
    
    // Serve UI
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    // Get full context (for Claude/external access)
    if (url.pathname === '/api/context') {
      const full = url.searchParams.get('full') === 'true';
      const data = full ? ctx.getFullContext() : { session: sessionId, context: ctx.data };
      return new Response(JSON.stringify(data, null, 2), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    // Update context
    if (url.pathname === '/api/context' && request.method === 'POST') {
      try {
        const updates = await request.json();
        for (const [key, value] of Object.entries(updates)) {
          if (key !== 'sessionId') await ctx.update(key, value);
        }
        return new Response(JSON.stringify({ success: true, session: sessionId }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Chat endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages, provider = 'groq_llama' } = await request.json();
        
        // Store in history
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) await ctx.addHistory(lastMsg.role, lastMsg.content, provider);
        
        const response = await callProvider(provider, messages, env, ctx.getContextPrompt());
        await ctx.addHistory('assistant', response, provider);
        
        return new Response(JSON.stringify({ content: response, session: sessionId }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Self-edit endpoint with full instruction preservation
    if (url.pathname === '/api/self-edit' && request.method === 'POST') {
      try {
        const body = await request.json();
        const instruction = body.instruction || body.message || '';
        
        if (!instruction || instruction.length < 10) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Instruction too short or missing',
            received: instruction,
            receivedLength: instruction?.length || 0
          }), {
            status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        
        const result = await selfEdit(instruction, env, ctx);
        return new Response(JSON.stringify(result), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Read file
    if (url.pathname === '/api/read' && request.method === 'POST') {
      try {
        const { path } = await request.json();
        const file = await githubGet(path, env);
        if (file.content) {
          return new Response(JSON.stringify({ 
            success: true, 
            path,
            content: decodeURIComponent(escape(atob(file.content))),
            size: file.size
          }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ success: false, error: file.message }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Write file
    if (url.pathname === '/api/write' && request.method === 'POST') {
      try {
        const { path, content, message } = await request.json();
        const result = await githubPut(path, content, message || 'OmniBot update', env);
        if (result.commit) {
          await ctx.logSelfEdit(path, message || 'File update', 'Direct file write');
          return new Response(JSON.stringify({ success: true, commit: result.commit.sha, path }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ success: false, error: result.message }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // List files
    if (url.pathname === '/api/files') {
      try {
        const path = url.searchParams.get('path') || 'cloudflare-worker/src';
        const files = await githubListFiles(path, env);
        return new Response(JSON.stringify(files), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Health endpoint
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now(), version: 1.0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    // API info
    return new Response(`OmniBot Self-Editing Orchestrator

Session: ${sessionId}

Endpoints:
- GET  /api/context?session=X&full=true - Get shared context
- POST /api/context - Update context
- POST /api/chat - Chat with AI {messages, provider?}
- POST /api/self-edit - Self-edit {instruction}
- POST /api/read - Read file {path}
- POST /api/write - Write file {path, content, message}
- GET  /api/files?path=X - List files
- GET  /api/health - Health check

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
.session{font-size:9px;color:#6e7681;font-family:monospace;margin-left:8px}
.mode-toggle{display:flex;gap:3px;margin-left:auto}
.mode-btn{padding:4px 8px;border-radius:5px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:10px;cursor:pointer}
.mode-btn.active{background:#238636;border-color:#238636;color:#fff}
.status{font-size:9px;padding:3px 6px;border-radius:8px;background:#238636;color:#fff;margin-left:8px}
.status.loading{background:#9e6a03}
.status.error{background:#da3633}
.messages{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.msg{max-width:92%;padding:10px 14px;border-radius:14px;line-height:1.5;white-space:pre-wrap;font-size:13px;word-break:break-word}
.msg-user{align-self:flex-end;background:#238636;border-radius:14px 14px 4px 14px}
.msg-bot{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:14px 14px 14px 4px}
.msg a{color:#58a6ff}
.input-area{padding:10px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:8px}
.input-area textarea{flex:1;padding:10px 14px;border-radius:10px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px;outline:none;resize:none;min-height:44px;max-height:150px;font-family:inherit}
.input-area button{padding:10px 18px;border-radius:10px;border:none;background:#238636;color:#fff;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap}
.input-area button:disabled{background:#21262d;color:#484f58}
.edit-warning{background:#9e6a03;color:#fff;padding:8px 14px;font-size:11px;text-align:center;display:none}
.edit-warning.show{display:block}
</style>
</head>
<body>
<div class="header">
<span style="font-size:18px">🤖</span>
<h1>OmniBot</h1>
<span class="session" id="sessionId"></span>
<div class="mode-toggle">
<button class="mode-btn active" data-mode="chat">Chat</button>
<button class="mode-btn" data-mode="edit">Self-Edit</button>
</div>
<span class="status" id="status">Ready</span>
</div>
<div class="edit-warning" id="editWarning">⚠️ SELF-EDIT MODE: OmniBot will modify its own source code based on your instructions</div>
<div class="messages" id="messages"></div>
<div class="input-area">
<textarea id="input" placeholder="Message OmniBot..." rows="2"></textarea>
<button id="send">Send</button>
</div>
<script>
(function(){
var mode='chat',messages=[],loading=false;
var session=localStorage.getItem('omnibot_session')||'';
var messagesEl=document.getElementById('messages');
var inputEl=document.getElementById('input');
var sendBtn=document.getElementById('send');
var statusEl=document.getElementById('status');
var sessionEl=document.getElementById('sessionId');
var editWarning=document.getElementById('editWarning');

function updateSession(s){
  session=s;
  localStorage.setItem('omnibot_session',s);
  sessionEl.textContent=s.slice(0,8);
}

document.querySelectorAll('.mode-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    mode=btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(function(b){b.classList.remove('active');});
    btn.classList.add('active');
    editWarning.classList.toggle('show',mode==='edit');
    inputEl.placeholder=mode==='edit'?'Describe in detail how OmniBot should improve itself...':'Message OmniBot...';
  });
});

function render(){
  if(!messages.length){
    messagesEl.innerHTML='<div style="margin:auto;text-align:center;color:#484f58;padding:20px"><div style="font-size:44px;margin-bottom:10px">🤖</div><div style="font-size:16px">OmniBot</div><div style="font-size:11px;margin-top:6px">Self-editing AI • Chat or Self-Edit mode</div></div>';
    return;
  }
  messagesEl.innerHTML=messages.map(function(m){
    var cls=m.role==='user'?'msg-user':'msg-bot';
    var txt=m.content
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
      .replace(/\\n/g,'<br>')
      .replace(/(https:\\/\\/[^\\s<]+)/g,'<a href="$1" target="_blank">$1</a>');
    return '<div class="msg '+cls+'">'+txt+'</div>';
  }).join('')+(loading?'<div class="msg msg-bot" style="color:#8b949e">🤖 '+(mode==='edit'?'Analyzing and editing...':'Thinking...')+'</div>':'');
  messagesEl.scrollTop=messagesEl.scrollHeight;
}

function setStatus(t,c){
  statusEl.textContent=t;
  statusEl.className='status'+(c?' '+c:'');
}

async function send(){
  var text=inputEl.value.trim();
  if(!text||loading)return;
  
  messages.push({role:'user',content:text});
  inputEl.value='';
  inputEl.style.height='44px';
  loading=true;
  sendBtn.disabled=true;
  setStatus(mode==='edit'?'Editing...':'Thinking...','loading');
  render();
  
  try{
    var endpoint=mode==='edit'?'/api/self-edit':'/api/chat';
    var body=mode==='edit'?{instruction:text}:{messages:messages.map(function(m){return{role:m.role,content:m.content};})};
    
    if(session)endpoint+='?session='+encodeURIComponent(session);
    
    var res=await fetch(endpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    
    var data=await res.json();
    
    if(data.session)updateSession(data.session);
    
    if(mode==='edit'){
      if(data.success){
        messages.push({role:'assistant',content:data.message||('✅ Edit complete! Commit: '+data.commit)});
      }else{
        var errMsg='❌ Edit failed: '+(data.error||'Unknown error');
        if(data.analysis)errMsg+='\\n\\n**Analysis:**\\n'+data.analysis;
        if(data.preview)errMsg+='\\n\\n**Preview:**\\n'+data.preview.slice(0,500);
        messages.push({role:'assistant',content:errMsg});
      }
    }else{
      messages.push({role:'assistant',content:data.content||data.error||'No response'});
    }
    setStatus('Ready','');
  }catch(e){
    messages.push({role:'assistant',content:'❌ Error: '+e.message});
    setStatus('Error','error');
  }
  
  loading=false;
  sendBtn.disabled=false;
  render();
}

sendBtn.onclick=send;
inputEl.onkeydown=function(e){
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    send();
  }
};
inputEl.oninput=function(){
  this.style.height='44px';
  this.style.height=Math.min(this.scrollHeight,150)+'px';
};

// Load session
fetch('/api/context'+(session?'?session='+session:''))
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.session)updateSession(d.session);
  });

render();
})();
</script>
</body>
</html>`;
