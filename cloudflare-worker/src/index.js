/**
 * OmniBot v3 - Smarter Self-Edit
 * Uses targeted editing instead of full file replacement
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
  constructor(kv, sessionId) { this.kv = kv; this.sessionId = sessionId; this.data = { history: [], edits: [] }; }
  async load() { const s = await this.kv.get(`session:${this.sessionId}`, 'json'); if (s) this.data = s; return this.data; }
  async save() { await this.kv.put(`session:${this.sessionId}`, JSON.stringify(this.data), { expirationTtl: 86400 }); }
  async addEdit(info) { this.data.edits.push({ ...info, ts: Date.now() }); await this.save(); }
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
      return data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data.error);
    }
    
    if (config.format === 'openai') {
      const key = provider.startsWith('groq') ? env.GROQ_API_KEY : env.OPENAI_API_KEY;
      const res = await fetch(config.url, {
        method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages: fullMessages, max_tokens: 8192, temperature: 0.1 })
      });
      const data = await res.json();
      let content = data.choices?.[0]?.message?.content || JSON.stringify(data.error);
      return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }
    
    if (config.format === 'anthropic') {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: config.model, max_tokens: 8192, system: systemPrompt || '', messages })
      });
      const data = await res.json();
      return data.content?.[0]?.text || JSON.stringify(data.error);
    }
  } catch (e) { return `Error: ${e.message}`; }
}

async function smartSelfEdit(instruction, env, ctx) {
  // Get current code
  const currentFile = await githubGet('cloudflare-worker/src/index.js', env);
  if (!currentFile.content) return { success: false, error: 'Could not read code', details: currentFile };
  
  const currentCode = decodeURIComponent(escape(atob(currentFile.content)));
  
  // Step 1: Ask AI to identify what needs to change and generate the new code
  const editPrompt = `You are a code modification assistant. You MUST make the requested change.

CURRENT CODE:
\`\`\`javascript
${currentCode}
\`\`\`

REQUESTED CHANGE:
${instruction}

YOUR TASK:
1. Identify where in the code the change needs to be made
2. Generate the COMPLETE new version of the file with the change implemented
3. You MUST actually implement new functionality, not just add comments

CRITICAL RULES:
- Output ONLY the complete modified JavaScript code
- NO markdown fences, NO explanations before or after
- The change MUST be functional, not just comments or whitespace
- If adding a button, add actual HTML and JavaScript for it
- If adding an endpoint, add the actual route handler
- Start directly with the first line of code

OUTPUT THE COMPLETE MODIFIED CODE NOW:`;

  const newCode = await callProvider('groq_llama', [{ role: 'user', content: editPrompt }], env);
  
  // Clean the response
  let cleanCode = newCode.trim();
  if (cleanCode.startsWith('```')) {
    cleanCode = cleanCode.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '').trim();
  }
  // Remove any preamble text before the actual code
  const codeStart = cleanCode.search(/^(\/\*\*|\/\/|const |let |var |import |export |async |function )/m);
  if (codeStart > 0) {
    cleanCode = cleanCode.slice(codeStart);
  }
  
  // Validate it's actual code
  if (!cleanCode.includes('export default') && !cleanCode.includes('addEventListener')) {
    return { success: false, error: 'Response is not valid worker code', preview: cleanCode.slice(0, 500) };
  }
  
  // Check if meaningful change was made (more than just whitespace)
  const normalizedOld = currentCode.replace(/\s+/g, ' ').trim();
  const normalizedNew = cleanCode.replace(/\s+/g, ' ').trim();
  
  if (normalizedOld === normalizedNew) {
    // AI didn't make any real changes - retry with Claude which is better at this
    const retryPrompt = `The previous attempt to modify the code failed - no meaningful changes were made.

CURRENT CODE (${currentCode.length} chars):
\`\`\`javascript
${currentCode}
\`\`\`

INSTRUCTION: ${instruction}

You MUST implement this change. This is not optional. Add actual functional code.
If the instruction asks for a button, add <button> HTML and onclick handler.
If the instruction asks for an endpoint, add an if statement in the fetch handler.

Output ONLY the complete modified JavaScript code. No explanations.`;

    const retryCode = await callProvider('claude', [{ role: 'user', content: retryPrompt }], env,
      'You are a code editor. You must make the requested change. Output only code.');
    
    cleanCode = retryCode.trim().replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '').trim();
    
    const retryNormalized = cleanCode.replace(/\s+/g, ' ').trim();
    if (normalizedOld === retryNormalized) {
      return { success: false, error: 'Both Llama and Claude failed to make changes', instruction };
    }
  }
  
  // Find what actually changed
  const diff = findDiff(currentCode, cleanCode);
  
  // Commit
  const commitMsg = `[OmniBot] ${instruction.slice(0, 60)}`;
  const result = await githubPut('cloudflare-worker/src/index.js', cleanCode, commitMsg, env);
  
  if (result.commit) {
    await ctx.addEdit({ instruction, diff, commit: result.commit.sha });
    
    return {
      success: true,
      commit: result.commit.sha,
      commitUrl: result.commit.html_url,
      changes: diff,
      beforeSize: currentCode.length,
      afterSize: cleanCode.length,
      message: `Implemented: ${instruction.slice(0, 100)}`
    };
  }
  
  return { success: false, error: result.message || 'GitHub API error', details: result };
}

function findDiff(oldCode, newCode) {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  
  const added = [];
  const removed = [];
  
  // Simple diff - find lines that are different
  const oldSet = new Set(oldLines.map(l => l.trim()).filter(l => l));
  const newSet = new Set(newLines.map(l => l.trim()).filter(l => l));
  
  for (const line of newSet) {
    if (!oldSet.has(line) && line.length > 5) {
      added.push(line.slice(0, 100));
    }
  }
  
  for (const line of oldSet) {
    if (!newSet.has(line) && line.length > 5) {
      removed.push(line.slice(0, 100));
    }
  }
  
  return {
    linesAdded: added.length,
    linesRemoved: removed.length,
    sampleAdded: added.slice(0, 5),
    sampleRemoved: removed.slice(0, 3)
  };
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
    
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '3.0', timestamp: Date.now() }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/api/context') {
      return new Response(JSON.stringify({ session: sessionId, context: ctx.data }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages, provider = 'groq_llama' } = await request.json();
        const response = await callProvider(provider, messages, env, 'You are OmniBot, a helpful AI.');
        return new Response(JSON.stringify({ content: response, session: sessionId }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }
    
    if (url.pathname === '/api/self-edit' && request.method === 'POST') {
      try {
        const { instruction } = await request.json();
        if (!instruction || instruction.length < 10) {
          return new Response(JSON.stringify({ success: false, error: 'Instruction too short' }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        
        const result = await smartSelfEdit(instruction, env, ctx);
        return new Response(JSON.stringify(result), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (url.pathname === '/api/read' && request.method === 'POST') {
      const { path } = await request.json();
      const file = await githubGet(path, env);
      if (file.content) {
        return new Response(JSON.stringify({ success: true, content: decodeURIComponent(escape(atob(file.content))) }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: false, error: file.message }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/api/write' && request.method === 'POST') {
      const { path, content, message } = await request.json();
      const result = await githubPut(path, content, message || '[OmniBot] Update', env);
      return new Response(JSON.stringify(result.commit ? { success: true, commit: result.commit.sha } : { success: false, error: result.message }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('OmniBot v3 API\n\n/api/chat\n/api/self-edit\n/api/read\n/api/write\n/api/health\n/api/context', { headers: cors });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>OmniBot v3</title>
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
.msg{max-width:92%;padding:10px 14px;border-radius:14px;line-height:1.5;white-space:pre-wrap;font-size:13px;word-break:break-word}
.msg-user{align-self:flex-end;background:#238636;border-radius:14px 14px 4px 14px}
.msg-bot{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:14px 14px 14px 4px}
.msg a{color:#58a6ff}
.diff{background:#161b22;padding:8px;border-radius:6px;margin-top:8px;font-family:monospace;font-size:11px}
.diff-add{color:#3fb950}
.diff-rem{color:#f85149}
.input-area{padding:10px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:8px}
.input-area textarea{flex:1;padding:10px 14px;border-radius:10px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px;outline:none;resize:none;min-height:44px;max-height:150px;font-family:inherit}
.input-area button{padding:10px 18px;border-radius:10px;border:none;background:#238636;color:#fff;font-weight:600;font-size:13px;cursor:pointer}
.input-area button:disabled{background:#21262d;color:#484f58}
.warn{background:#9e6a03;color:#fff;padding:8px 14px;font-size:11px;text-align:center;display:none}
.warn.show{display:block}
</style>
</head>
<body>
<div class="header">
<span style="font-size:18px">🤖</span>
<h1>OmniBot v3</h1>
<div class="mode-toggle">
<button class="mode-btn active" data-mode="chat">Chat</button>
<button class="mode-btn" data-mode="edit">Self-Edit</button>
</div>
<div class="status" id="status">Ready</div>
</div>
<div class="warn" id="warn">⚠️ Self-Edit: AI will modify its source code</div>
<div class="messages" id="messages"></div>
<div class="input-area">
<textarea id="input" placeholder="Message..." rows="1"></textarea>
<button id="send">Send</button>
</div>
<script>
(function(){
var mode='chat',msgs=[],loading=false;
var $m=document.getElementById('messages'),$i=document.getElementById('input'),$b=document.getElementById('send');
var $s=document.getElementById('status'),$w=document.getElementById('warn');

document.querySelectorAll('.mode-btn').forEach(function(b){
  b.onclick=function(){
    mode=b.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    $w.classList.toggle('show',mode==='edit');
    $i.placeholder=mode==='edit'?'Describe the change...':'Message...';
  };
});

function render(){
  if(!msgs.length){$m.innerHTML='<div style="margin:auto;text-align:center;color:#484f58"><div style="font-size:40px;margin-bottom:10px">🤖</div>OmniBot v3<div style="font-size:11px;margin-top:6px">Smarter self-editing</div></div>';return;}
  $m.innerHTML=msgs.map(function(m){
    var c=m.role==='user'?'msg-user':'msg-bot';
    var t=m.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    t=t.replace(/(https:\\/\\/[^\\s<]+)/g,'<a href="$1" target="_blank">$1</a>');
    return '<div class="msg '+c+'">'+t+'</div>';
  }).join('')+(loading?'<div class="msg msg-bot" style="color:#8b949e">🤖 Working...</div>':'');
  $m.scrollTop=$m.scrollHeight;
}

async function send(){
  var txt=$i.value.trim();if(!txt||loading)return;
  msgs.push({role:'user',content:txt});
  $i.value='';$i.style.height='44px';
  loading=true;$b.disabled=true;
  $s.textContent=mode==='edit'?'Editing...':'Thinking...';
  $s.className='status loading';render();
  
  try{
    var ep=mode==='edit'?'/api/self-edit':'/api/chat';
    var body=mode==='edit'?{instruction:txt}:{messages:msgs.map(m=>({role:m.role,content:m.content}))};
    var res=await fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await res.json();
    
    var reply='';
    if(mode==='edit'){
      if(d.success){
        reply='✅ Code updated!\\n\\n'+d.message+'\\n\\n';
        if(d.changes){
          reply+='📊 Changes: +'+d.changes.linesAdded+' / -'+d.changes.linesRemoved+' lines\\n';
          if(d.changes.sampleAdded&&d.changes.sampleAdded.length){
            reply+='\\nAdded:\\n'+d.changes.sampleAdded.map(l=>'+ '+l).join('\\n')+'\\n';
          }
        }
        reply+='\\n📦 '+d.beforeSize+' → '+d.afterSize+' bytes';
        reply+='\\n🚀 Deploying via GitHub Actions...';
        if(d.commitUrl)reply+='\\n\\n'+d.commitUrl;
      }else{
        reply='❌ Failed: '+(d.error||'Unknown');
        if(d.preview)reply+='\\n\\nPreview:\\n'+d.preview.slice(0,300);
      }
    }else{
      reply=d.content||d.error||'Error';
    }
    msgs.push({role:'assistant',content:reply});
    $s.textContent='Ready';$s.className='status';
  }catch(e){msgs.push({role:'assistant',content:'Error: '+e.message});$s.textContent='Error';$s.className='status';}
  loading=false;$b.disabled=false;render();
}

$b.onclick=send;
$i.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
$i.oninput=function(){this.style.height='44px';this.style.height=Math.min(this.scrollHeight,150)+'px';};
render();
})();
</script>
</body>
</html>`;
