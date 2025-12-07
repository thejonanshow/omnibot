/**
 * OmniBot v4 - Claude-powered self-edit
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

async function callGroq(messages, env) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 4096 })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || data.error?.message || 'Error';
}

async function callClaude(prompt, env) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ 
      model: 'claude-sonnet-4-20250514', 
      max_tokens: 16000,
      system: 'You are a code editor. Output ONLY the complete modified code. No markdown fences. No explanations. No TODO comments. Actually implement the change.',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || data.error?.message || 'Error';
}

async function selfEdit(instruction, env) {
  const file = await githubGet('cloudflare-worker/src/index.js', env);
  if (!file.content) return { success: false, error: 'Could not read code' };
  
  const code = decodeURIComponent(escape(atob(file.content)));
  const prompt = `Current code:\n\n${code}\n\nInstruction: ${instruction}\n\nOutput the complete modified code:`;
  
  let newCode = await callClaude(prompt, env);
  newCode = newCode.trim();
  if (newCode.startsWith('```')) newCode = newCode.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  
  if (!newCode.includes('export default')) return { success: false, error: 'Invalid code output', preview: newCode.slice(0, 200) };
  if (code.replace(/\s/g, '') === newCode.replace(/\s/g, '')) return { success: false, error: 'No changes made' };
  
  const r = await githubPut('cloudflare-worker/src/index.js', newCode, `[OmniBot] ${instruction.slice(0, 50)}`, env);
  
  if (r.commit) {
    const oldL = new Set(code.split('\n').map(l => l.trim()).filter(l => l));
    const newL = new Set(newCode.split('\n').map(l => l.trim()).filter(l => l));
    const added = [...newL].filter(l => !oldL.has(l));
    
    return { success: true, commit: r.commit.sha, url: r.commit.html_url, added: added.length, samples: added.slice(0, 3) };
  }
  return { success: false, error: r.message };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    
    if (url.pathname === '/' || url.pathname === '/chat') return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    
    if (url.pathname === '/api/health') return new Response(JSON.stringify({ ok: true, v: '4.0' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    
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
      return new Response(JSON.stringify(f.content ? { ok: true, content: decodeURIComponent(escape(atob(f.content))) } : { ok: false }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    
    return new Response('OmniBot v4', { headers: cors });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>OmniBot</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%;overflow:hidden}
body{font-family:system-ui;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column}
.h{padding:10px 14px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px}
.h h1{font-size:15px}
.tabs{display:flex;gap:3px;margin-left:auto}
.tab{padding:4px 10px;border-radius:5px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:11px;cursor:pointer}
.tab.on{background:#238636;border-color:#238636;color:#fff}
.st{font-size:9px;padding:3px 8px;border-radius:8px;background:#238636;color:#fff;margin-left:8px}
.st.ld{background:#9e6a03}
.w{background:#9e6a03;color:#fff;padding:6px;font-size:11px;text-align:center;display:none}
.w.on{display:block}
.msgs{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.m{max-width:90%;padding:10px 14px;border-radius:14px;line-height:1.5;white-space:pre-wrap;font-size:13px;word-break:break-word}
.m.u{align-self:flex-end;background:#238636;border-radius:14px 14px 4px 14px}
.m.b{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:14px 14px 14px 4px}
.m a{color:#58a6ff}
.i{padding:10px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:8px}
.i textarea{flex:1;padding:10px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px;resize:none;min-height:42px;max-height:120px;font-family:inherit;outline:none}
.i button{padding:10px 16px;border-radius:8px;border:none;background:#238636;color:#fff;font-weight:600;cursor:pointer}
.i button:disabled{background:#21262d;color:#484f58}
</style>
</head>
<body>
<div class="h"><span style="font-size:18px">🤖</span><h1>OmniBot</h1>
<div class="tabs"><button class="tab on" data-m="chat">Chat</button><button class="tab" data-m="edit">Edit</button></div>
<div class="st" id="st">Ready</div></div>
<div class="w" id="w">⚠️ Self-Edit: Claude will modify source code</div>
<div class="msgs" id="msgs"></div>
<div class="i"><textarea id="inp" placeholder="Message..."></textarea><button id="btn">Send</button></div>
<script>
(function(){
var mode='chat',M=[],ld=false;
var $m=document.getElementById('msgs'),$i=document.getElementById('inp'),$b=document.getElementById('btn'),$s=document.getElementById('st'),$w=document.getElementById('w');
document.querySelectorAll('.tab').forEach(function(t){t.onclick=function(){mode=t.dataset.m;document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on')});t.classList.add('on');$w.classList.toggle('on',mode==='edit');$i.placeholder=mode==='edit'?'Describe change...':'Message...';}});
function render(){if(!M.length){$m.innerHTML='<div style="margin:auto;text-align:center;color:#6e7681"><div style="font-size:36px;margin-bottom:8px">🤖</div>OmniBot v4</div>';return;}$m.innerHTML=M.map(function(x){return'<div class="m '+(x.r==='user'?'u':'b')+'">'+x.c.replace(/</g,'&lt;').replace(/(https:\\/\\/\\S+)/g,'<a href="$1" target="_blank">$1</a>')+'</div>'}).join('')+(ld?'<div class="m b" style="color:#8b949e">Working...</div>':'');$m.scrollTop=$m.scrollHeight;}
async function send(){var t=$i.value.trim();if(!t||ld)return;M.push({r:'user',c:t});$i.value='';ld=true;$b.disabled=true;$s.textContent=mode==='edit'?'Editing...':'Thinking...';$s.className='st ld';render();
try{var ep=mode==='edit'?'/api/self-edit':'/api/chat';var body=mode==='edit'?{instruction:t}:{messages:M.map(function(x){return{role:x.r,content:x.c}})};var r=await fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var d=await r.json();var reply='';
if(mode==='edit'){if(d.success){reply='✅ Done! +'+d.added+' lines\\n\\n';if(d.samples)reply+=d.samples.map(function(l){return'+ '+l.slice(0,60)}).join('\\n')+'\\n\\n';reply+='🚀 Deploying...\\n'+d.url;}else{reply='❌ '+d.error;if(d.preview)reply+='\\n\\n'+d.preview;}}else{reply=d.content||d.error||'Error';}
M.push({r:'assistant',c:reply});$s.textContent='Ready';$s.className='st';}catch(e){M.push({r:'assistant',c:'Error: '+e.message});$s.textContent='Error';}ld=false;$b.disabled=false;render();}
$b.onclick=send;$i.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};$i.oninput=function(){this.style.height='42px';this.style.height=Math.min(this.scrollHeight,120)+'px';};render();
})();
</script>
</body>
</html>`;
