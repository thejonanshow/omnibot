export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // WebSocket upgrade for real-time chat
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      
      server.addEventListener('message', async (event) => {
        try {
          const { messages } = JSON.parse(event.data);
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 2048 })
          });
          const data = await groqRes.json();
          server.send(JSON.stringify({ content: data.choices?.[0]?.message?.content || data.error?.message }));
        } catch (e) {
          server.send(JSON.stringify({ error: e.message }));
        }
      });
      
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/' || url.pathname === '/chat') {
      return new Response(CHAT_HTML, { headers: { 'Content-Type': 'text/html' } });
    }
    
    if (url.pathname === '/api/jsonp') {
      const callback = url.searchParams.get('cb') || 'cb';
      const msg = url.searchParams.get('m');
      try {
        const messages = JSON.parse(decodeURIComponent(msg));
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 2048 })
        });
        const data = await groqRes.json();
        return new Response(`${callback}(${JSON.stringify({ content: data.choices?.[0]?.message?.content })})`, {
          headers: { 'Content-Type': 'application/javascript' }
        });
      } catch (e) {
        return new Response(`${callback}(${JSON.stringify({ error: e.message })})`, {
          headers: { 'Content-Type': 'application/javascript' }
        });
      }
    }
    
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { messages } = await request.json();
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 2048 })
        });
        const data = await groqRes.json();
        return new Response(JSON.stringify({ content: data.choices[0].message.content }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response('OmniBot', { headers: corsHeaders });
  }
};

const CHAT_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OmniChat</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;background:#0a0a12;color:#e0e0e0;height:100vh;display:flex;flex-direction:column}.h{padding:12px 16px;border-bottom:1px solid #333;background:#111;display:flex;align-items:center;gap:8px}.st{margin-left:auto;font-size:11px;color:#0f0;background:#0f01;padding:4px 10px;border-radius:12px}.ms{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}.m{max-width:85%;padding:12px 16px;border-radius:16px;white-space:pre-wrap}.m.u{align-self:flex-end;background:#2563eb}.m.a{align-self:flex-start;background:#1e1e2e;border:1px solid #333}.inp{padding:12px;border-top:1px solid #333;background:#111;display:flex;gap:8px}#i{flex:1;padding:14px;border-radius:12px;border:1px solid #333;background:#0a0a12;color:#fff;font-size:16px;outline:none}#s{padding:14px 24px;border-radius:12px;border:none;background:#2563eb;color:#fff;font-weight:600;cursor:pointer}#s:disabled{opacity:.4}</style></head>
<body><div class="h"><span style="font-size:20px">⚡</span><b>OMNICHAT</b><span class="st" id="st">llama-3.3-70b</span></div>
<div class="ms" id="ms"></div><div class="inp"><input id="i" placeholder="Message..."><button id="s">Send</button></div>
<script>const M=[],ms=document.getElementById('ms'),i=document.getElementById('i'),s=document.getElementById('s'),st=document.getElementById('st');let L=0;
function r(){ms.innerHTML=M.length?M.map(m=>'<div class="m '+(m.r==='user'?'u':'a')+'">'+m.c.replace(/</g,'&lt;')+'</div>').join('')+(L?'<div class="m a" style="color:#888">⚡ thinking...</div>'):'<div style="text-align:center;color:#555;margin:auto"><div style="font-size:48px;margin-bottom:16px">⚡</div>Groq chat</div>';ms.scrollTop=ms.scrollHeight}
async function send(){const t=i.value.trim();if(!t||L)return;M.push({r:'user',c:t});i.value='';L=1;s.disabled=1;st.textContent='thinking...';r();
try{const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:M.map(m=>({role:m.r,content:m.c}))})});const d=await res.json();M.push({r:'assistant',c:d.content||d.error});st.textContent='llama-3.3-70b'}catch(e){M.push({r:'assistant',c:'Error: '+e.message});st.textContent='error'}L=0;s.disabled=0;r()}
s.onclick=send;i.onkeydown=e=>{if(e.key==='Enter')send()};r()</script></body></html>`;
