/**
 * OmniBot v4.2 - Bulletproof Multi-Qwen with Llama Fallback
 * 
 * CRITICAL FIXES:
 * - Aggressive code extraction from any response format
 * - Llama fallback if all Qwen instances fail
 * - Multiple validation attempts
 * - Better error messages
 */

const GITHUB_REPO = 'thejonanshow/omnibot';

const GROQ_MODELS = {
  qwen: 'qwen2.5-coder-32k-instruct',
  llama: 'llama-3.3-70b-versatile'
};

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
      temperature: model === 'qwen' ? 0.2 : 0.7  // Lower temp for code
    })
  });
  
  const data = await res.json();
  return data.choices?.[0]?.message?.content || data.error?.message || 'Error';
}

function extractCode(response) {
  // Try multiple extraction strategies
  let code = response.trim();
  
  // Strategy 1: Remove markdown fences
  if (code.includes('```')) {
    const fenceMatch = code.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
    if (fenceMatch) code = fenceMatch[1].trim();
    else code = code.replace(/```\w*\n?/g, '').replace(/\n?```/g, '').trim();
  }
  
  // Strategy 2: Find export default block
  const exportMatch = code.match(/(\/\*\*[\s\S]*?\*\/\s*)?(const\s+\w+\s*=[\s\S]*?)?export\s+default\s+{[\s\S]*};?/);
  if (exportMatch) {
    // Found the worker export - extract everything from start to end
    const startIdx = code.indexOf(exportMatch[0].split('export')[0]);
    code = code.slice(startIdx);
  }
  
  // Strategy 3: Remove explanatory text before code
  const codeStartMarkers = ['/**', 'const ', 'async function', 'function ', 'export default'];
  for (const marker of codeStartMarkers) {
    const idx = code.indexOf(marker);
    if (idx > 100) {  // If marker is far from start, likely has explanation before it
      code = code.slice(idx);
      break;
    }
  }
  
  // Strategy 4: Remove explanatory text after code
  const codeEndMarkers = ['</html>`;', '};', 'export default'];
  for (const marker of codeEndMarkers) {
    const idx = code.lastIndexOf(marker);
    if (idx > 0 && idx < code.length - 200) {
      // Find the actual end
      const afterMarker = code.slice(idx + marker.length).trim();
      if (afterMarker.length > 100 && !afterMarker.startsWith('\n')) {
        // Likely has explanation after - truncate
        code = code.slice(0, idx + marker.length);
      }
    }
  }
  
  return code.trim();
}

function validateCode(code) {
  // Must have export default
  if (!code.includes('export default')) return false;
  
  // Must be substantial
  if (code.length < 500) return false;
  
  // Should have basic Worker structure
  if (!code.includes('async fetch') && !code.includes('fetch(request')) return false;
  
  // Should not have obvious error markers
  if (code.includes('[TODO]') || code.includes('[PLACEHOLDER]')) return false;
  
  return true;
}

async function generateCodeWithQwen(instruction, currentCode, env, instanceNum) {
  const systemPrompt = `You are a code generator. Output ONLY JavaScript code. No explanations, no markdown, no comments about what you changed - ONLY code.`;

  const userPrompt = `Modify this Cloudflare Worker code:

\`\`\`javascript
${currentCode}
\`\`\`

Change: ${instruction}

Output the COMPLETE modified code, starting with the first line and ending with the last line. No explanations.`;

  const response = await callGroq('qwen', [{ role: 'user', content: userPrompt }], env, systemPrompt);
  const code = extractCode(response);
  
  console.log(`Qwen #${instanceNum}: Generated ${code.length} chars, valid=${validateCode(code)}`);
  
  return code;
}

async function generateCodeWithLlama(instruction, currentCode, env) {
  // Llama fallback when Qwen fails
  const systemPrompt = `You are a code editor. Output ONLY the complete modified JavaScript code. No markdown, no explanations, just code.`;

  const userPrompt = `Current Cloudflare Worker:
${currentCode.slice(0, 3000)}...

Instruction: ${instruction}

Output the complete modified code:`;

  const response = await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
  return extractCode(response);
}

async function polishCode(instruction, candidates, env) {
  // Pick the longest valid candidate as base
  const sorted = candidates.sort((a, b) => b.length - a.length);
  const base = sorted[0];
  
  const systemPrompt = `You are a code polisher. Clean up and optimize the code. Output ONLY code.`;
  
  const userPrompt = `Polish this code for: ${instruction}

\`\`\`javascript
${base}
\`\`\`

Output the polished version:`;

  const response = await callGroq('qwen', [{ role: 'user', content: userPrompt }], env, systemPrompt);
  return extractCode(response);
}

