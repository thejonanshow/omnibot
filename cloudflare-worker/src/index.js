/**
 * OmniBot v4 - Claude-powered self-edit
 * Uses Claude for code edits (most reliable), Llama for chat
 */

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

async function callGroq(messages, env, model = 'llama-3.3-70b-versatile') {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: 4096, temperature: 0.3 })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || data.error?.message || 'Error';
}

async function callClaude(messages, env, system = '') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 
      'x-api-key': env.ANTHROPIC_API_KEY, 
      'Content-Type': 'application/json', 
      'anthropic-version': '2023-06-01' 
    },
    body: JSON.stringify({ 
      model: 'claude-sonnet-4-20250514', 
      max_tokens: 16000,
      system,
      messages 
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || data.error?.message || 'Error';
}

async function selfEdit(instruction, env) {
  // Get current code
  const file = await githubGet('cloudflare-worker/src/index.js', env);
  if (!file.content) return { success: false, error: 'Could not read code' };
  
  const currentCode = decodeURIComponent(escape(atob(file.content)));
  
  // Use Claude for editing - it follows instructions precisely
  const system = `You are a code editor. Your ONLY job is to modify JavaScript code according to instructions.

RULES:
1. Output ONLY the complete modified JavaScript file
2. NO markdown code fences (\`\`\`)
3. NO explanations or commentary before or after the code
4. NO placeholder comments like "// TODO" or "// Add code here"
5. Actually implement the requested functionality with real, working code
6. Start your response with the very first character of the code
7. Preserve all existing functionality unless told to remove it`;

  const userMsg = `Here is the current code:

${currentCode}

INSTRUCTION: ${instruction}

Output the complete modified code with the change implemented. Start directly with the code, no preamble.`;

  const newCode = await callClaude([{ role: 'user', content: userMsg }], env, system);
  
  // Clean response
  let cleanCode = newCode.trim();
  if (cleanCode.startsWith('```')) {
    cleanCode = cleanCode.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '').trim();
  }
  
  // Validate
  if (!cleanCode.includes('export default')) {
    return { success: false, error: 'Invalid code - missing export', preview: cleanCode.slice(0, 300) };
  }
  
  if (cleanCode.length < 1000) {
    return { success: false, error: 'Code too short - likely truncated', length: cleanCode.length };
  }
  
  // Check for actual changes
  const oldNorm = currentCode.replace(/\s+/g, '');
  const newNorm = cleanCode.replace(/\s+/g, '');
  
  if (oldNorm === newNorm) {
    return { success: false, error: 'No changes detected - Claude returned identical code' };
  }
  
  // Compute diff summary
  const oldLines = new Set(currentCode.split('\n').map(l => l.trim()).filter(l => l.length > 3));
  const newLines = new Set(cleanCode.split('\n').map(l => l.trim()).filter(l => l.length > 3));
  const added = [...newLines].filter(l => !oldLines.has(l));
  const removed = [...oldLines].filter(l => !newLines.has(l));
  
  // Commit
  const result = await githubPut('cloudflare-worker/src/index.js', cleanCode, `[OmniBot] ${instruction.slice(0, 50)}`, env);
  
  if (result.commit) {
    return {
      success: true,
      commit: result.commit.sha,
      url: result.commit.html_url,
      before: currentCode.length,
      after: cleanCode.length,
      linesAdded: added.length,
      linesRemoved: removed.length,
      sampleChanges: added.slice(0, 5).map(l => l.slice(0, 80))
    };
  }
  
  return { success: false, error: result.message || 'GitHub error' };
}

