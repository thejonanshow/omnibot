export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    
    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const messages = body.messages || [];
        
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.GROQ_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: messages,
            max_tokens: 2048
          })
        });
        
        const data = await groqRes.json();
        
        if (data.error) {
          return new Response(JSON.stringify({ error: data.error.message }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        
        const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        return new Response(JSON.stringify({ content: content || 'No response' }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('OmniBot API', { headers: cors });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>OmniChat</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:-apple-system,system-ui,sans-serif;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column}
.header{padding:14px 16px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:10px}
.header h1{font-size:17px;font-weight:600}
.status{margin-left:auto;font-size:11px;padding:5px 10px;border-radius:12px;background:#238636;color:#fff}
.status.loading{background:#9e6a03}
.status.error{background:#da3633}
.messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.placeholder{margin:auto;text-align:center;color:#484f58}
.placeholder-icon{font-size:52px;margin-bottom:12px}
.msg{max-width:85%;padding:12px 16px;border-radius:18px;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}
.msg-user{align-self:flex-end;background:#238636;border-radius:18px 18px 4px 18px}
.msg-bot{align-self:flex-start;background:#21262d;border:1px solid #30363d;border-radius:18px 18px 18px 4px}
.msg-loading{color:#8b949e}
.input-area{padding:12px;background:#161b22;border-top:1px solid #30363d;display:flex;gap:10px}
.input-area input{flex:1;padding:12px 16px;border-radius:12px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:16px;outline:none}
.input-area input:focus{border-color:#238636}
.input-area button{padding:12px 20px;border-radius:12px;border:none;background:#238636;color:#fff;font-weight:600;font-size:15px;cursor:pointer}
.input-area button:disabled{background:#21262d;color:#484f58}
</style>
</head>
<body>
<div class="header">
<span style="font-size:22px">⚡</span>
<h1>OmniChat</h1>
<div class="status" id="status">Ready</div>
</div>
<div class="messages" id="messages">
<div class="placeholder">
<div class="placeholder-icon">⚡</div>
<div>Groq-powered AI chat</div>
<div style="font-size:13px;margin-top:6px;color:#6e7681">Llama 3.3 70B</div>
</div>
</div>
<div class="input-area">
<input type="text" id="input" placeholder="Type a message..." autocomplete="off">
<button id="send">Send</button>
</div>
<script>
(function() {
  var messages = [];
  var loading = false;
  var messagesEl = document.getElementById('messages');
  var inputEl = document.getElementById('input');
  var sendBtn = document.getElementById('send');
  var statusEl = document.getElementById('status');

  function render() {
    var html = '';
    if (messages.length === 0) {
      html = '<div class="placeholder"><div class="placeholder-icon">⚡</div><div>Groq-powered AI chat</div><div style="font-size:13px;margin-top:6px;color:#6e7681">Llama 3.3 70B</div></div>';
    } else {
      for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        var cls = m.role === 'user' ? 'msg-user' : 'msg-bot';
        var text = m.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        html += '<div class="msg ' + cls + '">' + text + '</div>';
      }
      if (loading) {
        html += '<div class="msg msg-bot msg-loading">⚡ Thinking...</div>';
      }
    }
    messagesEl.innerHTML = html;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function send() {
    var text = inputEl.value.trim();
    if (!text || loading) return;

    messages.push({ role: 'user', content: text });
    inputEl.value = '';
    loading = true;
    sendBtn.disabled = true;
    setStatus('Thinking...', 'loading');
    render();

    var apiMessages = [];
    for (var i = 0; i < messages.length; i++) {
      apiMessages.push({ role: messages[i].role, content: messages[i].content });
    }

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var reply = data.content || data.error || 'No response';
      messages.push({ role: 'assistant', content: reply });
      setStatus('Ready', '');
    })
    .catch(function(err) {
      messages.push({ role: 'assistant', content: 'Error: ' + err.message });
      setStatus('Error', 'error');
    })
    .finally(function() {
      loading = false;
      sendBtn.disabled = false;
      render();
    });
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') send();
  });

  render();
})();
</script>
</body>
</html>`;
