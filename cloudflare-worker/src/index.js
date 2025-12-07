/**
 * OmniBot v4.3 - Full Context Preservation
 * 
 * NEW APPROACH:
 * - Keep FULL raw responses from all Qwen instances
 * - Pass everything to orchestrator for synthesis
 * - Extract code only at the final step
 * - Never lose context or error messages
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
      temperature: 0.3
    })
  });
  
  const data = await res.json();
  
  if (data.error) {
    return `ERROR: ${data.error.message || JSON.stringify(data.error)}`;
  }
  
  return data.choices?.[0]?.message?.content || 'No response';
}

function extractCodeFromFinal(response) {
  // Only called on the final orchestrated result
  let code = response.trim();
  
  // Remove markdown fences if present
  if (code.includes('```')) {
    const match = code.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
    if (match) {
      code = match[1].trim();
    } else {
      code = code.replace(/```\w*\n?/g, '').replace(/\n?```/g, '').trim();
    }
  }
  
  // If response starts with explanation, try to find where code starts
  const codeMarkers = ['/**', 'const ', 'async function', 'function ', 'export default'];
  for (const marker of codeMarkers) {
    const idx = code.indexOf(marker);
    if (idx > 50) {  // Code starts after explanation
      code = code.slice(idx);
      break;
    }
  }
  
  return code.trim();
}

async function generateWithQwen(instruction, currentCode, env, instanceNum) {
  const systemPrompt = `You are Qwen #${instanceNum}, a code generation AI. Generate complete, working JavaScript code for Cloudflare Workers.`;

  const userPrompt = `Modify this code:

\`\`\`javascript
${currentCode}
\`\`\`

Instruction: ${instruction}

Generate the complete modified code:`;

  const response = await callGroq('qwen', [{ role: 'user', content: userPrompt }], env, systemPrompt);
  
  console.log(`Qwen #${instanceNum}: ${response.length} chars`);
  
  // Return FULL raw response - don't extract anything yet
  return {
    instance: instanceNum,
    raw: response,
    length: response.length,
    hasError: response.startsWith('ERROR:')
  };
}

async function orchestrateResponses(instruction, currentCode, qwenResponses, env) {
  // Let Llama read ALL responses and synthesize the best code
  const systemPrompt = `You are a code orchestrator. You have 3 code generation attempts from Qwen. 

Your task:
1. Read all 3 responses carefully
2. If any contain valid code, synthesize the BEST solution
3. If all failed or have errors, generate the code yourself
4. Output ONLY the complete working JavaScript code - no explanations

The code must:
- Work in Cloudflare Workers
- Have 'export default { async fetch(...) { ... } }'
- Implement the requested change
- Be complete and functional`;

  const responseSummary = qwenResponses.map(r => 
    `=== QWEN #${r.instance} (${r.length} chars) ${r.hasError ? '[ERROR]' : ''} ===\n${r.raw}`
  ).join('\n\n');

  const userPrompt = `Original code length: ${currentCode.length} chars

Instruction: ${instruction}

Qwen responses:

${responseSummary}

Synthesize the BEST code OR generate it yourself if all Qwen responses failed. Output the complete code:`;

  const response = await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
  
  console.log(`Orchestrator: ${response.length} chars`);
  
  return response;
}

async function explainChanges(instruction, oldCode, newCode, env) {
  const systemPrompt = `Explain code changes concisely.`;

  const userPrompt = `Instruction: ${instruction}

Old: ${oldCode.split('\n').length} lines
New: ${newCode.split('\n').length} lines

Explain what changed (2-3 sentences):`;

  return await callGroq('llama', [{ role: 'user', content: userPrompt }], env, systemPrompt);
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
    
    // Step 2: Get 3 raw responses from Qwen (keep everything)
    console.log('Calling 3x Qwen...');
    const qwenResponses = await Promise.all([
      generateWithQwen(instruction, currentCode, env, 1),
      generateWithQwen(instruction, currentCode, env, 2),
      generateWithQwen(instruction, currentCode, env, 3)
    ]);
    
    // Step 3: Orchestrator reads ALL responses and synthesizes
    console.log('Orchestrating responses...');
    const orchestratedResponse = await orchestrateResponses(
      instruction, 
      currentCode, 
      qwenResponses, 
      env
    );
    
    // Step 4: NOW extract code from final result
    const finalCode = extractCodeFromFinal(orchestratedResponse);
    
    // Validate
    if (!finalCode.includes('export default')) {
      return {
        success: false,
        error: 'No valid Worker export in final code',
        explanation: 'Orchestrator failed to produce valid code',
        debug: {
          qwen: qwenResponses.map(r => ({
            instance: r.instance,
            length: r.length,
            hasError: r.hasError,
            preview: r.raw.slice(0, 150)
          })),
          orchestrator: {
            length: orchestratedResponse.length,
            preview: orchestratedResponse.slice(0, 300)
          },
          extracted: {
            length: finalCode.length,
            preview: finalCode.slice(0, 200)
          }
        }
      };
    }
    
    if (finalCode.length < 500) {
      return {
        success: false,
        error: `Final code too short (${finalCode.length} chars)`,
        explanation: 'Generated code appears incomplete',
        debug: {
          finalLength: finalCode.length,
          preview: finalCode
        }
      };
    }
    
    // Check if changed
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
        qwenLengths: qwenResponses.map(r => r.length),
        orchestratorLength: orchestratedResponse.length
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
        version: '4.3',
        pipeline: '3xQwen (full context) → Llama orchestrator',
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
    
    return new Response('OmniBot v4.3 - Full Context', { headers: cors });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>OmniBot v4.3</title>
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
<span class="badge">v4.3 Full Context</span>
<div class="tabs">
<button class="tab on" data-m="chat">Chat</button>
<button class="tab" data-m="edit">Edit</button>
</div>
<div class="st" id="st">Ready</div>
</div>
<div class="w" id="w">⚠️ Edit: 3× Qwen (keep all) → Llama orchestrates</div>
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
    $m.innerHTML='<div style="margin:auto;text-align:center;color:#6e7681"><div style="font-size:36px;margin-bottom:8px">🤖</div><div style="font-weight:600;margin-bottom:4px">OmniBot v4.3</div><div style="font-size:11px">Full Context • Never Loses Info</div></div>';
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
      if(x.stats.qwenLengths) html+='<span>Qwen: '+x.stats.qwenLengths.join(',')+' ch</span>';
      if(x.stats.orchestratorLength) html+='<span>Orch: '+x.stats.orchestratorLength+'ch</span>';
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
          exp:d.explanation||'Updated',
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
          err.c+='\\n\\nDebug:';
          if(d.debug.qwen) err.c+='\\nQwen: '+d.debug.qwen.map(q=>'#'+q.instance+':'+q.length+'ch').join(', ');
          if(d.debug.orchestrator) err.c+='\\nOrch: '+d.debug.orchestrator.length+'ch';
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
</html>`;
