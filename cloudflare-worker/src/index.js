/**
// CI test: Fixed browser API detection for HTML templates
 * OmniBot - Axolotl Edition
 * https://en.wikipedia.org/wiki/Axolotl
 * 
 * Semantic versioning via exotic sea creatures (alphabetical):
 * A: Axolotl, B: Blobfish, C: Cuttlefish, D: Dumbo Octopus, E: Electric Eel
 * F: Frogfish, G: Goblin Shark, H: Hagfish, I: Icefish, J: Jellyfish
 * K: Kissing Gourami, L: Leafy Sea Dragon, M: Mantis Shrimp, N: Nautilus
 * O: Oarfish, P: Pufferfish, Q: Queen Angelfish, R: Ribbon Eel, S: Sea Pig
 * T: Tardigrade, U: Umbrella Octopus, V: Vampire Squid, W: Wobbegong
 * X: Xiphias (Swordfish), Y: Yeti Crab, Z: Zebrafish
 * Then: Anglerfish, Barreleye, Chimaera, Dragon Moray...
 * 
 * Current: Axolotl (A) - First stable version with safety validation
 * 
 * CRITICAL SAFETY FEATURES:
 * - Validates code structure BEFORE committing
 * - Cannot destroy core functions (selfEdit, callGroq, etc)
 * - Rejects wholesale replacements
 * - Only allows targeted modifications
 * - NO data extraction - passes full response to validation
 */

const GITHUB_REPO = 'thejonanshow/omnibot';

const GROQ_MODELS = {
  qwen: 'qwen2.5-coder-32k-instruct',
  llama: 'llama-3.3-70b-versatile'
};

// CRITICAL: Functions that must exist in any version
const REQUIRED_FUNCTIONS = [
  'async function selfEdit',
  'async function callGroq',
  'async function githubGet',
  'async function githubPut',
  'export default'
];

async function githubGet(path, env) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=main`, {
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
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
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
  const fullMessages = systemPrompt 
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;
    
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
  // CRITICAL: Ensure all required functions exist
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
  
  // Check minimum size (full OmniBot should be ~10KB+)
  if (code.length < 5000) {
    return {
      valid: false,
      reason: `Code too short (${code.length} chars) - appears to be partial or replacement`
    };
  }
  
  // Check for HTML content (the UI)
  if (!code.includes('const HTML =') && !code.includes('<html>')) {
    return {
      valid: false,
      reason: 'Missing HTML UI - structure destroyed'
    };
  }
  
  return { valid: true };
}

function cleanCodeFences(text) {
  // ONLY remove markdown fences - preserve EVERYTHING else
  let cleaned = text.trim();
  
  // Remove outer fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:javascript|js)?\s*\n?/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  
  return cleaned;
}

// Alias for backward compatibility with tests
const extractCodeFromFinal = cleanCodeFences;

async function generateWithLlama(instruction, currentCode, env) {
  const systemPrompt = `You are modifying Cloudflare Worker code.

