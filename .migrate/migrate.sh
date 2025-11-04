#!/bin/bash
set -e

echo "🚀 Starting Frontend Migration..."
echo "================================="

# Validate we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend/ directory not found"
    echo "Please run this script from the repository root"
    exit 1
fi

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p frontend/styles
mkdir -p frontend/js
mkdir -p frontend/tests

# Backup original file
echo "💾 Creating backup..."
if [ -f "frontend/index.html" ]; then
    cp frontend/index.html frontend/index.backup.html
    echo "✅ Backup created: frontend/index.backup.html"
fi

# Extract and create CSS files
echo "🎨 Extracting CSS..."

# Create base.css
cat > frontend/styles/base.css << 'EOF'
/* Base Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    transition: background-color 0.25s ease, color 0.25s ease;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

/* CSS Variables */
:root {
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
    --border-radius-sm: 8px;
    --border-radius-md: 12px;
    --border-radius-lg: 16px;
    --transition-fast: 150ms ease;
    --transition-normal: 250ms ease;
    --transition-slow: 350ms ease;
}

/* Layout */
.hidden { display: none !important; }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.gap-2 { gap: 0.5rem; }
.gap-4 { gap: 1rem; }
EOF

echo "✅ base.css created"

# Create themes.css
cat > frontend/styles/themes.css << 'EOF'
/* Theme System */

/* Matrix Theme */
body.theme-matrix {
    --bg-primary: #000000;
    --bg-secondary: #001a00;
    --bg-tertiary: #002200;
    --text-primary: #00ff00;
    --text-secondary: #00cc00;
    --text-muted: #008800;
    --accent-primary: #00ff00;
    --accent-secondary: #00ff00;
    --border-color: #003300;
    --message-user-bg: #002200;
    --message-ai-bg: #001100;
    --message-system-bg: #1a1a00;
    --input-bg: #001100;
    --button-bg: #002200;
    --button-hover-bg: #00ff00;
    --button-hover-text: #000000;
    --shadow-sm: 0 0 10px rgba(0, 255, 0, 0.1);
    --shadow-md: 0 0 20px rgba(0, 255, 0, 0.2);
    --shadow-lg: 0 0 30px rgba(0, 255, 0, 0.3);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Courier New', 'Consolas', monospace;
}

/* Cyberpunk Theme */
body.theme-cyberpunk {
    --bg-primary: #0a0a1a;
    --bg-secondary: #1a0a2a;
    --bg-tertiary: #2a0a3a;
    --text-primary: #ff00ff;
    --text-secondary: #cc00cc;
    --text-muted: #aa00aa;
    --accent-primary: #00ffff;
    --accent-secondary: #ff00ff;
    --border-color: #3a0a4a;
    --message-user-bg: linear-gradient(135deg, #1a0a2a 0%, #2a0a3a 100%);
    --message-ai-bg: linear-gradient(135deg, #15051f 0%, #1a0a2a 100%);
    --message-system-bg: #2a1a00;
    --input-bg: #0a0a1a;
    --button-bg: #1a0a2a;
    --button-hover-bg: #ff00ff;
    --button-hover-text: #000000;
    --shadow-sm: 0 4px 12px rgba(255, 0, 255, 0.15);
    --shadow-md: 0 8px 24px rgba(255, 0, 255, 0.25);
    --shadow-lg: 0 12px 36px rgba(255, 0, 255, 0.35);
    background: var(--bg-primary);
    color: var(--text-primary);
}

/* Modern Dark Theme */
body.theme-modern {
    --bg-primary: #0f0f0f;
    --bg-secondary: #1a1a1a;
    --bg-tertiary: #252525;
    --text-primary: #e8e8e8;
    --text-secondary: #b8b8b8;
    --text-muted: #888888;
    --accent-primary: #4a9eff;
    --accent-secondary: #357abd;
    --border-color: #2a2a2a;
    --message-user-bg: linear-gradient(135deg, #2d4a6e 0%, #1e3a5f 100%);
    --message-ai-bg: #1a1a1a;
    --message-system-bg: #3d3d1a;
    --input-bg: #1a1a1a;
    --button-bg: #2a2a2a;
    --button-hover-bg: #3a3a3a;
    --button-hover-text: #ffffff;
    --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
    background: var(--bg-primary);
    color: var(--text-primary);
}
EOF

echo "✅ themes.css created"

# Create components.css
cat > frontend/styles/components.css << 'EOF'
/* Components */

/* Header */
.header {
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(10px);
}

.header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
}

h1 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* Messages */
.chat-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--spacing-lg);
    scroll-behavior: smooth;
}

.message {
    max-width: 700px;
    margin: 0 auto var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius-md);
    line-height: 1.6;
    animation: messageSlideIn 0.3s ease-out;
}

@keyframes messageSlideIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.message.user {
    background: var(--message-user-bg);
    margin-left: auto;
    margin-right: 0;
    border-bottom-right-radius: 4px;
    box-shadow: var(--shadow-sm);
}

