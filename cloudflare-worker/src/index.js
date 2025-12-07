/**
 * OmniBot Worker - Email commits + Groq Chat UI
 * 
 * Endpoints:
 * - GET /chat - Groq-powered chat UI
 * - POST /api/chat - Groq API proxy
 * - POST / - Email-to-GitHub commits
 */

const CHAT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OmniChat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      color: #e0e0e0;
      height: 100vh;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .header {
      padding: 12px 16px;
      border-bottom: 1px solid #333;
      background: rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .header h1 { font-size: 16px; font-weight: 600; letter-spacing: 0.5px; }
    .status {
      margin-left: auto;
      font-size: 11px;
      color: #0f0;
      background: rgba(0,0,0,0.5);
      padding: 4px 10px;
      border-radius: 12px;
      font-family: monospace;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      -webkit-overflow-scrolling: touch;
    }
    .empty {
      text-align: center;
      color: #555;
      margin-top: 60px;
    }
    .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
    .msg {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      white-space: pre-wrap;
      line-height: 1.5;
      font-size: 15px;
      word-break: break-word;
    }
    .msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      border-radius: 16px 16px 4px 16px;
    }
    .msg.assistant {
      align-self: flex-start;
      background: rgba(255,255,255,0.05);
      border: 1px solid #333;
      border-radius: 16px 16px 16px 4px;
    }
    .msg.loading { color: #888; }
    .input-area {
      padding: 12px;
      padding-bottom: max(12px, env(safe-area-inset-bottom));
      border-top: 1px solid #333;
      background: rgba(0,0,0,0.3);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    #input {
      flex: 1;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid #333;
      background: rgba(0,0,0,0.4);
      color: #fff;
      font-size: 16px;
      outline: none;
      -webkit-appearance: none;
    }
    #input:focus { border-color: #3b82f6; }
    #send {
      padding: 14px 20px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      font-size: 15px;
      -webkit-appearance: none;
    }
    #send:disabled { background: #333; cursor: default; }
    #send:active:not(:disabled) { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="header">
    <span style="font-size:20px">⚡</span>
    <h1>OMNICHAT</h1>
    <span class="status" id="status">● llama-3.3-70b</span>
  </div>
  <div class="messages" id="messages">
    <div class="empty">
      <div class="empty-icon">⚡</div>
      <div>Groq-powered chat</div>
      <div style="font-size:12px;margin-top:8px;color:#444">Zero Claude credits</div>
    </div>
  </div>
  <div class="input-area">
    <input type="text" id="input" placeholder="Message..." autocomplete="off">
    <button id="send">Send</button>
  </div>
  <script>
    const messages = [];
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const statusEl = document.getElementById('status');
    let loading = false;

    function render() {
      if (messages.length === 0) {
        messagesEl.innerHTML = '<div class="empty"><div class="empty-icon">⚡</div><div>Groq-powered chat</div><div style="font-size:12px;margin-top:8px;color:#444">Zero Claude credits</div></div>';
        return;
      }
      messagesEl.innerHTML = messages.map(m => 
        '<div class="msg ' + m.role + '">' + escapeHtml(m.content) + '</div>'
      ).join('') + (loading ? '<div class="msg assistant loading">⚡ thinking...</div>' : '');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function escapeHtml(text) {
      return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    async function send() {
      const text = inputEl.value.trim();
      if (!text || loading) return;
      
      messages.push({ role: 'user', content: text });
      inputEl.value = '';
      loading = true;
      sendBtn.disabled = true;
      statusEl.textContent = 'thinking...';
      statusEl.style.color = '#ff0';
      render();

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages })
        });
        const data = await res.json();
        if (data.error) {
          messages.push({ role: 'assistant', content: 'Error: ' + data.error });
        } else {
          messages.push({ role: 'assistant', content: data.content });
        }
        statusEl.textContent = '● llama-3.3-70b';
        statusEl.style.color = '#0f0';
      } catch (e) {
        messages.push({ role: 'assistant', content: 'Network error: ' + e.message });
        statusEl.textContent = '● offline';
        statusEl.style.color = '#f00';
      }
      
      loading = false;
      sendBtn.disabled = false;
      render();
      inputEl.focus();
    }

    sendBtn.onclick = send;
    inputEl.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) send(); };
  </script>