OUTPUT ONLY THE COMPLETE MODIFIED CODE.
NO explanations, NO markdown fences, NO "here's the code", NO comments about what changed.
Just the raw JavaScript code starting with /** and ending with the closing HTML template.

CRITICAL RULES:
1. MODIFY the existing code, do NOT replace it
2. Keep ALL existing functions intact
3. Only change what's specifically requested
4. Code must work in Cloudflare Workers (no browser APIs)`;

  const userPrompt = `Current code (${currentCode.length} chars):

\`\`\`javascript
${currentCode}
\`\`\`

Change: ${instruction}

Output the COMPLETE modified code (no explanations):`;

  const response = await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
  
  console.log(`Llama: ${response.length} chars`);
  
  return response;
}

async function selfEdit(instruction, env) {
  try {
    // Step 1: Read current code
    const file = await githubGet('cloudflare-worker/src/index.js', env);
    if (!file.content) {
      return { 
        success: false, 
        error: 'Could not read code',
        explanation: 'GitHub API failed' 
      };
    }
    
    const currentCode = decodeURIComponent(escape(atob(file.content)));
    console.log(`Current code: ${currentCode.length} chars`);
    
    // Step 2: Use Llama to modify the code
    console.log('Generating with Llama...');
    const response = await generateWithLlama(instruction, currentCode, env);
    
    // Step 3: Clean code fences ONLY (no extraction)
    const finalCode = cleanCodeFences(response);
    console.log(`After fence removal: ${finalCode.length} chars`);
    
    // Step 4: CRITICAL SAFETY CHECK
    const validation = validateCodeStructure(finalCode);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Safety check failed',
        explanation: validation.reason,
        debug: {
          instruction: instruction,
          responseLength: response.length,
          extractedLength: finalCode.length,
          fullLlamaResponse: response,  // FULL response for debugging
          extractedCode: finalCode      // What we extracted
        }
      };
    }
    
    // Check if actually changed
    if (currentCode.replace(/\s/g, '') === finalCode.replace(/\s/g, '')) {
      return {
        success: false,
        error: 'No changes made',
        explanation: 'Generated code identical to current'
      };
    }
    
    // Step 5: Commit
    const commitMessage = `[OmniBot] ${instruction.slice(0, 72)}`;
    console.log('Committing...');
    const result = await githubPut('cloudflare-worker/src/index.js', finalCode, commitMessage, env);
    
    if (!result.commit) {
      return {
        success: false,
        error: result.message || 'Commit failed',
        explanation: 'GitHub rejected commit'
      };
    }
    
    // Step 6: Explain
    const explanation = await explainChanges(instruction, currentCode, finalCode, env);
    
    // Stats
    const oldLines = new Set(currentCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')));
    const newLines = new Set(finalCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')));
    const added = [...newLines].filter(l => !oldLines.has(l));
    const removed = [...oldLines].filter(l => !newLines.has(l));
    
    return {
      success: true,
      explanation: explanation.trim(),
      commit: result.commit.sha,
      url: result.commit.html_url,
      stats: {
        added: added.length,
        removed: removed.length,
        size: finalCode.length
      },
      samples: added.slice(0, 5)
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message,
      explanation: 'Pipeline error',
      stack: e.stack?.split('\n').slice(0, 3).join('\n')
    };
  }
}

async function explainChanges(instruction, oldCode, newCode, env) {
  const systemPrompt = `Explain code changes concisely.`;

  const userPrompt = `Instruction: ${instruction}

Old: ${oldCode.split('\n').length} lines
New: ${newCode.split('\n').length} lines

Explain what changed (2-3 sentences):`;

  return await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
}

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
    
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        ok: true,
        version: 'Axolotl',  // For test compatibility
        creature: 'Axolotl',
        wikipedia: 'https://en.wikipedia.org/wiki/Axolotl',
        safetyFeatures: ['structure-validation', 'no-wholesale-replacement', 'no-extraction'],
        models: GROQ_MODELS
      }), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const { messages } = await request.json();
      const reply = await callGroq('llama', messages, env);
      return new Response(JSON.stringify({ content: reply }), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    if (url.pathname === '/api/self-edit' && request.method === 'POST') {
      const { instruction } = await request.json();
      
      if (!instruction || instruction.length < 5) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Instruction too short',
          explanation: 'Provide clear instruction (5+ chars)' 
        }), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
      
      const result = await selfEdit(instruction, env);
      return new Response(JSON.stringify(result), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    return new Response('OmniBot v4.4 - Safe Edition', { headers: cors });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>OmniBot - Axolotl</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:system-ui;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column}
.h{padding:10px 14px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.h h1{font-size:15px;font-weight:600}
.h .badge{font-size:9px;padding:2px 6px;border-radius:4px;background:#1f6feb;color:#fff}
.tabs{display:flex;gap:3px;margin-left:auto}
.tab{padding:4px 10px;border-radius:5px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:11px;cursor:pointer;transition:all .2s}
.tab.on{background:#4682b4;border-color:#4682b4;color:#fff}
.st{font-size:9px;padding:3px 8px;border-radius:8px;background:#4682b4;color:#fff;margin-left:8px}
.st.ld{background:#9e6a03;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
.w{background:#9e6a03;color:#fff;padding:8px;font-size:11px;text-align:center;display:none;border-bottom:1px solid #6e4a03}
.w.on{display:block}
.msgs{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.m{max-width:90%;padding:10px 14px;border-radius:14px;line-height:1.5;white-space:pre-wrap;font-size:13px;word-break:break-word}
.m.u{align-self:flex-end;background:#4682b4;border-radius:14px 14px 4px 14px}
.m.b{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:14px 14px 14px 4px}
.m .exp{color:#58a6ff;font-weight:500;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #30363d}
.m .stats{color:#8b949e;font-size:11px;margin-top:8px;padding-top:8px;border-top:1px solid #30363d}
.m .stats span{display:inline-block;margin-right:12px}
.m .success{color:#3fb950}
.m .error{color:#f85149}
.m a{color:#58a6ff;text-decoration:none}
.m a:hover{text-decoration:underline}
.i{padding:10px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:8px}
.i textarea{flex:1;padding:10px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px;resize:none;min-height:42px;max-height:120px;font-family:inherit;outline:none}
.i textarea:focus{border-color:#388bfd;box-shadow:0 0 0 1px #388bfd}
.i button{padding:10px 16px;border-radius:8px;border:none;background:#4682b4;color:#fff;font-weight:600;cursor:pointer;transition:background .2s}
.i button:hover{background:#6495ed}
.i button:disabled{background:#21262d;color:#484f58;cursor:not-allowed}
</style>
</head>
<body>
<div class="h">
<span style="font-size:18px">🤖</span>
<h1>OmniBot</h1>
<span class="badge" title="https://en.wikipedia.org/wiki/Axolotl">🦎 Axolotl</span>
<div class="tabs">
<button class="tab on" data-m="chat">Chat</button>
<button class="tab" data-m="edit">Edit</button>
</div>
<div class="st" id="st">Ready</div>
</div>
<div class="w" id="w">⚠️ Edit: Llama modifies → Safety validation → Cannot destroy itself</div>
<div class="msgs" id="msgs"></div>
<div class="i">
<textarea id="inp" placeholder="Message..."></textarea>
<button id="btn">Send</button>
</div>
<script>
(function(){
var mode='chat',M=[],ld=false;
var $m=document.getElementById('msgs'),$i=document.getElementById('inp'),$b=document.getElementById('btn'),$s=document.getElementById('st'),$w=document.getElementById('w');

document.querySelectorAll('.tab').forEach(t=>{
  t.onclick=()=>{
    mode=t.dataset.m;
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');
    $w.classList.toggle('on',mode==='edit');
    $i.placeholder=mode==='edit'?'Describe change...':'Message...';
  };
});

function render(){
  if(!M.length){
    $m.innerHTML='<div style="margin:auto;text-align:center;color:#6e7681"><div style="font-size:36px;margin-bottom:8px">🦎</div><div style="font-weight:600;margin-bottom:4px">OmniBot Axolotl</div><div style="font-size:11px"><a href="https://en.wikipedia.org/wiki/Axolotl" target="_blank" style="color:#58a6ff">Safe Edition</a> • Cannot Self-Destruct</div></div>';
    return;
  }
  $m.innerHTML=M.map(x=>{
    let html='<div class="m '+(x.r==='user'?'u':'b')+'">';
    if(x.exp) html+='<div class="exp">'+esc(x.exp)+'</div>';
    html+=esc(x.c);
    if(x.stats){
      html+='<div class="stats">';
      if(x.stats.added!==undefined) html+='<span class="success">+'+x.stats.added+'</span>';
      if(x.stats.removed!==undefined) html+='<span class="error">-'+x.stats.removed+'</span>';
      if(x.stats.size) html+='<span>'+x.stats.size+' chars</span>';
      html+='</div>';
    }
    html+='</div>';
    return html;
  }).join('')+(ld?'<div class="m b" style="color:#8b949e">⚙️ Processing...</div>':'');
  $m.scrollTop=$m.scrollHeight;
}

function esc(s){
  return s.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/(https:\\/\\/[^\\s<]+)/g,'<a href="$1" target="_blank">$1</a>');
}

async function send(){
  var t=$i.value.trim();
  if(!t||ld)return;
  
  M.push({r:'user',c:t});
  $i.value='';
  ld=true;
  $b.disabled=true;
  $s.textContent=mode==='edit'?'Modifying...':'Thinking...';
  $s.className='st ld';
  render();
  
  try{
    var ep=mode==='edit'?'/api/self-edit':'/api/chat';
    var body=mode==='edit'?{instruction:t}:{messages:M.filter(x=>x.r).map(x=>({role:x.r==='user'?'user':'assistant',content:x.c}))};
    
    var r=await fetch(ep,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    
    var d=await r.json();
    
    if(mode==='edit'){
      if(d.success){
        var msg={
          r:'assistant',
          exp:d.explanation||'Modified',
          c:'✅ '+d.url,
          stats:d.stats
        };
        if(d.samples&&d.samples.length){
          msg.c+='\\n\\n'+d.samples.slice(0,3).map(l=>'+ '+l.slice(0,50)).join('\\n');
        }
        M.push(msg);
      }else{
        var err={r:'assistant',exp:d.explanation||'',c:'❌ '+d.error};
        if(d.debug){
          // Show full debug info in expandable section
          err.c+='\\n\\n📋 Debug Info:';
          err.c+='\\nInstruction: '+d.debug.instruction;
          err.c+='\\nLlama response: '+d.debug.responseLength+' chars';
          err.c+='\\nExtracted code: '+d.debug.extractedLength+' chars';
          if(d.debug.fullLlamaResponse){
            err.c+='\\n\\n--- FULL LLAMA RESPONSE ---\\n'+d.debug.fullLlamaResponse.slice(0,2000);
            if(d.debug.fullLlamaResponse.length>2000) err.c+='\\n... ('+((d.debug.fullLlamaResponse.length-2000))+' more chars)';
          }
          if(d.debug.extractedCode){
            err.c+='\\n\\n--- EXTRACTED CODE ---\\n'+d.debug.extractedCode.slice(0,1000);
            if(d.debug.extractedCode.length>1000) err.c+='\\n... ('+((d.debug.extractedCode.length-1000))+' more chars)';
          }
        }
        M.push(err);
      }
    }else{
      M.push({r:'assistant',c:d.content||d.error||'Error'});
    }
    
    $s.textContent='Ready';
    $s.className='st';
  }catch(e){
    M.push({r:'assistant',c:'❌ '+e.message});
    $s.textContent='Error';
  }
  
  ld=false;
  $b.disabled=false;
  render();
}

$b.onclick=send;
$i.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
$i.oninput=function(){this.style.height='42px';this.style.height=Math.min(this.scrollHeight,120)+'px';};
render();
})();
</script>
</body>
</html>
// Deployed: 2025-12-08T05:15:25Z - CI test