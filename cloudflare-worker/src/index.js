/**
 * OmniBot Multi-AI Orchestrator with Shared Context
 * 
 * All AIs share:
 * - Project context (goals, architecture, decisions)
 * - Conversation history
 * - Code artifacts produced
 * - Feedback from each step
 * 
 * Pipeline:
 * 1. Gemini - Architecture & design
 * 2. 5x Qwen in parallel - Implementation  
 * 3. Llama - Combine & integrate
 * 4. GPT - Review & improve
 * 5. Claude - Polish & finalize
 */

const PROVIDERS = {
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    format: 'gemini'
  },
  groq_llama: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    format: 'openai'
  },
  groq_qwen: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'qwen/qwen3-32b',
    format: 'openai'
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    format: 'openai'
  },
  claude: {
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    format: 'anthropic'
  }
};

// Shared context that all AIs can read/write
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
      history: []
    };
  }

  async load() {
    const stored = await this.kv.get(`session:${this.sessionId}`, 'json');
    if (stored) this.data = stored;
    return this.data;
  }

  async save() {
    await this.kv.put(`session:${this.sessionId}`, JSON.stringify(this.data), { expirationTtl: 86400 });
  }

  async update(key, value) {
    this.data[key] = value;
    await this.save();
  }

  async addFeedback(from, message) {
    this.data.feedback.push({ from, message, timestamp: Date.now() });
    await this.save();
  }

  async addHistory(role, content, provider = null) {
    this.data.history.push({ role, content, provider, timestamp: Date.now() });
    await this.save();
  }

  getContextPrompt() {
    return `
## SHARED PROJECT CONTEXT

### Original Task
${this.data.task || 'Not set'}

### Architecture (by Gemini)
${this.data.architecture || 'Not yet designed'}

### Key Decisions Made
${this.data.decisions.map((d, i) => `${i+1}. ${d}`).join('\n') || 'None yet'}

### Implementation Status
${Object.entries(this.data.implementations).map(([k, v]) => `- ${k}: ${v ? 'Done' : 'Pending'}`).join('\n') || 'Not started'}

### Combined Code (by Llama)
${this.data.combined ? 'Available - ' + this.data.combined.length + ' chars' : 'Not yet combined'}

### Review Notes (by GPT)
${this.data.reviewed ? 'Available' : 'Not yet reviewed'}

### Team Feedback
${this.data.feedback.slice(-5).map(f => `[${f.from}]: ${f.message}`).join('\n') || 'None'}

---
Use this context to inform your work. Add to it as you make progress.
`;
  }
}

async function callProvider(provider, messages, env, systemPrompt = null) {
  const config = PROVIDERS[provider];
  const fullMessages = systemPrompt 
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

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
        body: JSON.stringify({ model: config.model, messages: fullMessages, max_tokens: 4096 })
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || JSON.stringify(data.error) || 'API error';
    }

    if (config.format === 'anthropic') {
      const sysMsg = systemPrompt || 'You are a helpful assistant.';
      const res = await fetch(config.url, {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          system: sysMsg,
          messages: messages
        })
      });
      const data = await res.json();
      return data.content?.[0]?.text || JSON.stringify(data.error) || 'Claude error';
    }
  } catch (e) {
    return `Error calling ${provider}: ${e.message}`;
  }
}

