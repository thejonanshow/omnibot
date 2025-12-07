/**
 * OmniBot Multi-AI Orchestrator
 * 
 * Pipeline:
 * 1. Gemini - Architecture & high-level design
 * 2. Groq orchestrates 5 parallel Qwen instances - Implementation
 * 3. OpenAI GPT - Review & improvements  
 * 4. Gemini - Final review
 * 5. Claude - Polish & tidy
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
    model: 'claude-3-5-sonnet-20241022',
    format: 'anthropic'
  }
};

async function callProvider(provider, messages, env, systemPrompt = null) {
  const config = PROVIDERS[provider];
  const fullMessages = systemPrompt 
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || data.error?.message || 'Gemini error';
  }

  if (config.format === 'openai') {
    const key = provider.startsWith('groq') ? env.GROQ_API_KEY : env.OPENAI_API_KEY;
    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages: fullMessages, max_tokens: 4096 })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || data.error?.message || 'OpenAI-format error';
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
        max_tokens: 4096,
        system: systemPrompt || 'You are a helpful assistant.',
        messages: messages
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || data.error?.message || 'Claude error';
  }
}

async function runPipeline(task, env, statusCallback) {
  const results = { steps: [], final: null };
  
  // Step 1: Gemini - Architecture
  statusCallback('Step 1/5: Gemini designing architecture...');
  const archPrompt = `You are an expert software architect. Given this task, provide a clear technical architecture and component breakdown. Be specific about files, functions, and data flow. Task: ${task}`;
  const architecture = await callProvider('gemini', [{ role: 'user', content: task }], env, archPrompt);
  results.steps.push({ provider: 'Gemini', role: 'Architecture', output: architecture });

  // Step 2: 5 parallel Qwen instances for implementation
  statusCallback('Step 2/5: 5 Qwen instances implementing in parallel...');
  const qwenPrompts = [
    'Implement the core logic and main functions.',
    'Implement error handling and edge cases.',
    'Implement the UI/interface components.',
    'Implement data validation and security.',
    'Implement tests and documentation.'
  ];
  
  const qwenResults = await Promise.all(qwenPrompts.map((focus, i) => 
    callProvider('groq_qwen', [{ role: 'user', content: `Architecture:\n${architecture}\n\nYour focus: ${focus}\n\nProvide complete, working code for your part.` }], env,
      `You are Qwen instance ${i+1}/5. Your specific focus: ${focus}. Write production-ready code.`
    )
  ));
  
  results.steps.push({ provider: 'Qwen x5', role: 'Implementation', outputs: qwenResults });

  // Step 3: Groq Llama - Combine implementations
  statusCallback('Step 3/5: Llama combining implementations...');
  const combinePrompt = `You are a senior engineer. Combine these 5 implementations into one coherent, working codebase. Resolve conflicts, remove duplication, ensure consistency.

Architecture: ${architecture}

Implementation 1 (Core): ${qwenResults[0]}

Implementation 2 (Error handling): ${qwenResults[1]}

Implementation 3 (UI): ${qwenResults[2]}

Implementation 4 (Security): ${qwenResults[3]}

Implementation 5 (Tests): ${qwenResults[4]}

Output the final combined code:`;
  
  const combined = await callProvider('groq_llama', [{ role: 'user', content: combinePrompt }], env);
  results.steps.push({ provider: 'Llama', role: 'Combiner', output: combined });

  // Step 4: OpenAI - Review
  statusCallback('Step 4/5: GPT reviewing and improving...');
  const reviewPrompt = `Review this code for bugs, improvements, and best practices. Output an improved version:\n\n${combined}`;
  const reviewed = await callProvider('openai', [{ role: 'user', content: reviewPrompt }], env,
    'You are a code reviewer. Fix bugs, improve code quality, add missing error handling.');
  results.steps.push({ provider: 'GPT', role: 'Reviewer', output: reviewed });

  // Step 5: Claude - Final polish
  statusCallback('Step 5/5: Claude polishing final output...');
  const polishPrompt = `Polish this code. Ensure consistent style, clear comments, proper formatting. Make it production-ready:\n\n${reviewed}`;
  const final = await callProvider('claude', [{ role: 'user', content: polishPrompt }], env,
    'You are an expert at code quality. Polish the code to be clean, readable, and maintainable.');
  results.steps.push({ provider: 'Claude', role: 'Polish', output: final });

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
    
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    // Simple chat endpoint (single provider)
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages, provider = 'groq_llama' } = await request.json();
        const response = await callProvider(provider, messages, env);
        return new Response(JSON.stringify({ content: response }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Full pipeline endpoint
    if (url.pathname === '/api/build' && request.method === 'POST') {
      try {
        const { task } = await request.json();
        const results = await runPipeline(task, env, () => {});
        return new Response(JSON.stringify(results), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('OmniBot Orchestrator API\n\nPOST /api/chat - Single AI chat\nPOST /api/build - Full multi-AI pipeline', { headers: cors });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>OmniBot Orchestrator</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:-apple-system,system-ui,sans-serif;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column}
.header{padding:14px 16px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.header h1{font-size:17px;font-weight:600}
.mode-toggle{display:flex;gap:4px;margin-left:auto}
.mode-btn{padding:6px 12px;border-radius:8px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:12px;cursor:pointer}
.mode-btn.active{background:#238636;border-color:#238636;color:#fff}
.status{font-size:11px;padding:5px 10px;border-radius:12px;background:#238636;color:#fff}
.status.loading{background:#9e6a03}
.status.error{background:#da3633}
.pipeline{display:none;padding:8px 16px;background:#161b22;border-bottom:1px solid #30363d;font-size:12px;color:#8b949e}
.pipeline.show{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pipeline-step{padding:4px 8px;border-radius:6px;background:#21262d;border:1px solid #30363d}
.pipeline-step.active{background:#9e6a03;border-color:#9e6a03;color:#fff}
.pipeline-step.done{background:#238636;border-color:#238636;color:#fff}
.messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.placeholder{margin:auto;text-align:center;color:#484f58}
.msg{max-width:90%;padding:12px 16px;border-radius:18px;line-height:1.5;word-wrap:break-word;white-space:pre-wrap;font-size:14px}
.msg-user{align-self:flex-end;background:#238636;border-radius:18px 18px 4px 18px}
.msg-bot{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:18px 18px 18px 4px}
.msg-bot pre{background:#161b22;padding:8px;border-radius:6px;overflow-x:auto;margin:8px 0}
.msg-bot code{font-family:monospace;font-size:13px}
.input-area{padding:12px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:10px}
.input-area textarea{flex:1;padding:12px 16px;border-radius:12px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:16px;outline:none;resize:none;min-height:48px;max-height:120px;font-family:inherit}
.input-area button{padding:12px 20px;border-radius:12px;border:none;background:#238636;color:#fff;font-weight:600;font-size:15px;cursor:pointer;align-self:flex-end}
.input-area button:disabled{background:#21262d;color:#484f58}
</style>
</head>
<body>
<div class="header">
<span style="font-size:22px">🤖</span>
<h1>OmniBot Orchestrator</h1>
<div class="mode-toggle">
<button class="mode-btn active" data-mode="chat">Chat</button>
<button class="mode-btn" data-mode="build">Build</button>
</div>
<div class="status" id="status">Ready</div>
</div>
<div class="pipeline" id="pipeline">
<span>Pipeline:</span>
<span class="pipeline-step" data-step="1">Gemini</span>
<span class="pipeline-step" data-step="2">Qwen x5</span>
<span class="pipeline-step" data-step="3">Llama</span>
<span class="pipeline-step" data-step="4">GPT</span>
<span class="pipeline-step" data-step="5">Claude</span>
</div>
<div class="messages" id="messages">
<div class="placeholder">
<div style="font-size:52px;margin-bottom:12px">🤖</div>
<div style="font-size:16px;margin-bottom:8px">OmniBot Orchestrator</div>
<div style="font-size:13px;color:#6e7681">Chat mode: Talk to Llama 3.3<br>Build mode: Full AI pipeline (Gemini → 5x Qwen → Llama → GPT → Claude)</div>
</div>
</div>
<div class="input-area">
<textarea id="input" placeholder="Describe what you want to build..." rows="1"></textarea>
<button id="send">Send</button>
</div>
<script>
(function() {
  var mode = 'chat';
  var messages = [];
  var loading = false;
  var messagesEl = document.getElementById('messages');
  var inputEl = document.getElementById('input');
  var sendBtn = document.getElementById('send');
  var statusEl = document.getElementById('status');
  var pipelineEl = document.getElementById('pipeline');
  var modeButtons = document.querySelectorAll('.mode-btn');

  modeButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      mode = btn.dataset.mode;
      modeButtons.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      pipelineEl.classList.toggle('show', mode === 'build');
      inputEl.placeholder = mode === 'build' ? 'Describe what you want to build...' : 'Message...';
    });
  });

  function render() {
    if (!messages.length) {
      messagesEl.innerHTML = '<div class="placeholder"><div style="font-size:52px;margin-bottom:12px">🤖</div><div style="font-size:16px;margin-bottom:8px">OmniBot Orchestrator</div><div style="font-size:13px;color:#6e7681">Chat: Llama 3.3 | Build: Gemini → 5x Qwen → Llama → GPT → Claude</div></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var cls = m.role === 'user' ? 'msg-user' : 'msg-bot';
      var text = m.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      text = text.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>');
      html += '<div class="msg ' + cls + '">' + text + '</div>';
    }
    if (loading) {
      html += '<div class="msg msg-bot" style="color:#8b949e">🤖 ' + (mode === 'build' ? 'Running pipeline...' : 'Thinking...') + '</div>';
    }
    messagesEl.innerHTML = html;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function setPipelineStep(step) {
    document.querySelectorAll('.pipeline-step').forEach(function(el) {
      var s = parseInt(el.dataset.step);
      el.classList.remove('active', 'done');
      if (s < step) el.classList.add('done');
      if (s === step) el.classList.add('active');
    });
  }

  async function send() {
    var text = inputEl.value.trim();
    if (!text || loading) return;

    messages.push({ role: 'user', content: text });
    inputEl.value = '';
    loading = true;
    sendBtn.disabled = true;
    setStatus(mode === 'build' ? 'Building...' : 'Thinking...', 'loading');
    render();

    try {
      if (mode === 'build') {
        setPipelineStep(1);
        var res = await fetch('/api/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: text })
        });
        var data = await res.json();
        setPipelineStep(6);
        
        var summary = '## Build Complete\\n\\n';
        if (data.steps) {
          data.steps.forEach(function(s, i) {
            summary += '### Step ' + (i+1) + ': ' + s.provider + ' (' + s.role + ')\\n';
            if (s.outputs) {
              summary += s.outputs.length + ' parallel outputs generated\\n\\n';
            } else {
              summary += (s.output || '').substring(0, 200) + '...\\n\\n';
            }
          });
        }
        summary += '### Final Output:\\n' + (data.final || data.error || 'No output');
        messages.push({ role: 'assistant', content: summary });
      } else {
        var apiMessages = messages.map(function(m) { return { role: m.role, content: m.content }; });
        var res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages })
        });
        var data = await res.json();
        messages.push({ role: 'assistant', content: data.content || data.error || 'Error' });
      }
      setStatus('Ready', '');
    } catch (err) {
      messages.push({ role: 'assistant', content: 'Error: ' + err.message });
      setStatus('Error', 'error');
    }

    loading = false;
    sendBtn.disabled = false;
    render();
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  inputEl.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  render();
})();
</script>
</body>
</html>`;