async function explainChanges(instruction, oldCode, newCode, env) {
  const systemPrompt = `You explain code changes clearly and concisely.`;

  const oldLines = oldCode.split('\n').length;
  const newLines = newCode.split('\n').length;
  const sizeDiff = newCode.length - oldCode.length;

  const userPrompt = `Instruction: ${instruction}

Old code: ${oldLines} lines
New code: ${newLines} lines  
Size change: ${sizeDiff > 0 ? '+' : ''}${sizeDiff} chars

Explain what changed in 2-3 sentences:`;

  const explanation = await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
  return explanation.trim();
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
    
    // Step 2: Try 3x Qwen in parallel
    console.log('Generating with 3x Qwen...');
    const qwenResults = await Promise.all([
      generateCodeWithQwen(instruction, currentCode, env, 1),
      generateCodeWithQwen(instruction, currentCode, env, 2),
      generateCodeWithQwen(instruction, currentCode, env, 3)
    ]);
    
    // Validate Qwen results
    const validQwen = qwenResults.filter(validateCode);
    console.log(`Valid Qwen candidates: ${validQwen.length}/3`);
    
    let finalCode;
    let usedFallback = false;
    
    if (validQwen.length > 0) {
      // Use Qwen results
      if (validQwen.length === 1) {
        finalCode = validQwen[0];
      } else {
        // Polish the best candidates
        finalCode = await polishCode(instruction, validQwen, env);
        if (!validateCode(finalCode)) {
          // Polish failed, use longest valid
          finalCode = validQwen.sort((a, b) => b.length - a.length)[0];
        }
      }
    } else {
      // All Qwen failed - use Llama fallback
      console.log('All Qwen failed, using Llama fallback...');
      finalCode = await generateCodeWithLlama(instruction, currentCode, env);
      usedFallback = true;
      
      if (!validateCode(finalCode)) {
        return {
          success: false,
          error: 'All generation attempts failed validation',
          explanation: 'Neither Qwen nor Llama produced valid Worker code',
          debug: {
            qwenResults: qwenResults.map(c => ({ 
              length: c.length, 
              hasExport: c.includes('export default'),
              preview: c.slice(0, 100)
            })),
            llamaResult: {
              length: finalCode.length,
              hasExport: finalCode.includes('export default'),
              preview: finalCode.slice(0, 100)
            }
          }
        };
      }
    }
    
    // Check if actually changed
    if (currentCode.replace(/\s/g, '') === finalCode.replace(/\s/g, '')) {
      return {
        success: false,
        error: 'No changes made',
        explanation: 'Generated code is identical to current version'
      };
    }
    
    // Step 3: Commit
    const commitMessage = `[OmniBot] ${instruction.slice(0, 72)}`;
    console.log('Committing...');
    const result = await githubPut('cloudflare-worker/src/index.js', finalCode, commitMessage, env);
    
    if (!result.commit) {
      return {
        success: false,
        error: result.message || 'Commit failed',
        explanation: 'GitHub rejected the commit'
      };
    }
    
    // Step 4: Explain
    console.log('Generating explanation...');
    const explanation = await explainChanges(instruction, currentCode, finalCode, env);
    
    // Stats
    const oldLines = new Set(currentCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')));
    const newLines = new Set(finalCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')));
    const added = [...newLines].filter(l => !oldLines.has(l));
    const removed = [...oldLines].filter(l => !newLines.has(l));
    
    return {
      success: true,
      explanation,
      commit: result.commit.sha,
      url: result.commit.html_url,
      stats: {
        added: added.length,
        removed: removed.length,
        validCandidates: validQwen.length,
        usedFallback
      },
      samples: added.slice(0, 5)
    };
    
  } catch (e) {
    return {
      success: false,
      error: e.message,
      explanation: 'Pipeline error: ' + e.stack?.split('\n')[0]
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
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        ok: true, 
        version: '4.2',
        pipeline: '3xQwen → Polish OR Llama Fallback',
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
          explanation: 'Provide a clear instruction (5+ chars)' 
        }), { 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        });
      }
      
      const result = await selfEdit(instruction, env);
      return new Response(JSON.stringify(result), { 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      });
    }
    
    return new Response('OmniBot v4.2 - Bulletproof', { headers: cors });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>OmniBot v4.2</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:system-ui;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column}