</body>
</html>`;


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Serve chat UI
    if (url.pathname === '/chat' || url.pathname === '/chat/') {
      return new Response(CHAT_HTML, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }
    
    // Groq API endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages } = await request.json();
        
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            max_tokens: 2048
          })
        });
        
        const data = await groqRes.json();
        
        if (data.error) {
          return new Response(JSON.stringify({ error: data.error.message }), { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ content: data.choices[0].message.content }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Email commit endpoint
    if (request.method === 'POST' && (url.pathname === '/' || url.pathname === '')) {
      return handleEmailCommit(request, env);
    }
    
    // Health/info endpoint
    return new Response('OmniBot API\\n\\nGET /chat - Groq Chat UI\\nPOST /api/chat - Groq API\\nPOST / - Email commits', { 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
};

async function handleEmailCommit(request, env) {
  try {
    const body = await request.json();
    const { subject, text } = body;

    const commitRequest = parseEmailCommit(subject, text);
    
    if (!commitRequest) {
      await logToGist(env.GITHUB_TOKEN, {
        timestamp: new Date().toISOString(),
        status: "error",
        error: "Invalid email format",
        subject,
        text_preview: text?.substring(0, 100)
      });
      return new Response("Invalid email format", { status: 400 });
    }

    const result = await commitToGitHub(commitRequest, env.GITHUB_TOKEN);

    await logToGist(env.GITHUB_TOKEN, {
      timestamp: new Date().toISOString(),
      status: "success",
      repository: commitRequest.repo,
      branch: commitRequest.branch,
      files: commitRequest.files.map(f => f.path),
      commit_sha: result.commit.sha
    });

    return new Response(JSON.stringify({ success: true, commit: result.commit }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    await logToGist(env.GITHUB_TOKEN, {
      timestamp: new Date().toISOString(),
      status: "error",
      error: error.message
    });
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

function parseEmailCommit(subject, text) {
  if (!text) return null;
  
  const repoMatch = text.match(/Repository:\s*([^\n]+)/i);
  const branchMatch = text.match(/Branch:\s*([^\n]+)/i);
  const fileMatch = text.match(/File:\s*([^\n]+)/i);
  const messageMatch = text.match(/Commit Message:\s*([^\n]+)/i);
  const contentMatch = text.match(/---\s*FILE CONTENT START\s*---\n([\s\S]*?)\n---\s*FILE CONTENT END\s*---/i);
  
  if (!repoMatch || !fileMatch || !contentMatch) return null;
  
  return {
    repo: repoMatch[1].trim(),
    branch: branchMatch ? branchMatch[1].trim() : 'main',
    message: messageMatch ? messageMatch[1].trim() : 'Update via OmniBot',
    files: [{ path: fileMatch[1].trim(), content: contentMatch[1] }]
  };
}

async function commitToGitHub(commitRequest, token) {
  const { repo, branch, message, files } = commitRequest;
  const [owner, repoName] = repo.includes('/') ? repo.split('/') : ['thejonanshow', repo];
  
  for (const file of files) {
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${file.path}?ref=${branch}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    
    const existingFile = getRes.ok ? await getRes.json() : null;
    const content = btoa(unescape(encodeURIComponent(file.content)));
    
    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${file.path}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content,
        branch,
        sha: existingFile?.sha
      })
    });
    
    if (!putRes.ok) throw new Error(`GitHub API error: ${await putRes.text()}`);
    return await putRes.json();
  }
}

async function logToGist(token, entry) {
  const gistId = '625dc743af3e24b82467339bf19589f2';
  try {
    const getRes = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const gist = await getRes.json();
    const existing = JSON.parse(gist.files['omnibot-log.json']?.content || '[]');
    existing.unshift(entry);
    const updated = existing.slice(0, 50);
    
    await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { 'omnibot-log.json': { content: JSON.stringify(updated, null, 2) } } })
    });
  } catch (e) { console.error('Gist log failed:', e); }
}