class Context {
  constructor(kv, id) { this.kv = kv; this.id = id; this.data = { history: [] }; }
  async load() { const d = await this.kv.get(`s:${this.id}`, 'json'); if (d) this.data = d; }
  async save() { await this.kv.put(`s:${this.id}`, JSON.stringify(this.data), { expirationTtl: 86400 }); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    
    const sid = url.searchParams.get('s') || crypto.randomUUID();
    const ctx = new Context(env.CONTEXT, sid);
    await ctx.load();
    
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, v: '4.0' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const { messages } = await request.json();
      const reply = await callGroq(messages, env);
      return new Response(JSON.stringify({ content: reply }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    
    if (url.pathname === '/api/self-edit' && request.method === 'POST') {
      try {
        const { instruction } = await request.json();
        if (!instruction) return new Response(JSON.stringify({ success: false, error: 'No instruction' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
        
        const result = await selfEdit(instruction, env);
        return new Response(JSON.stringify(result), { headers: { ...cors, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }
    
    if (url.pathname === '/api/read' && request.method === 'POST') {
      const { path } = await request.json();
      const f = await githubGet(path, env);
      if (f.content) return new Response(JSON.stringify({ ok: true, content: decodeURIComponent(escape(atob(f.content))) }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ ok: false, error: f.message }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    
    if (url.pathname === '/api/write' && request.method === 'POST') {
      const { path, content, message } = await request.json();
      const r = await githubPut(path, content, message || 'Update', env);
      return new Response(JSON.stringify(r.commit ? { ok: true, sha: r.commit.sha } : { ok: false, error: r.message }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    
    return new Response('OmniBot v4\n\n/api/chat POST\n/api/self-edit POST\n/api/read POST\n/api/write POST\n/api/health GET', { headers: cors });
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
.hdr{padding:10px 14px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px}
.hdr h1{font-size:15px}
.tabs{display:flex;gap:3px;margin-left:auto}
.tab{padding:4px 10px;border-radius:5px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:11px;cursor:pointer}
.tab.on{background:#238636;border-color:#238636;color:#fff}
.st{font-size:9px;padding:3px 8px;border-radius:8px;background:#238636;color:#fff;margin-left:8px}
.st.ld{background:#9e6a03}
.warn{background:#9e6a03;color:#fff;padding:6px;font-size:11px;text-align:center;display:none}
.warn.on{display:block}
.msgs{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.m{max-width:90%;padding:10px 14px;border-radius:14px;line-height:1.5;white-space:pre-wrap;font-size:13px;word-break:break-word}
.m.u{align-self:flex-end;background:#238636;border-radius:14px 14px 4px 14px}
.m.b{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:14px 14px 14px 4px}
.m a{color:#58a6ff}
.inp{padding:10px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:8px}
.inp textarea{flex:1;padding:10px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px;resize:none;min-height:42px;max-height:120px;font-family:inherit;outline:none}
.inp button{padding:10px 16px;border-radius:8px;border:none;background:#238636;color:#fff;font-weight:600;cursor:pointer}
.inp button:disabled{background:#21262d;color:#484f58}
</style>
</head>
<body>
<div class="hdr">
<span style="font-size:18px">🤖</span>
<h1>OmniBot</h1>
<div class="tabs">
<button class="tab on" data-m="chat">Chat</button>
<button class="tab" data-m="edit">Edit</button>
</div>
<div class="st" id="st">Ready</div>
</div>
<div class="warn" id="warn">⚠️ Self-Edit Mode: Claude will modify the source code</div>
<div class="msgs" id="msgs"></div>
<div class="inp">
<textarea id="inp" placeholder="Message..."></textarea>
<button id="btn">Send</button>
</div>
<script>
(function(){
var mode='chat',M=[],ld=false;
var $m=document.getElementById('msgs'),$i=document.getElementById('inp'),$b=document.getElementById('btn'),$s=document.getElementById('st'),$w=document.getElementById('warn');

document.querySelectorAll('.tab').forEach(t=>{
  t.onclick=()=>{
    mode=t.dataset.m;
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');
    $w.classList.toggle('on',mode==='edit');
    $i.placeholder=mode==='edit'?'Describe what to change...':'Message...';
  };
});

function render(){
  if(!M.length){$m.innerHTML='<div style="margin:auto;text-align:center;color:#6e7681"><div style="font-size:36px;margin-bottom:8px">🤖</div>OmniBot v4<br><small>Claude-powered editing</small></div>';return;}
  $m.innerHTML=M.map(x=>'<div class="m '+(x.r==='user'?'u':'b')+'">'+x.c.replace(/</g,'&lt;').replace(/(https:\\/\\/\\S+)/g,'<a href="$1" target="_blank">$1</a>')+'</div>').join('')+(ld?'<div class="m b" style="color:#8b949e">Working...</div>':'');
  $m.scrollTop=$m.scrollHeight;
}

async function send(){
  var t=$i.value.trim();if(!t||ld)return;
  M.push({r:'user',c:t});$i.value='';
  ld=true;$b.disabled=true;$s.textContent=mode==='edit'?'Editing...':'Thinking...';$s.className='st ld';render();
  try{
    var ep=mode==='edit'?'/api/self-edit':'/api/chat';
    var body=mode==='edit'?{instruction:t}:{messages:M.map(x=>({role:x.r,content:x.c}))};
    var r=await fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await r.json();
    var reply='';
    if(mode==='edit'){
      if(d.success){
        reply='✅ Code updated!\\n\\n';
        reply+='Changes: +'+d.linesAdded+' / -'+d.linesRemoved+' lines\\n';
        reply+='Size: '+d.before+' → '+d.after+' bytes\\n\\n';
        if(d.sampleChanges&&d.sampleChanges.length){
          reply+='New code:\\n'+d.sampleChanges.map(l=>'  '+l).join('\\n')+'\\n\\n';
        }
        reply+='🚀 Deploying...\\n'+d.url;
      }else{
        reply='❌ '+d.error;
        if(d.preview)reply+='\\n\\n'+d.preview;
      }
    }else{
      reply=d.content||d.error||'Error';
    }
    M.push({r:'assistant',c:reply});
    $s.textContent='Ready';$s.className='st';
  }catch(e){M.push({r:'assistant',c:'Error: '+e.message});$s.textContent='Error';$s.className='st';}
  ld=false;$b.disabled=false;render();
}

$b.onclick=send;
$i.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
$i.oninput=function(){this.style.height='42px';this.style.height=Math.min(this.scrollHeight,120)+'px';};
render();
})();
</script>
</body>
</html>`;
