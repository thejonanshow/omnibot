/**
 * UI module for OmniBot
 * Handles HTML UI generation and rendering
 */

/* eslint-disable no-undef */

import { VERSION_FULL } from './config.js';

// Cache for compiled themes
const themeCache = new Map();

/**
 * Render the main UI
 */
export function renderUI(sessionToken = null) {
  const currentTheme = 'lcars'; // Default theme
  
  // Use cached theme if available
  if (!themeCache.has(currentTheme)) {
    const themes = getThemes();
    themeCache.set(currentTheme, themes[currentTheme]);
  }
  
  const themeCSS = themeCache.get(currentTheme);
  
  // eslint-disable-next-line no-undef
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="//api.groq.com">
    <link rel="preconnect" href="//generativelanguage.googleapis.com">
    <link rel="dns-prefetch" href="//api.groq.com">
    <link rel="dns-prefetch" href="//generativelanguage.googleapis.com">
    <link rel="preload" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>" as="image">
    <title>OmniBot - ${VERSION_FULL}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>">
    <style>
        ${themeCSS}
        
        /* Base styles */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Courier New', monospace;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            overflow-x: hidden;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* Header */
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: var(--bg-secondary);
            border-radius: 10px;
            border: 1px solid var(--border-color);
        }
        
        .title {
            font-size: 2.5em;
            margin-bottom: 10px;
            color: var(--accent-primary);
            text-shadow: 0 0 10px var(--accent-primary);
        }
        
        .subtitle {
            font-size: 1.2em;
            color: var(--text-secondary);
            margin-bottom: 20px;
        }
        
        /* Auth section */
        .auth-section {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .auth-button {
            background: var(--accent-primary);
            color: var(--bg-primary);
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            font-size: 1.1em;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .auth-button:hover {
            background: var(--accent-secondary);
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        
        /* Chat interface */
        .chat-container {
            background: var(--bg-secondary);
            border-radius: 10px;
            border: 1px solid var(--border-color);
            margin-bottom: 20px;
            overflow: hidden;
        }
        
        .chat-messages {
            height: 400px;
            overflow-y: auto;
            padding: 20px;
            background: var(--bg-primary);
        }
        
        .message {
            margin-bottom: 15px;
            padding: 10px 15px;
            border-radius: 5px;
            max-width: 80%;
        }
        
        .message.user {
            background: var(--user-message-bg);
            margin-left: auto;
            text-align: right;
        }
        
        .message.assistant {
            background: var(--assistant-message-bg);
            margin-right: auto;
        }
        
        .message.system {
            background: var(--system-message-bg);
            text-align: center;
            margin: 0 auto;
            max-width: 90%;
        }
        
        .message.error {
            background: var(--error-bg);
            color: var(--error-text);
            margin: 0 auto;
            max-width: 90%;
        }
        
        /* Input area */
        .chat-input {
            display: flex;
            padding: 20px;
            background: var(--bg-secondary);
            border-top: 1px solid var(--border-color);
        }
        
        .chat-input input {
            flex: 1;
            background: var(--bg-primary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            padding: 12px;
            border-radius: 5px;
            font-size: 1em;
            margin-right: 10px;
        }
        
        .chat-input button {
            background: var(--accent-primary);
            color: var(--bg-primary);
            border: none;
            padding: 12px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            transition: all 0.3s ease;
        }
        
        .chat-input button:hover:not(:disabled) {
            background: var(--accent-secondary);
        }
        
        .chat-input button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        /* Status bar */
        .status-bar {
            background: var(--bg-secondary);
            border-radius: 10px;
            border: 1px solid var(--border-color);
            padding: 15px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            margin: 5px 10px;
        }
        
        .status-indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .status-indicator.online {
            background: #4CAF50;
            box-shadow: 0 0 5px #4CAF50;
        }
        
        .status-indicator.offline {
            background: #f44336;
            box-shadow: 0 0 5px #f44336;
        }
        
        /* Controls */
        .controls {
            background: var(--bg-secondary);
            border-radius: 10px;
            border: 1px solid var(--border-color);
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .control-group {
            margin-bottom: 15px;
        }
        
        .control-group label {
            display: block;
            margin-bottom: 5px;
            color: var(--text-secondary);
        }
        
        .control-group input,
        .control-group select,
        .control-group textarea {
            width: 100%;
            background: var(--bg-primary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            padding: 10px;
            border-radius: 5px;
            font-family: inherit;
        }
        
        .control-group textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        /* Buttons */
        .button {
            background: var(--accent-primary);
            color: var(--bg-primary);
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            transition: all 0.3s ease;
            margin: 5px;
        }
        
        .button:hover:not(:disabled) {
            background: var(--accent-secondary);
            transform: translateY(-1px);
        }
        
        .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .button.secondary {
            background: var(--bg-primary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
        }
        
        .button.secondary:hover:not(:disabled) {
            background: var(--bg-secondary);
        }
        
        /* Modal */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.8);
        }
        
        .modal-content {
            background: var(--bg-secondary);
            margin: 5% auto;
            padding: 20px;
            border: 1px solid var(--border-color);
            border-radius: 10px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .close {
            color: var(--text-secondary);
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .close:hover {
            color: var(--text-primary);
        }
        
        /* Loading */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid var(--border-color);
            border-radius: 50%;
            border-top-color: var(--accent-primary);
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .title {
                font-size: 2em;
            }
            
            .chat-messages {
                height: 300px;
            }
            
            .message {
                max-width: 95%;
            }
            
            .status-bar {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .chat-input {
                flex-direction: column;
            }
            
            .chat-input input {
                margin-right: 0;
                margin-bottom: 10px;
            }
        }
        
        /* Animations */
        .fade-in {
            animation: fadeIn 0.5s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .pulse {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">OmniBot</h1>
            <p class="subtitle">${VERSION_FULL} - Self-editing AI Assistant</p>
            ${sessionToken ? '<p class="status">✅ Authenticated</p>' : '<p class="status">🔒 Authentication Required</p>'}
        </div>
        
        ${sessionToken ? `
        <div class="status-bar">
            <div class="status-item">
                <div class="status-indicator online" loading="lazy"></div>
                <span>System Online</span>
            </div>
            <div class="status-item">
                <span id="provider-status">Provider: Ready</span>
            </div>
            <div class="status-item">
                <span id="usage-status">Usage: Loading...</span>
            </div>
        </div>
        
        <div class="controls">
            <div class="control-group">
                <label for="edit-instruction">Self-Edit Instruction:</label>
                <textarea id="edit-instruction" placeholder="Describe the code changes you want to make..."></textarea>
            </div>
            <div class="control-group">
                <button class="button" onclick="executeEdit()">Execute Self-Edit</button>
                <button class="button secondary" onclick="showPromptModal()">Edit Master Prompt</button>
                <button class="button secondary" onclick="clearChat()">Clear Chat</button>
            </div>
        </div>
        
        <div class="chat-container">
            <div class="chat-messages" id="chat-messages"></div>
            <div class="chat-input">
                <input type="text" id="chat-input" placeholder="Ask me anything..." onkeypress="handleChatKeypress(event)">
                <button onclick="sendMessage()">Send</button>
            </div>
        </div>
        ` : `
        <div class="auth-section">
            <p>Please authenticate to access OmniBot features</p>
            <a href="/auth/google" class="auth-button">Sign in with Google</a>
        </div>
        `}
    </div>
    
    <!-- Prompt Modal -->
    <div id="promptModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Master Prompt</h2>
                <span class="close" onclick="closeModal('promptModal')">&times;</span>
            </div>
            <div class="control-group">
                <label for="masterPrompt">Master Prompt:</label>
                <textarea id="masterPrompt" rows="10"></textarea>
            </div>
            <button class="button" onclick="savePrompt()">Save Prompt</button>
        </div>
    </div>
    
    <script>
        let conversation = [];
        let sendMessageDebounce = null;
        let isProcessing = false;
        
        // Initialize
        // eslint-disable-next-line no-undef
        document.addEventListener('DOMContentLoaded', function() {
            // eslint-disable-next-line no-undef
            if (${
        // Cleanup function for memory management
        function cleanup() {
          // Clear any intervals
          const intervals = window._omnibotIntervals || [];
          intervals.forEach(id => clearInterval(id));
          
          // Remove event listeners
          const listeners = window._omnibotListeners || [];
          listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
          });
          
          // Clear global references
          if (window._omnibotGlobals) {
            window._omnibotGlobals.forEach(key => {
              delete window[key];
            });
          }
        }
        
        // Register cleanup on page unload
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line no-undef
        window.addEventListener('beforeunload', cleanup);
        
        // Register cleanup on visibility change
        // eslint-disable-next-line no-undef
        document.addEventListener('visibilitychange', () => {
          // eslint-disable-next-line no-undef
          if (document.hidden) {
            cleanup();
          }
        });
        
        loadPrompt();
        updateStatus();
                // Memory-optimized interval with cleanup
        const intervalId = setInterval(updateStatus, 30000);
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
          clearInterval(intervalId);
        });
        
        // Also cleanup on visibility change (tab hidden)
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            clearInterval(intervalId);
          }
        }); // Update every 30 seconds
            }
        });
        
        // Chat functions
        function addMessage(role, content, type = 'normal') {
            const messagesDiv = document.getElementById('chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role} \${type} fade-in\`;
            messageDiv.innerHTML = \`<strong>\${role}:</strong> \${content}\`;
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        async function sendMessage() {
            if (isProcessing) return;
            
            // Clear previous debounce
            if (sendMessageDebounce) {
                clearTimeout(sendMessageDebounce);
            }
            
            const input = document.getElementById('chat-input');
            const message = input.value.trim();
            
            if (!message) return;
            
            // Debounce rapid sends
            sendMessageDebounce = setTimeout(() => {
                sendMessageDebounce = null;
            }, 300);
            
            input.value = '';
            addMessage('user', message);
            
            isProcessing = true;
            document.getElementById('chat-input').disabled = true;
            
            try {
                const challenge = await getChallenge();
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Challenge': challenge.challenge,
                        'X-Signature': 'mock-signature',
                        'X-Timestamp': Date.now().toString()
                    },
                    body: JSON.stringify({
                        message: message,
                        conversation: conversation
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    addMessage('assistant', data.choices[0].message.content);
                    conversation.push({ role: 'user', content: message });
                    conversation.push({ role: 'assistant', content: data.choices[0].message.content });
                } else {
                    addMessage('system', \`Error: \${data.error}\`, 'error');
                }
            } catch (error) {
                addMessage('system', \`Network error: \${error.message}\`, 'error');
            } finally {
                isProcessing = false;
                document.getElementById('chat-input').disabled = false;
            }
        }
        
        function handleChatKeypress(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        }
        
        async function executeEdit() {
            if (isProcessing) return;
            
            const instruction = document.getElementById('edit-instruction').value.trim();
            if (!instruction) {
                alert('Please enter an edit instruction');
                return;
            }
            
            isProcessing = true;
            addMessage('system', 'Executing self-edit...', 'normal');
            
            try {
                const challenge = await getChallenge();
                const response = await fetch('/edit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Challenge': challenge.challenge,
                        'X-Signature': 'mock-signature',
                        'X-Timestamp': Date.now().toString()
                    },
                    body: JSON.stringify({
                        instruction: instruction,
                        options: {}
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    addMessage('system', \`✅ Self-edit completed! PR #\${data.prNumber} created: <a href="\${data.prUrl}" target="_blank">\${data.prUrl}</a>\`, 'success');
                    document.getElementById('edit-instruction').value = '';
                } else {
                    addMessage('system', \`❌ Self-edit failed: \${data.error}\`, 'error');
                }
            } catch (error) {
                addMessage('system', \`❌ Self-edit error: \${error.message}\`, 'error');
            } finally {
                isProcessing = false;
            }
        }
        
        function clearChat() {
            conversation = [];
            document.getElementById('chat-messages').innerHTML = '';
            addMessage('system', 'Chat cleared', 'success');
        }
        
        function showPromptModal() {
            document.getElementById('promptModal').style.display = 'block';
        }
        
        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
        
        async function loadPrompt() {
            try {
                const response = await fetch('/api/context');
                const data = await response.json();
                document.getElementById('masterPrompt').value = data.prompt || '';
            } catch (e) {
                console.error('Failed to load prompt:', e);
            }
        }
        
        async function savePrompt() {
            try {
                const value = document.getElementById('masterPrompt').value;
                const challenge = await getChallenge();
                
                await fetch('/api/prompt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Challenge': challenge.challenge,
                        'X-Signature': 'mock-signature',
                        'X-Timestamp': Date.now().toString()
                    },
                    body: JSON.stringify({ prompt: value })
                });
                
                closeModal('promptModal');
                addMessage('system', 'Master prompt saved', 'success');
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }
        
        async function getChallenge() {
            const response = await fetch('/challenge');
            return await response.json();
        }
        
        async function updateStatus() {
            try {
                const response = await fetch('/status');
                const data = await response.json();
                
                document.getElementById('provider-status').textContent = \`Provider: \${getProviderStatus(data)}\`;
                document.getElementById('usage-status').textContent = \`Usage: \${getUsageStatus(data)}\`;
            } catch (e) {
                console.error('Failed to update status:', e);
            }
        }
        
        function getProviderStatus(data) {
            const providers = data.llm_providers || {};
            const available = Object.keys(providers).filter(p => 
                providers[p].remaining > 0
            ).length;
            return \`\${available}/\${Object.keys(providers).length} available\`;
        }
        
        function getUsageStatus(data) {
            const providers = data.llm_providers || {};
            const total = Object.values(providers).reduce((sum, p) => sum + p.usage, 0);
            const limits = Object.values(providers).reduce((sum, p) => sum + p.limit, 0);
            return \`\${total}/\${limits} total\`;
        }
        
        // Close modal when clicking outside
        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        }
    </script>
</body>
</html>`;
}

/**
 * Get available themes
 */
function getThemes() {
  return {
    lcars: `
      /* Authentic Star Trek LCARS Theme */
      :root {
        --lcars-orange: #ff9900;
        --lcars-yellow: #ffff00;
        --lcars-purple: #cc99cc;
        --lcars-blue: #9999ff;
        --lcars-light-blue: #ccccff;
        --lcars-pink: #ffccff;
        --lcars-red: #ff6666;
        --lcars-white: #ffffff;
        --lcars-black: #000000;
        --lcars-dark-gray: #333333;
        --lcars-gray: #666666;
        --lcars-light-gray: #999999;
        
        /* UI Colors */
        --bg-primary: var(--lcars-black);
        --bg-secondary: var(--lcars-dark-gray);
        --text-primary: var(--lcars-white);
        --text-secondary: var(--lcars-light-gray);
        --accent-primary: var(--lcars-orange);
        --accent-secondary: var(--lcars-yellow);
        --border-color: var(--lcars-orange);
        --user-message-bg: var(--lcars-blue);
        --assistant-message-bg: var(--lcars-purple);
        --system-message-bg: var(--lcars-pink);
        --error-bg: var(--lcars-red);
        --error-text: var(--lcars-white);
      }
      
      /* LCARS Interface Styling */
      body {
        background: linear-gradient(90deg, 
          var(--lcars-black) 0%, 
          var(--lcars-dark-gray) 20%, 
          var(--lcars-black) 100%);
        font-family: 'Arial Rounded MT Bold', 'Helvetica Rounded', Arial, sans-serif;
        color: var(--lcars-white);
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      .container {
        background: var(--lcars-black);
        border-radius: 0 25px 25px 0;
        border-left: 15px solid var(--lcars-orange);
        box-shadow: 0 0 20px rgba(255, 153, 0, 0.5);
      }
      
      .header {
        background: linear-gradient(90deg, 
          var(--lcars-orange) 0%, 
          var(--lcars-yellow) 50%, 
          var(--lcars-orange) 100%);
        color: var(--lcars-black);
        border-radius: 25px 25px 0 0;
        padding: 20px;
        text-align: center;
        font-size: 1.5em;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      }
      
      .title {
        color: var(--lcars-black);
        text-shadow: 2px 2px 4px rgba(255,255,255,0.3);
        font-size: 2.2em;
        margin-bottom: 10px;
      }
      
      /* LCARS Button Styling */
      button {
        background: linear-gradient(90deg, 
          var(--lcars-purple) 0%, 
          var(--lcars-blue) 100%);
        color: var(--lcars-white);
        border: none;
        border-radius: 15px 0 15px 0;
        padding: 10px 20px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      }
      
      button:hover {
        background: linear-gradient(90deg, 
          var(--lcars-blue) 0%, 
          var(--lcars-light-blue) 100%);
        box-shadow: 0 6px 12px rgba(153,153,255,0.5);
        transform: translateY(-2px);
      }
      
      /* LCARS Input Styling */
      input, textarea {
        background: var(--lcars-dark-gray);
        color: var(--lcars-white);
        border: 2px solid var(--lcars-orange);
        border-radius: 10px;
        padding: 10px;
        font-family: inherit;
        text-transform: none;
      }
      
      input:focus, textarea:focus {
        outline: none;
        border-color: var(--lcars-yellow);
        box-shadow: 0 0 10px rgba(255,255,0,0.5);
      }
      
      /* LCARS Chat Messages */
      .message {
        border-radius: 15px 15px 15px 0;
        border-left: 5px solid var(--lcars-orange);
        margin: 10px 0;
        padding: 15px;
        position: relative;
      }
      
      .message.user {
        background: linear-gradient(90deg, 
          var(--lcars-blue) 0%, 
          var(--lcars-light-blue) 100%);
        color: var(--lcars-black);
        border-left-color: var(--lcars-yellow);
        margin-left: 20%;
        border-radius: 15px 0 15px 15px;
      }
      
      .message.assistant {
        background: linear-gradient(90deg, 
          var(--lcars-purple) 0%, 
          var(--lcars-pink) 100%);
        color: var(--lcars-white);
        border-left-color: var(--lcars-orange);
        margin-right: 20%;
      }
      
      /* LCARS Scrollbar */
      ::-webkit-scrollbar {
        width: 12px;
      }
      
      ::-webkit-scrollbar-track {
        background: var(--lcars-black);
        border-radius: 6px;
      }
      
      ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, 
          var(--lcars-orange) 0%, 
          var(--lcars-yellow) 100%);
        border-radius: 6px;
      }
      
      /* LCARS Animations */
      @keyframes lcars-pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
      }
      
      .lcars-indicator {
        animation: lcars-pulse 2s infinite;
      }
      
      /* Mobile Responsiveness */
      @media (max-width: 768px) {
        .container {
          padding: 10px;
          margin: 10px;
          border-left-width: 10px;
        }
        
        .header {
          font-size: 1.2em;
          padding: 15px;
          border-radius: 15px 15px 0 0;
        }
        
        .title {
          font-size: 1.8em;
        }
        
        button {
          padding: 8px 16px;
          font-size: 0.9em;
        }
        
        .message.user,
        .message.assistant {
          margin-left: 5%;
          margin-right: 5%;
        }
        
        .controls {
          font-size: 0.9em;
        }
        
        input, textarea {
          padding: 8px;
          font-size: 0.9em;
        }
      }
      
      @media (max-width: 480px) {
        .header {
          font-size: 1em;
        }
        
        .title {
          font-size: 1.5em;
        }
        
        .chat-input {
          flex-direction: column;
        }
        
        .chat-input input {
          margin-bottom: 10px;
        }
        
        button {
          width: 100%;
        }
      }
    `,
    cyberpunk: `
      :root {
        --bg-primary: #0a0a0a;
        --bg-secondary: #1a0d1a;
        --text-primary: #00ff41;
        --text-secondary: #00cc33;
        --accent-primary: #ff0080;
        --accent-secondary: #cc0066;
        --border-color: #00ff41;
        --user-message-bg: #1a1a1a;
        --assistant-message-bg: #0d0d0d;
        --system-message-bg: #1a1a1a;
        --error-bg: #ff0040;
        --error-text: #fff;
      }
    `,
    matrix: `
      :root {
        --bg-primary: #000;
        --bg-secondary: #001000;
        --text-primary: #00ff00;
        --text-secondary: #00cc00;
        --accent-primary: #00ff00;
        --accent-secondary: #00cc00;
        --border-color: #00ff00;
        --user-message-bg: #002000;
        --assistant-message-bg: #001000;
        --system-message-bg: #002000;
        --error-bg: #ff0000;
        --error-text: #fff;
      }
    `,
    tron: `
      :root {
        --bg-primary: #000;
        --bg-secondary: #001a33;
        --text-primary: #00ffff;
        --text-secondary: #00cccc;
        --accent-primary: #ff0080;
        --accent-secondary: #cc0066;
        --border-color: #00ffff;
        --user-message-bg: #002244;
        --assistant-message-bg: #001122;
        --system-message-bg: #002244;
        --error-bg: #ff0040;
        --error-text: #fff;
      }
    `
  };
}

export default {
  renderUI
};