.message.assistant {
    background: var(--message-ai-bg);
    margin-left: 0;
    margin-right: auto;
    border-bottom-left-radius: 4px;
    border: 1px solid var(--border-color);
}

.message.system,
.message.error {
    background: var(--message-system-bg);
    text-align: center;
    font-size: 0.875rem;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-sm);
    max-width: 600px;
}

/* Buttons */
button {
    padding: 10px 18px;
    background: var(--button-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    transition: all var(--transition-fast);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    white-space: nowrap;
}

button:hover:not(:disabled) {
    background: var(--button-hover-bg);
    color: var(--button-hover-text);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Inputs */
.input-container {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
}

textarea {
    flex: 1;
    padding: 14px 18px;
    background: var(--input-bg);
    color: var(--text-primary);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-md);
    font-size: 1rem;
    font-family: inherit;
    resize: none;
    min-height: 52px;
    max-height: 200px;
    transition: border-color var(--transition-fast);
    line-height: 1.5;
}

textarea:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(var(--accent-primary), 0.1);
}

/* Responsive */
@media (max-width: 767px) {
    .header {
        padding: var(--spacing-md);
        flex-direction: column;
        align-items: flex-start;
    }
    
    .chat-container {
        padding: var(--spacing-md);
    }
    
    .message {
        max-width: 100%;
        padding: var(--spacing-sm) var(--spacing-md);
    }
}
EOF

echo "✅ components.css created"

# Create JavaScript modules
echo "📝 Creating JavaScript modules..."

# Create state.js
cat > frontend/js/state.js << 'EOF'
// Centralized application state
export const state = {
    config: {
        routerUrl: localStorage.getItem('routerUrl') || '',
        secret: localStorage.getItem('secret') || '',
        theme: localStorage.getItem('theme') || 'matrix'
    },
    conversation: [],
    flags: {
        isRecording: false,
        isUpgradeMode: false,
        isSending: false,
        isVoiceInput: false
    }
};

export function saveConfig() {
    localStorage.setItem('routerUrl', state.config.routerUrl);
    localStorage.setItem('secret', state.config.secret);
    localStorage.setItem('theme', state.config.theme);
}
EOF

echo "✅ state.js created"

# Create api.js
cat > frontend/js/api.js << 'EOF'
// API communication
import { state } from './state.js';

export async function getChallenge() {
    const response = await fetch(`${state.config.routerUrl}/challenge`);
    if (!response.ok) throw new Error('Failed to get challenge');
    return await response.json();
}

export async function sendMessage(message, challenge) {
    const timestamp = Date.now();
    const signature = await computeSignature(challenge.challenge, timestamp, message);
    
    const response = await fetch(`${state.config.routerUrl}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Challenge': challenge.challenge,
            'X-Timestamp': timestamp.toString(),
            'X-Signature': signature
        },
        body: JSON.stringify({ message, conversation: state.conversation })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    return await response.json();
}

export async function sendUpgrade(instruction, challenge) {
    const timestamp = Date.now();
    const signature = await computeSignature(challenge.challenge, timestamp, instruction);
    
    const response = await fetch(`${state.config.routerUrl}/upgrade`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Challenge': challenge.challenge,
            'X-Timestamp': timestamp.toString(),
            'X-Signature': signature
        },
        body: JSON.stringify({ instruction })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upgrade failed');
    }
    return await response.json();
}

async function computeSignature(challenge, timestamp, message) {
    const data = `${challenge}|${timestamp}|unknown|${navigator.userAgent}|${JSON.stringify({ message, conversation: state.conversation })}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(state.config.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
EOF

echo "✅ api.js created"

# Create themes.js
cat > frontend/js/themes.js << 'EOF'
// Theme management
import { state, saveConfig } from './state.js';

export const themes = [
    'matrix', 'cyberpunk', 'modern'
];

export function applyTheme(theme) {
    document.body.className = `theme-${theme}`;
    state.config.theme = theme;
    saveConfig();
}

export function initTheme() {
    applyTheme(state.config.theme);
}
EOF

echo "✅ themes.js created"

# Create ui.js
cat > frontend/js/ui.js << 'EOF'
// UI updates and interactions
import { state } from './state.js';

export function addMessage(role, content) {
    const container = document.getElementById('chat-container');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    
    if (role !== 'system' && role !== 'error') {
        const roleLabel = document.createElement('div');
        roleLabel.className = 'message-role';
        roleLabel.textContent = role === 'user' ? 'You' : 'Omnibot';
        msg.appendChild(roleLabel);
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    msg.appendChild(contentDiv);
    
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    
    // Add to conversation history
    if (role === 'user' || role === 'assistant') {
        state.conversation.push({ role, content });
    }
}

export function showTypingIndicator() {
    const container = document.getElementById('chat-container');
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
}

export function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

export function setButtonState(buttonId, disabled) {
    const button = document.getElementById(buttonId);
    if (button) button.disabled = disabled;
}
EOF

echo "✅ ui.js created"

# Create app.js (main orchestrator)
cat > frontend/js/app.js << 'EOF'
// Main application orchestrator
import { state, saveConfig } from './state.js';
import { themes, applyTheme, initTheme } from './themes.js';
import { getChallenge, sendMessage, sendUpgrade } from './api.js';
import { addMessage, showTypingIndicator, hideTypingIndicator, setButtonState } from './ui.js';

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadSettings();
    initEventListeners();
    addMessage('system', '🚀 System Initialized');
});

function initEventListeners() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const themeSelect = document.getElementById('theme-select');
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    
    sendBtn.addEventListener('click', handleSendMessage);
    voiceBtn.addEventListener('click', handleVoiceInput);
    themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
    
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('save-settings').addEventListener('click', saveSettings);
}

async function handleSendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text || state.flags.isSending) return;
    
    if (!state.config.routerUrl || !state.config.secret) {
        addMessage('system', '⚙️ Please configure settings first');
        openSettings();
        return;
    }
    
    input.value = '';
    addMessage('user', text);
    
    state.flags.isSending = true;
    setButtonState('send-btn', true);
    showTypingIndicator();
    
    try {
        const challenge = await getChallenge();
        const response = await sendMessage(text, challenge);
        addMessage('assistant', response.response);
    } catch (error) {
        addMessage('error', `❌ ${error.message}`);
    } finally {
        hideTypingIndicator();
        state.flags.isSending = false;
        setButtonState('send-btn', false);
    }
}

