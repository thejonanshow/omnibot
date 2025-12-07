/**
 * OmniBot Self-Editing Orchestrator v2
 * - Fixed message truncation
 * - Better feedback on edits
 * - Claude (me) can access shared context
 * - Disabled <think> tags in Qwen responses
 */

const PROVIDERS = {
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', format: 'gemini' },
  groq_llama: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', format: 'openai' },
  groq_qwen: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'qwen/qwen3-32b', format: 'openai' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', format: 'openai' },
  claude: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514', format: 'anthropic' }
};

const GITHUB_REPO = 'thejonanshow/omnibot';

async function githubGet(path, env) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=main`, {
    headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OmniBot' }
  });
  return res.json();
}

async function githubPut(path, content, message, env) {
  const current = await githubGet(path, env);
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'OmniBot' },
    body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(content))), branch: 'main', sha: current.sha })
  });
  return res.json();
}

class SharedContext {
  constructor(kv, sessionId) {
    this.kv = kv;
    this.sessionId = sessionId;
    this.data = { task: '', history: [], selfEdits: [], feedback: [] };
  }
  async load() { const s = await this.kv.get(`session:${this.sessionId}`, 'json'); if (s) this.data = s; return this.data; }
  async save() { await this.kv.put(`session:${this.sessionId}`, JSON.stringify(this.data), { expirationTtl: 86400 }); }
  async addEdit(file, instruction, result) { 
    this.data.selfEdits.push({ file, instruction, result, ts: Date.now() }); 
    await this.save(); 
  }
  async addHistory(role, content) {
    this.data.history.push({ role, content: content.slice(0, 2000), ts: Date.now() });
    if (this.data.history.length > 50) this.data.history = this.data.history.slice(-50);
    await this.save();
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
      const body = { model: config.model, messages: fullMessages, max_tokens: 8192 };
      // Disable thinking for Qwen
      if (provider === 'groq_qwen') {
        body.extra_body = { chat_template_kwargs: { enable_thinking: false } };
      }
      const res = await fetch(config.url, {
        method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      let content = data.choices?.[0]?.message?.content || JSON.stringify(data.error) || 'Error';
      // Strip any <think> tags that slip through
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return content;
    }
    
    if (config.format === 'anthropic') {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: config.model, max_tokens: 8192, system: systemPrompt || 'You are helpful.', messages })
      });
      const data = await res.json();
      return data.content?.[0]?.text || JSON.stringify(data.error) || 'Claude error';
    }
  } catch (e) { return `Error: ${e.message}`; }
}

async function selfEdit(instruction, env, ctx) {
  // Get current code
  const currentFile = await githubGet('cloudflare-worker/src/index.js', env);
  if (!currentFile.content) {
    return { success: false, error: 'Could not read current code', details: currentFile };
  }
  const currentCode = decodeURIComponent(escape(atob(currentFile.content)));
  
  // Generate edit with Llama (more reliable than Qwen for code)
  const editPrompt = `You are a code editor. Your task is to modify source code based on instructions.