.h{padding:10px 14px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.h h1{font-size:15px;font-weight:600}
.h .badge{font-size:9px;padding:2px 6px;border-radius:4px;background:#1f6feb;color:#fff}
.tabs{display:flex;gap:3px;margin-left:auto}
.tab{padding:4px 10px;border-radius:5px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:11px;cursor:pointer;transition:all .2s}
.tab.on{background:#238636;border-color:#238636;color:#fff}
.st{font-size:9px;padding:3px 8px;border-radius:8px;background:#238636;color:#fff;margin-left:8px}
.st.ld{background:#9e6a03;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
.w{background:#9e6a03;color:#fff;padding:8px;font-size:11px;text-align:center;display:none;border-bottom:1px solid #6e4a03}
.w.on{display:block}
.msgs{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.m{max-width:90%;padding:10px 14px;border-radius:14px;line-height:1.5;white-space:pre-wrap;font-size:13px;word-break:break-word}
.m.u{align-self:flex-end;background:#238636;border-radius:14px 14px 4px 14px}
.m.b{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:14px 14px 14px 4px}
.m .exp{color:#58a6ff;font-weight:500;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #30363d}
.m .stats{color:#8b949e;font-size:11px;margin-top:8px;padding-top:8px;border-top:1px solid #30363d}
.m .stats span{display:inline-block;margin-right:12px}
.m .stats .fallback{color:#f85149}
.m .success{color:#3fb950}
.m .error{color:#f85149}
.m a{color:#58a6ff;text-decoration:none}
.m a:hover{text-decoration:underline}
.i{padding:10px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:8px}
.i textarea{flex:1;padding:10px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px;resize:none;min-height:42px;max-height:120px;font-family:inherit;outline:none}
.i textarea:focus{border-color:#388bfd;box-shadow:0 0 0 1px #388bfd}
.i button{padding:10px 16px;border-radius:8px;border:none;background:#238636;color:#fff;font-weight:600;cursor:pointer;transition:background .2s}
.i button:hover{background:#2ea043}
.i button:disabled{background:#21262d;color:#484f58;cursor:not-allowed}
</style>
</head>
<body>
<div class="h">
<span style="font-size:18px">🤖</span>
<h1>OmniBot</h1>
<span class="badge">v4.2 Bulletproof</span>
<div class="tabs">
<button class="tab on" data-m="chat">Chat</button>
<button class="tab" data-m="edit">Edit</button>
</div>
<div class="st" id="st">Ready</div>
</div>
<div class="w" id="w">⚠️ Edit: 3× Qwen OR Llama fallback → Always works</div>
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
    $i.placeholder=mode==='edit'?'Describe the change...':'Message...';
  };
});

function render(){
  if(!M.length){
    $m.innerHTML='<div style="margin:auto;text-align:center;color:#6e7681"><div style="font-size:36px;margin-bottom:8px">🤖</div><div style="font-weight:600;margin-bottom:4px">OmniBot v4.2</div><div style="font-size:11px">Bulletproof • Claude-Free • Always Works</div></div>';
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
      if(x.stats.validCandidates!==undefined) html+='<span>'+x.stats.validCandidates+'/3 Qwen</span>';
      if(x.stats.usedFallback) html+='<span class="fallback">Llama fallback</span>';
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
  $s.textContent=mode==='edit'?'Generating...':'Thinking...';
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
          exp:d.explanation||'Code updated',
          c:'✅ Committed\\n'+d.url,
          stats:d.stats
        };
        if(d.samples&&d.samples.length){
          msg.c+='\\n\\nSample:\\n'+d.samples.slice(0,3).map(l=>'+ '+l.slice(0,50)).join('\\n');
        }
        M.push(msg);
      }else{
        var errMsg={r:'assistant',exp:d.explanation||'',c:'❌ '+d.error};
        if(d.debug){
          errMsg.c+='\\n\\nDebug: '+d.debug.qwenResults.map((r,i)=>'Q'+(i+1)+': '+r.length+'ch').join(', ');
        }
        M.push(errMsg);
      }
    }else{
      M.push({r:'assistant',c:d.content||d.error||'Error'});
    }
    
    $s.textContent='Ready';
    $s.className='st';
  }catch(e){
    M.push({r:'assistant',c:'❌ '+e.message});
    $s.textContent='Error';
    $s.className='st';
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
</html>`;
