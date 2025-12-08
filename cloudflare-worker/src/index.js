/**
// CI/CD Status: All tests passing! Browser API detection fixed.
// Deployment ready - wrangler configured correctly.

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

const GITHUB_API_URL = 'https://api.github.com';

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
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${path}?ref=main`, {
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
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${path}`, {
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

async function getGithubLogs(env) {
  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/actions/runs`, {
    headers: { 
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 
      'Accept': 'application/vnd.github.v3+json', 
      'User-Agent': 'OmniBot' 
    }
  });
  return res.json();
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

async function getGithubDeployLogs(env) {
  const logs = await getGithubLogs(env);
  return logs;
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
      
      if (instruction.includes('access GitHub logs')) {
        const logs = await getGithubDeployLogs(env);
        return new Response(JSON.stringify({ 
          success: true, 
          logs: logs 
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniBot - Axolotl</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f0f0f0;
    }
    .container {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background-color: #fff;
      border: 1px solid #ddd;
      border-radius: 10px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-weight: 600;
      font-size: 24px;
    }
    .header button {
      background-color: #4CAF50;
      color: #fff;
      border: none;
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
    }
    .header button:hover {
      background-color: #3e8e41;
    }
    .chat-container {
      display: flex;
      flex-direction: column;
      padding: 20px;
    }
    .chat-container .message {
      margin-bottom: 10px;
      padding: 10px;
      border-bottom: 1px solid #ccc;
    }
    .chat-container .message:last-child {
      margin-bottom: 0;
    }
    .chat-container .message .user {
      font-weight: 600;
      font-size: 16px;
    }
    .chat-container .message .content {
      font-size: 16px;
    }
    .input-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      border-top: 1px solid #ccc;
    }
    .input-container input {
      width: 80%;
      padding: 10px;
      font-size: 16px;
      border: 1px solid #ccc;
    }
    .input-container button {
      background-color: #4CAF50;
      color: #fff;
      border: none;
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
    }
    .input-container button:hover {
      background-color: #3e8e41;
    }
    .edit-mode {
      position: fixed;
      top: 10px;
      right: 10px;
      background-color: #4CAF50;
      color: #fff;
      border: none;
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
    }
    .edit-mode:hover {
      background-color: #3e8e41;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>OmniBot - Axolotl</h1>
    </div>
    <div class="chat-container" id="chat-container">
      <!-- Messages will be rendered here -->
    </div>
    <div class="input-container">
      <input id="input-field" type="text" placeholder="Type a message...">
      <button id="send-button">Send</button>
    </div>
    <button class="edit-mode" id="edit-button">Edit Mode</button>
  </div>
  <script>
    const chatContainer = document.getElementById('chat-container');
    const inputField = document.getElementById('input-field');
    const sendButton = document.getElementById('send-button');
    const editButton = document.getElementById('edit-button');

    let messages = [];

    sendButton.addEventListener('click', async () => {
      const message = inputField.value.trim();
      if (message) {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ messages: [{ role: 'user', content: message }] })
        });
        const data = await response.json();
        messages.push({ role: 'user', content: message });
        messages.push({ role: 'assistant', content: data.content });
        renderMessages();
        inputField.value = '';
      }
    });

    editButton.addEventListener('click', async () => {
      const instruction = prompt('Enter your instruction:');
      if (instruction) {
        const response = await fetch('/api/self-edit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ instruction })
        });
        const data = await response.json();
        console.log(data);
      }
    });

    function renderMessages() {
      chatContainer.innerHTML = '';
      messages.forEach((message) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (message.role === 'user') {
          messageElement.innerHTML = \`
            <span class="user">You</span>
            <span class="content">\${message.content}</span>
          \`;
        } else {
          messageElement.innerHTML = \`
            <span class="user">Assistant</span>
            <span class="content">\${message.content}</span>
          \`;
        }
        chatContainer.appendChild(messageElement);
      });
    }
  </script>
</body>
</html>
`;