CURRENT CODE (${currentCode.length} characters):
\`\`\`javascript
${currentCode}
\`\`\`

INSTRUCTION:
${instruction}

RULES:
1. Output ONLY the complete modified JavaScript code
2. No markdown code fences, no explanations, no comments about changes
3. Preserve ALL existing functionality unless explicitly told to remove it
4. The code must be valid JavaScript that can run in Cloudflare Workers
5. Start your response with the first line of code (likely "const" or a comment)

OUTPUT THE COMPLETE MODIFIED CODE:`;

  const newCode = await callProvider('groq_llama', [{ role: 'user', content: editPrompt }], env);
  
  // Clean response
  let cleanCode = newCode.trim();
  if (cleanCode.startsWith('```')) {
    cleanCode = cleanCode.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  
  // Validate
  if (!cleanCode.includes('export default') && !cleanCode.includes('addEventListener')) {
    return { 
      success: false, 
      error: 'Generated code missing export - appears invalid',
      codeLength: cleanCode.length,
      preview: cleanCode.slice(0, 300)
    };
  }
  
  if (cleanCode.length < 500) {
    return { success: false, error: 'Generated code too short', codeLength: cleanCode.length };
  }
  
  // Commit
  const commitMsg = `[OmniBot] ${instruction.slice(0, 72)}`;
  const result = await githubPut('cloudflare-worker/src/index.js', cleanCode, commitMsg, env);
  
  if (result.commit) {
    // Generate summary of changes
    const summaryPrompt = `Compare these two code versions and summarize what changed in 2-3 sentences:

BEFORE (${currentCode.length} chars):
${currentCode.slice(0, 1500)}...

AFTER (${cleanCode.length} chars):  
${cleanCode.slice(0, 1500)}...

INSTRUCTION WAS: ${instruction}

Summarize the actual code changes made:`;

    const summary = await callProvider('groq_llama', [{ role: 'user', content: summaryPrompt }], env,
      'You summarize code changes concisely. No preamble, just the summary.');
    
    await ctx.addEdit('index.js', instruction, summary);
    
    return {
      success: true,
      commit: result.commit.sha,
      commitUrl: result.commit.html_url,
      message: commitMsg,
      summary: summary,
      beforeSize: currentCode.length,
      afterSize: cleanCode.length,
      deploying: 'GitHub Actions will auto-deploy in ~30 seconds'
    };
  }
  
  return { success: false, error: result.message || 'GitHub commit failed', details: result };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    
    const sessionId = url.searchParams.get('session') || crypto.randomUUID();
    const ctx = new SharedContext(env.CONTEXT, sessionId);
    await ctx.load();
    
    // Serve UI
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    // Health check
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now(), version: '2.0' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    // Get shared context (for external access like Claude)
    if (url.pathname === '/api/context') {
      return new Response(JSON.stringify({ session: sessionId, context: ctx.data }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    // List all sessions (for debugging)
    if (url.pathname === '/api/sessions') {
      const list = await env.CONTEXT.list({ prefix: 'session:' });
      return new Response(JSON.stringify(list.keys), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    // Chat endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages, provider = 'groq_llama' } = await request.json();
        const lastMsg = messages[messages.length - 1]?.content || '';
        await ctx.addHistory('user', lastMsg);
        
        const response = await callProvider(provider, messages, env, 
          'You are OmniBot, a helpful AI assistant. Be concise and direct.');
        
        await ctx.addHistory('assistant', response);
        return new Response(JSON.stringify({ content: response, session: sessionId }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }
    
    // Self-edit endpoint - FIXED: now captures full instruction
    if (url.pathname === '/api/self-edit' && request.method === 'POST') {
      try {
        const body = await request.json();
        const instruction = body.instruction || '';
        
        if (!instruction || instruction.length < 5) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Instruction too short or missing',
            received: instruction,
            bodyKeys: Object.keys(body)
          }), { headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        
        await ctx.addHistory('user', `[SELF-EDIT] ${instruction}`);
        const result = await selfEdit(instruction, env, ctx);
        await ctx.addHistory('assistant', `[EDIT RESULT] ${result.success ? result.summary : result.error}`);
        
        return new Response(JSON.stringify(result), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Read file from repo
    if (url.pathname === '/api/read' && request.method === 'POST') {
      try {
        const { path } = await request.json();
        const file = await githubGet(path, env);
        if (file.content) {
          return new Response(JSON.stringify({ 
            success: true, 
            content: decodeURIComponent(escape(atob(file.content))),
            path,
            size: file.size
          }), { headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: false, error: file.message }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }
    
    // Write file to repo
    if (url.pathname === '/api/write' && request.method === 'POST') {
      try {
        const { path, content, message } = await request.json();
        const result = await githubPut(path, content, message || '[OmniBot] File update', env);
        if (result.commit) {
          await ctx.addEdit(path, message, 'Direct file write');
          return new Response(JSON.stringify({ success: true, commit: result.commit.sha, path }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ success: false, error: result.message }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }
    
    return new Response(`OmniBot API v2

Endpoints:
POST /api/chat - Chat with AI
POST /api/self-edit - Edit own code {instruction: "..."}
POST /api/read - Read file {path: "..."}
POST /api/write - Write file {path, content, message}
GET /api/context - Get shared context
GET /api/sessions - List all sessions
GET /api/health - Health check

GitHub: ${GITHUB_REPO}
Auto-deploy: On push to main (GitHub Actions)
Render: DISABLED`, { headers: cors });
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
.mode-btn.active{background:#238636;border-color:#238636;color:#fff}
.status{font-size:9px;padding:3px 6px;border-radius:8px;background:#238636;color:#fff;margin-left:8px}
.status.loading{background:#9e6a03}
.messages{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.msg{max-width:90%;padding:10px 14px;border-radius:14px;line-height:1.5;white-space:pre-wrap;font-size:13px;word-break:break-word}
.msg-user{align-self:flex-end;background:#238636;border-radius:14px 14px 4px 14px}
.msg-bot{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:14px 14px 14px 4px}
.msg a{color:#58a6ff}
.input-area{padding:10px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:8px}
.input-area textarea{flex:1;padding:10px 14px;border-radius:10px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px;outline:none;resize:none;min-height:44px;max-height:120px;font-family:inherit}
.input-area button{padding:10px 18px;border-radius:10px;border:none;background:#238636;color:#fff;font-weight:600;font-size:13px;cursor:pointer}
.input-area button:disabled{background:#21262d;color:#484f58}
.warning{background:#9e6a03;color:#fff;padding:8px 14px;font-size:11px;text-align:center;display:none}
.warning.show{display:block}
</style>
</head>
<body>
<div class="header">
<span style="font-size:18px">🤖</span>
<h1>OmniBot</h1>
<div class="mode-toggle">
<button class="mode-btn active" data-mode="chat">Chat</button>
<button class="mode-btn" data-mode="edit">Self-Edit</button>
</div>
<div class="status" id="status">Ready</div>
</div>
<div class="warning" id="warning">⚠️ Self-Edit Mode: AI will modify its own source code</div>
<div class="messages" id="messages"></div>
<div class="input-area">
<textarea id="input" placeholder="Message..." rows="1"></textarea>
<button id="send">Send</button>
</div>
<script>
(function(){
var mode='chat',messages=[],loading=false;
var $msg=document.getElementById('messages'),$in=document.getElementById('input'),$btn=document.getElementById('send');
var $status=document.getElementById('status'),$warn=document.getElementById('warning');

document.querySelectorAll('.mode-btn').forEach(function(b){
  b.onclick=function(){
    mode=b.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(function(x){x.classList.remove('active')});
    b.classList.add('active');
    $warn.classList.toggle('show',mode==='edit');
    $in.placeholder=mode==='edit'?'Describe the change you want...':'Message...';
  };
});

function render(){
  if(!messages.length){
    $msg.innerHTML='<div style="margin:auto;text-align:center;color:#484f58;padding:20px"><div style="font-size:40px;margin-bottom:10px">🤖</div><div style="font-size:14px">OmniBot</div><div style="font-size:11px;margin-top:6px;color:#6e7681">Self-editing AI • Chat or Self-Edit mode</div></div>';
    return;
  }
  $msg.innerHTML=messages.map(function(m){
    var c=m.role==='user'?'msg-user':'msg-bot';
    var t=m.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    t=t.replace(/(https:\\/\\/[^\\s]+)/g,'<a href="$1" target="_blank">$1</a>');
    return '<div class="msg '+c+'">'+t+'</div>';
  }).join('')+(loading?'<div class="msg msg-bot" style="color:#8b949e">🤖 Working...</div>':'');
  $msg.scrollTop=$msg.scrollHeight;
}

async function send(){
  var txt=$in.value.trim();
  if(!txt||loading)return;
  messages.push({role:'user',content:txt});
  $in.value='';$in.style.height='44px';
  loading=true;$btn.disabled=true;
  $status.textContent=mode==='edit'?'Editing...':'Thinking...';
  $status.className='status loading';
  render();
  
  try{
    var endpoint=mode==='edit'?'/api/self-edit':'/api/chat';
    var body=mode==='edit'?{instruction:txt}:{messages:messages.map(function(m){return{role:m.role,content:m.content}})};
    
    var res=await fetch(endpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    var data=await res.json();
    
    var reply='';
    if(mode==='edit'){
      if(data.success){
        reply='✅ Code updated!\\n\\n';
        reply+='📝 '+data.summary+'\\n\\n';
        reply+='Commit: '+data.commit.slice(0,7)+'\\n';
        reply+='Size: '+data.beforeSize+' → '+data.afterSize+' bytes\\n';
        reply+='\\n🚀 '+data.deploying;
        if(data.commitUrl)reply+='\\n\\n'+data.commitUrl;
      }else{
        reply='❌ Edit failed: '+(data.error||'Unknown error');
        if(data.preview)reply+='\\n\\nPreview:\\n'+data.preview.slice(0,200);
        if(data.received)reply+='\\n\\nReceived instruction: "'+data.received+'"';
      }
    }else{
      reply=data.content||data.error||'Error';
    }
    messages.push({role:'assistant',content:reply});
    $status.textContent='Ready';$status.className='status';
  }catch(e){
    messages.push({role:'assistant',content:'Error: '+e.message});
    $status.textContent='Error';$status.className='status error';
  }
  loading=false;$btn.disabled=false;render();
}

$btn.onclick=send;
$in.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
$in.oninput=function(){this.style.height='44px';this.style.height=Math.min(this.scrollHeight,120)+'px';};
render();
})();
</script>
</body>
</html>`;