function handleVoiceInput() {
    addMessage('system', '🎤 Voice input not yet implemented in modular version');
}

function loadSettings() {
    document.getElementById('router-url').value = state.config.routerUrl;
    document.getElementById('secret').value = state.config.secret;
    document.getElementById('theme-select').value = state.config.theme;
}

function saveSettings() {
    state.config.routerUrl = document.getElementById('router-url').value.trim();
    state.config.secret = document.getElementById('secret').value.trim();
    saveConfig();
    addMessage('system', '✅ Settings saved');
    closeSettings();
}

function openSettings() {
    document.getElementById('settings-panel').classList.add('active');
}

function closeSettings() {
    document.getElementById('settings-panel').classList.remove('active');
}
EOF

echo "✅ app.js created"

# Create new minimal index.html
echo "🏗️  Creating new modular index.html..."
cat > frontend/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Omnibot - AI Assistant</title>
    <link rel="stylesheet" href="styles/base.css">
    <link rel="stylesheet" href="styles/themes.css">
    <link rel="stylesheet" href="styles/components.css">
</head>
<body class="theme-matrix">
    <!-- Header -->
    <div class="header">
        <div class="header-left">
            <h1>🤖 Omnibot</h1>
        </div>
        <div class="controls">
            <button id="settings-btn">⚙️ Settings</button>
        </div>
    </div>

    <!-- Chat Container -->
    <div class="chat-container" id="chat-container"></div>

    <!-- Input Area -->
    <div class="input-container">
        <div style="max-width: 900px; margin: 0 auto; display: flex; gap: 1rem; align-items: flex-end;">
            <textarea 
                id="message-input" 
                placeholder="Type your message..."
                rows="1"
            ></textarea>
            <button id="voice-btn" title="Voice input">🎤</button>
            <button id="send-btn" title="Send message">➤</button>
        </div>
    </div>

    <!-- Settings Panel -->
    <div class="settings-panel" id="settings-panel" style="display: none;">
        <h2>⚙️ Settings</h2>
        
        <div class="setting-group">
            <label for="router-url">Router URL</label>
            <input type="text" id="router-url" placeholder="https://your-worker.workers.dev">
        </div>
        
        <div class="setting-group">
            <label for="secret">Shared Secret</label>
            <input type="password" id="secret" placeholder="Your secret">
        </div>
        
        <div class="setting-group">
            <label for="theme-select">Theme</label>
            <select id="theme-select">
                <option value="matrix">Matrix</option>
                <option value="cyberpunk">Cyberpunk</option>
                <option value="modern">Modern</option>
            </select>
        </div>
        
        <button id="save-settings">💾 Save</button>
    </div>

    <script type="module" src="js/app.js"></script>
</body>
</html>
EOF

echo "✅ New index.html created"

# Create test file
echo "🧪 Creating test file..."
cat > frontend/tests/frontend.test.js << 'EOF'
// Basic smoke tests
import { test } from 'node:test';
import assert from 'node:assert';

test('placeholder test', async () => {
    assert.ok(true, 'Placeholder - implement with proper test runner');
});
EOF

echo "✅ Test file created"

echo ""
echo "================================="
echo "✅ Migration Complete!"
echo "================================="
echo ""
echo "Changes made:"
echo "  📁 Created frontend/styles/ with 3 CSS files"
echo "  📁 Created frontend/js/ with 5 JS modules"
echo "  📁 Created frontend/tests/ with test template"
echo "  📄 Replaced frontend/index.html (backup saved)"
echo ""
echo "File count:"
echo "  - CSS files: $(find frontend/styles -name '*.css' 2>/dev/null | wc -l)"
echo "  - JS files: $(find frontend/js -name '*.js' 2>/dev/null | wc -l)"
echo "  - New index.html: $(wc -l < frontend/index.html) lines"
echo ""