async function runPipeline(ctx, env) {
  const results = { steps: [], final: null };
  
  // Step 1: Gemini - Architecture
  const archPrompt = `You are Gemini, the architect.

${ctx.getContextPrompt()}

Design a clear technical architecture for this task. Include:
- Component breakdown
- File structure  
- Data flow
- Key interfaces
- Technology choices

Be specific and actionable. Other AIs will implement your design.`;

  const architecture = await callProvider('gemini', 
    [{ role: 'user', content: ctx.data.task }], env, archPrompt);
  
  await ctx.update('architecture', architecture);
  await ctx.addFeedback('Gemini', 'Architecture complete');
  results.steps.push({ provider: 'Gemini', role: 'Architect', output: architecture });

  // Step 2: 5 parallel Qwen instances
  const qwenRoles = [
    { name: 'Core', focus: 'core business logic and main functions' },
    { name: 'Safety', focus: 'error handling, validation, and edge cases' },
    { name: 'Interface', focus: 'UI components and user interaction' },
    { name: 'Security', focus: 'authentication, authorization, and data protection' },
    { name: 'Quality', focus: 'tests, documentation, and code quality' }
  ];

  const qwenPromises = qwenRoles.map((role, i) => {
    const prompt = `You are Qwen #${i+1} (${role.name} Specialist).

${ctx.getContextPrompt()}

YOUR SPECIFIC FOCUS: ${role.focus}

Based on the architecture above, implement your part. Write complete, production-ready code.
Coordinate with other Qwen instances through the shared context.
Note any dependencies on other components.`;

    return callProvider('groq_qwen', 
      [{ role: 'user', content: `Implement: ${role.focus}` }], env, prompt)
      .then(async result => {
        await ctx.update('implementations', { ...ctx.data.implementations, [role.name]: result });
        await ctx.addFeedback(`Qwen-${role.name}`, `Completed ${role.focus}`);
        return { role: role.name, output: result };
      });
  });

  const qwenResults = await Promise.all(qwenPromises);
  results.steps.push({ provider: 'Qwen x5', role: 'Implementers', outputs: qwenResults });

  // Step 3: Llama - Combine
  const combinePrompt = `You are Llama, the integrator.

${ctx.getContextPrompt()}

You have 5 implementations from the Qwen team:

${qwenResults.map(r => `### ${r.role} Implementation:\n${r.output}\n`).join('\n')}

YOUR TASK:
1. Combine all implementations into ONE coherent codebase
2. Resolve any conflicts or duplications
3. Ensure all components work together
4. Maintain consistent style and patterns

Output the complete, integrated code:`;

  const combined = await callProvider('groq_llama',
    [{ role: 'user', content: 'Combine all implementations' }], env, combinePrompt);
  
  await ctx.update('combined', combined);
  await ctx.addFeedback('Llama', 'Integration complete');
  results.steps.push({ provider: 'Llama', role: 'Integrator', output: combined });

  // Step 4: GPT - Review
  const reviewPrompt = `You are GPT, the code reviewer.

${ctx.getContextPrompt()}

CURRENT CODE TO REVIEW:
${combined}

YOUR TASK:
1. Find bugs and issues
2. Suggest improvements
3. Check for security vulnerabilities
4. Ensure best practices
5. Output an IMPROVED version of the code

Be thorough but constructive.`;

  const reviewed = await callProvider('openai',
    [{ role: 'user', content: 'Review and improve this code' }], env, reviewPrompt);
  
  await ctx.update('reviewed', reviewed);
  await ctx.addFeedback('GPT', 'Code review complete');
  results.steps.push({ provider: 'GPT', role: 'Reviewer', output: reviewed });

  // Step 5: Claude - Polish
  const polishPrompt = `You are Claude, the finisher.

${ctx.getContextPrompt()}

REVIEWED CODE:
${reviewed}

YOUR TASK:
1. Final polish and cleanup
2. Ensure consistent formatting
3. Add helpful comments where needed
4. Make it production-ready
5. Verify it matches the original task requirements

Output the FINAL, polished code:`;

  const final = await callProvider('claude',
    [{ role: 'user', content: 'Polish and finalize' }], env, polishPrompt);
  
  await ctx.update('final', final);
  await ctx.addFeedback('Claude', 'Final polish complete');
  results.steps.push({ provider: 'Claude', role: 'Finisher', output: final });

  results.final = final;
  return results;
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
    
    // Get or create session
    const sessionId = url.searchParams.get('session') || crypto.randomUUID();
    const ctx = new SharedContext(env.CONTEXT, sessionId);
    await ctx.load();
    
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    // Get current context
    if (url.pathname === '/api/context') {
      return new Response(JSON.stringify({ session: sessionId, context: ctx.data }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    // Chat with context
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages, provider = 'groq_llama' } = await request.json();
        const contextPrompt = `${ctx.getContextPrompt()}\n\nYou are part of the OmniBot team. Use the shared context above to inform your responses.`;
        const response = await callProvider(provider, messages, env, contextPrompt);
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
    
    // Run full pipeline with context
    if (url.pathname === '/api/build' && request.method === 'POST') {
      try {
        const { task } = await request.json();
        await ctx.update('task', task);
        await ctx.addHistory('user', task);
        
        const results = await runPipeline(ctx, env);
        return new Response(JSON.stringify({ ...results, session: sessionId }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response(`OmniBot Orchestrator API

Session: ${sessionId}

Endpoints:
- GET /api/context?session=X - Get shared context
- POST /api/chat - Chat with context (body: {messages, provider?})
- POST /api/build - Run full pipeline (body: {task})

All AIs share context through KV storage.`, { headers: cors });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>OmniBot Orchestrator</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:-apple-system,system-ui,sans-serif;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column}
.header{padding:12px 16px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.header h1{font-size:16px;font-weight:600}
.session{font-size:10px;color:#6e7681;font-family:monospace}
.mode-toggle{display:flex;gap:4px;margin-left:auto}
.mode-btn{padding:5px 10px;border-radius:6px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:11px;cursor:pointer}
.mode-btn.active{background:#238636;border-color:#238636;color:#fff}
.status{font-size:10px;padding:4px 8px;border-radius:10px;background:#238636;color:#fff}
.status.loading{background:#9e6a03}
.pipeline{display:none;padding:6px 16px;background:#161b22;border-bottom:1px solid #30363d;font-size:11px;color:#8b949e}
.pipeline.show{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.step{padding:3px 6px;border-radius:4px;background:#21262d;border:1px solid #30363d;font-size:10px}
.step.active{background:#9e6a03;border-color:#9e6a03;color:#fff}
.step.done{background:#238636;border-color:#238636;color:#fff}
.messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.msg{max-width:90%;padding:10px 14px;border-radius:16px;line-height:1.4;white-space:pre-wrap;font-size:13px}
.msg-user{align-self:flex-end;background:#238636;border-radius:16px 16px 4px 16px}
.msg-bot{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:16px 16px 16px 4px}
.msg pre{background:#161b22;padding:6px;border-radius:4px;overflow-x:auto;margin:6px 0;font-size:11px}
.input-area{padding:10px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:8px}
.input-area textarea{flex:1;padding:10px 14px;border-radius:10px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:14px;outline:none;resize:none;min-height:44px;max-height:100px;font-family:inherit}
.input-area button{padding:10px 16px;border-radius:10px;border:none;background:#238636;color:#fff;font-weight:600;font-size:13px;cursor:pointer}
.input-area button:disabled{background:#21262d;color:#484f58}
.context-panel{display:none;position:fixed;top:0;right:0;width:300px;height:100%;background:#161b22;border-left:1px solid #30363d;padding:12px;overflow-y:auto;font-size:11px}
.context-panel.show{display:block}
.context-panel h3{margin-bottom:8px;color:#8b949e}
.context-panel pre{background:#0d1117;padding:8px;border-radius:4px;white-space:pre-wrap;font-size:10px}
</style>
</head>
<body>
<div class="header">
<span style="font-size:20px">🤖</span>
<h1>OmniBot</h1>
<div class="session" id="sessionId"></div>
<div class="mode-toggle">
<button class="mode-btn active" data-mode="chat">Chat</button>
<button class="mode-btn" data-mode="build">Build</button>
<button class="mode-btn" data-mode="context">Context</button>
</div>
<div class="status" id="status">Ready</div>
</div>
<div class="pipeline" id="pipeline">
<span>Pipeline:</span>
<span class="step" data-step="1">Gemini</span>
<span class="step" data-step="2">5×Qwen</span>
<span class="step" data-step="3">Llama</span>
<span class="step" data-step="4">GPT</span>
<span class="step" data-step="5">Claude</span>
</div>
<div class="messages" id="messages"></div>
<div class="input-area">
<textarea id="input" placeholder="Describe what to build..." rows="1"></textarea>
<button id="send">Send</button>
</div>
<div class="context-panel" id="contextPanel">
<h3>Shared Context</h3>
<pre id="contextData">Loading...</pre>
</div>
<script>
(function(){
var mode='chat',messages=[],loading=false,session=localStorage.getItem('omnibot_session')||'';
var messagesEl=document.getElementById('messages'),inputEl=document.getElementById('input'),sendBtn=document.getElementById('send');
var statusEl=document.getElementById('status'),pipelineEl=document.getElementById('pipeline'),sessionEl=document.getElementById('sessionId');
var contextPanel=document.getElementById('contextPanel'),contextData=document.getElementById('contextData');

document.querySelectorAll('.mode-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    var m=btn.dataset.mode;
    if(m==='context'){contextPanel.classList.toggle('show');loadContext();return;}
    mode=m;
    document.querySelectorAll('.mode-btn').forEach(function(b){b.classList.remove('active');});
    btn.classList.add('active');
    pipelineEl.classList.toggle('show',mode==='build');
  });
});

function loadContext(){
  fetch('/api/context'+(session?'?session='+session:'')).then(r=>r.json()).then(d=>{
    session=d.session;sessionEl.textContent='Session: '+session.slice(0,8);
    localStorage.setItem('omnibot_session',session);
    contextData.textContent=JSON.stringify(d.context,null,2);
  });
}

function render(){
  if(!messages.length){messagesEl.innerHTML='<div style="margin:auto;text-align:center;color:#484f58"><div style="font-size:44px;margin-bottom:10px">🤖</div><div>OmniBot Orchestrator</div><div style="font-size:11px;margin-top:4px">All AIs share context</div></div>';return;}
  messagesEl.innerHTML=messages.map(function(m){
    var cls=m.role==='user'?'msg-user':'msg-bot';
    var txt=m.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return '<div class="msg '+cls+'">'+txt+'</div>';
  }).join('')+(loading?'<div class="msg msg-bot" style="color:#8b949e">🤖 Working...</div>':'');
  messagesEl.scrollTop=messagesEl.scrollHeight;
}

function setStatus(t,c){statusEl.textContent=t;statusEl.className='status'+(c?' '+c:'');}
function setStep(n){document.querySelectorAll('.step').forEach(function(el){var s=+el.dataset.step;el.classList.remove('active','done');if(s<n)el.classList.add('done');if(s===n)el.classList.add('active');});}

async function send(){
  var text=inputEl.value.trim();if(!text||loading)return;
  messages.push({role:'user',content:text});inputEl.value='';loading=true;sendBtn.disabled=true;
  setStatus('Working...','loading');render();
  try{
    var endpoint=mode==='build'?'/api/build':'/api/chat';
    var body=mode==='build'?{task:text}:{messages:messages};
    if(session)endpoint+='?session='+session;
    var res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var data=await res.json();
    if(data.session){session=data.session;sessionEl.textContent='Session: '+session.slice(0,8);localStorage.setItem('omnibot_session',session);}
    if(mode==='build'&&data.steps){
      var summary='## Build Complete\\n';
      data.steps.forEach(function(s,i){summary+='**'+s.provider+'** ('+s.role+'): '+(s.output?s.output.length+' chars':'done')+'\\n';});
      summary+='\\n---\\n'+data.final;
      messages.push({role:'assistant',content:summary});
    }else{
      messages.push({role:'assistant',content:data.content||data.error||'Error'});
    }
    setStatus('Ready','');
  }catch(e){messages.push({role:'assistant',content:'Error: '+e.message});setStatus('Error','error');}
  loading=false;sendBtn.disabled=false;render();
}

sendBtn.onclick=send;
inputEl.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
loadContext();render();
})();
</script>
</body>
</html>`;
