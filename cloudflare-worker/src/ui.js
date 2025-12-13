/**
 * UI module for OmniBot
 * Handles HTML UI generation and rendering
 */

import { VERSION_FULL } from './config.js';

/**
 * Render the main UI
 */
export function renderUI(sessionToken = null) {
  const themes = getThemes();
  const currentTheme = 'lcars'; // Default theme
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OmniBot - ${VERSION_FULL}</title>
    <style>
        ${themes[currentTheme]}
        
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
                <div class="status-indicator online"></div>
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
        let isProcessing = false;
        
        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            if (${sessionToken ? 'true' : 'false'}) {
                loadPrompt();
                updateStatus();
                setInterval(updateStatus, 30000); // Update every 30 seconds
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
            
            const input = document.getElementById('chat-input');
            const message = input.value.trim();
            
            if (!message) return;
            
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
      :root {
        --bg-primary: #000;
        --bg-secondary: #1a1a2e;
        --text-primary: #ffa500;
        --text-secondary: #ffcc80;
        --accent-primary: #ff6b35;
        --accent-secondary: #f7931e;
        --border-color: #ff6b35;
        --user-message-bg: #2a2a3e;
        --assistant-message-bg: #1a1a2e;
        --system-message-bg: #2a2a3e;
        --error-bg: #d32f2f;
        --error-text: #fff;
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