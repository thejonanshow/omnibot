#!/bin/bash
set -e

echo “🚀 Starting Frontend Migration…”
echo “=================================”

# Create directory structure

echo “📁 Creating directory structure…”
mkdir -p frontend/styles
mkdir -p frontend/js
mkdir -p frontend/tests

# Backup original file

echo “💾 Creating backup…”
if [ -f “frontend/index.html” ]; then
cp frontend/index.html frontend/index.backup.html
echo “✅ Backup created: frontend/index.backup.html”
fi

# Extract and create CSS files

echo “🎨 Extracting CSS…”

# Create base.css

cat > frontend/styles/base.css << ‘EOF’
/* Base Styles */

- {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  }

body {
font-family: ‘Courier New’, monospace;
background: var(–bg);
color: var(–text);
overflow: hidden;
transition: background-color 0.3s, color 0.3s;
}

.container {
display: flex;
flex-direction: column;
height: 100vh;
max-width: 1200px;
margin: 0 auto;
padding: 10px;
}

/* Typography */
h1 {
font-size: 1.5em;
margin-bottom: 10px;
text-align: center;
color: var(–primary);
}

/* Layout */
.hidden { display: none !important; }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.gap-2 { gap: 0.5rem; }
.gap-4 { gap: 1rem; }
EOF

# Create themes.css with data-driven system

cat > frontend/styles/themes.css << ‘EOF’
/* Theme System - Data Driven */
:root {
/* Default: Matrix theme */
–bg: #0d0208;
–text: #00ff41;
–primary: #39ff14;
–secondary: #008f11;
–accent: #00ff41;
–border: #003b00;
–input-bg: #001a00;
–hover: #004d00;
}

/* Theme Definitions */
[data-theme=“matrix”] {
–bg: #0d0208;
–text: #00ff41;
–primary: #39ff14;
–secondary: #008f11;
–accent: #00ff41;
–border: #003b00;
–input-bg: #001a00;
–hover: #004d00;
}

[data-theme=“hal9000”] {
–bg: #000000;
–text: #ff0000;
–primary: #ff0000;
–secondary: #8b0000;
–accent: #ff0000;
–border: #4a0000;
–input-bg: #1a0000;
–hover: #330000;
}

[data-theme=“cyberpunk”] {
–bg: #0a0e27;
–text: #00ffff;
–primary: #ff00ff;
–secondary: #ff1493;
–accent: #00ffff;
–border: #1a1f3a;
–input-bg: #0f1429;
–hover: #1e2747;
}

[data-theme=“terminal”] {
–bg: #000000;
–text: #ffffff;
–primary: #00ff00;
–secondary: #00aa00;
–accent: #ffff00;
–border: #333333;
–input-bg: #111111;
–hover: #222222;
}

[data-theme=“neon”] {
–bg: #0a0a1e;
–text: #e0e0e0;
–primary: #ff006e;
–secondary: #8338ec;
–accent: #3a86ff;
–border: #1a1a3e;
–input-bg: #0f0f1e;
–hover: #1e1e3e;
}

[data-theme=“vapor”] {
–bg: #1a0033;
–text: #ff71ce;
–primary: #01cdfe;
–secondary: #05ffa1;
–accent: #b967ff;
–border: #2d0052;
–input-bg: #220040;
–hover: #3a0066;
}

[data-theme=“synthwave”] {
–bg: #2b213a;
–text: #f9f9f9;
–primary: #ff6c11;
–secondary: #ff3864;
–accent: #9d72ff;
–border: #3d2e4f;
–input-bg: #342947;
–hover: #4a3960;
}

[data-theme=“hacker”] {
–bg: #000000;
–text: #00ff00;
–primary: #00ff00;
–secondary: #00cc00;
–accent: #00ff00;
–border: #003300;
–input-bg: #001100;
–hover: #002200;
}

[data-theme=“military”] {
–bg: #1a1a0f;
–text: #88aa55;
–primary: #aacc77;
–secondary: #556633;
–accent: #ccee99;
–border: #333322;
–input-bg: #111108;
–hover: #222214;
}

[data-theme=“retro”] {
–bg: #f4e8c1;
–text: #3e2723;
–primary: #d84315;
–secondary: #bf360c;
–accent: #ff6f00;
–border: #d7c9a8;
–input-bg: #fff9e6;
–hover: #e8dbb8;
}

[data-theme=“minimal”] {
–bg: #ffffff;
–text: #212121;
–primary: #2196f3;
–secondary: #1976d2;
–accent: #03a9f4;
–border: #e0e0e0;
–input-bg: #fafafa;
–hover: #f5f5f5;
}

[data-theme=“ocean”] {
–bg: #001f3f;
–text: #7fdbff;
–primary: #39cccc;
–secondary: #0074d9;
–accent: #7fdbff;
–border: #003366;
–input-bg: #001a33;
–hover: #002952;
}

[data-theme=“forest”] {
–bg: #1a2f1a;
–text: #90ee90;
–primary: #32cd32;
–secondary: #228b22;
–accent: #98fb98;
–border: #2d4a2d;
–input-bg: #152015;
–hover: #243a24;
}

[data-theme=“sunset”] {
–bg: #2d1b2e;
–text: #ffd89b;
–primary: #ff7e5f;
–secondary: #feb47b;
–accent: #ffc371;
–border: #4a2f4b;
–input-bg: #251a26;
–hover: #3a2a3b;
}
EOF

# Create components.css

cat > frontend/styles/components.css << ‘EOF’
/* Components */

/* Header */
header {
display: flex;
align-items: center;
gap: 1rem;
padding: 1rem;
border-bottom: 2px solid var(–border);
}

/* Messages */
#messages {
flex: 1;
overflow-y: auto;
padding: 1rem;
background: var(–input-bg);
border: 1px solid var(–border);
border-radius: 4px;
margin-bottom: 1rem;
scroll-behavior: smooth;
}

.message {
margin-bottom: 1rem;
padding: 0.75rem;
border-left: 3px solid var(–primary);
background: var(–bg);
border-radius: 4px;
}

.message.user {
border-left-color: var(–accent);
}

.message.assistant {
border-left-color: var(–secondary);
}

.message strong {
color: var(–primary);
display: block;
margin-bottom: 0.25rem;
}

/* Buttons */
button {
padding: 0.75rem 1.5rem;
background: var(–primary);
color: var(–bg);
border: none;
border-radius: 4px;
cursor: pointer;
font-family: inherit;
font-weight: bold;
transition: all 0.3s;
}

button:hover:not(:disabled) {
background: var(–secondary);
transform: translateY(-2px);
}

button:disabled {
opacity: 0.5;
cursor: not-allowed;
}

button.secondary {
background: var(–secondary);
}

button.accent {
background: var(–accent);
}

/* Inputs */
input, textarea, select {
padding: 0.75rem;
background: var(–input-bg);
color: var(–text);
border: 1px solid var(–border);
border-radius: 4px;
font-family: inherit;
font-size: 1rem;
}

input:focus, textarea:focus, select:focus {
outline: none;
border-color: var(–primary);
box-shadow: 0 0 0 2px rgba(var(–primary-rgb), 0.1);
}

textarea {
width: 100%;
min-height: 100px;
resize: vertical;
}

/* Controls */
.controls {
display: flex;
gap: 0.5rem;
margin-top: 0.5rem;
}

/* Settings Panel */
#settings {
padding: 1rem;
background: var(–input-bg);
border: 1px solid var(–border);
border-radius: 4px;
margin-bottom: 1rem;
}

#settings .setting-group {
margin-bottom: 1rem;
}

#settings label {
display: block;
margin-bottom: 0.25rem;
color: var(–primary);
font-weight: bold;
}

/* Status */
#status {
padding: 0.5rem;
text-align: center;
font-size: 0.875rem;
color: var(–secondary);
border-top: 1px solid var(–border);
}

/* Recording Indicator */
.recording {
animation: pulse 1s infinite;
}

@keyframes pulse {
0%, 100% { opacity: 1; }
50% { opacity: 0.5; }
}

/* Scroll to bottom button */
#scrollButton {
position: fixed;
bottom: 120px;
right: 20px;
width: 50px;
height: 50px;
border-radius: 50%;
background: var(–primary);
color: var(–bg);
border: none;
cursor: pointer;
display: none;
align-items: center;
justify-content: center;
font-size: 1.5rem;
box-shadow: 0 2px 10px rgba(0,0,0,0.3);
transition: all 0.3s;
z-index: 1000;
}

#scrollButton:hover {
transform: scale(1.1);
}

/* Responsive */
@media (max-width: 768px) {
.container {
padding: 5px;
}

h1 {
font-size: 1.2em;
}

button {
padding: 0.5rem 1rem;
font-size: 0.875rem;
}

.controls {
flex-wrap: wrap;
}
}
EOF

echo “✅ CSS files created”

# Create JavaScript modules

echo “📝 Creating JavaScript modules…”

# Create state.js

cat > frontend/js/state.js << ‘EOF’
// Centralized application state
export const state = {
config: {
routerURL: localStorage.getItem(‘routerURL’) || ‘’,
sharedSecret: localStorage.getItem(‘sharedSecret’) || ‘’
},
conversation: [],
flags: {
isRecording: false,
isUpgradeMode: false,
isSending: false
},
currentTheme: localStorage.getItem(‘theme’) || ‘matrix’
};

export function saveConfig() {
localStorage.setItem(‘routerURL’, state.config.routerURL);
localStorage.setItem(‘sharedSecret’, state.config.sharedSecret);
}

export function saveTheme() {
localStorage.setItem(‘theme’, state.currentTheme);
}
EOF

# Create themes.js

cat > frontend/js/themes.js << ‘EOF’
// Theme management
import { state, saveTheme } from ‘./state.js’;

export const themes = [
‘matrix’, ‘hal9000’, ‘cyberpunk’, ‘terminal’, ‘neon’, ‘vapor’,
‘synthwave’, ‘hacker’, ‘military’, ‘retro’, ‘minimal’, ‘ocean’,
‘forest’, ‘sunset’
];

export function applyTheme(theme) {
document.documentElement.setAttribute(‘data-theme’, theme);
state.currentTheme = theme;
saveTheme();
}

export function getCurrentTheme() {
return state.currentTheme;
}

export function initTheme() {
applyTheme(state.currentTheme);
}
EOF

# Create api.js

cat > frontend/js/api.js << ‘EOF’
// API communication
import { state } from ‘./state.js’;

export async function getChallenge() {
const response = await fetch(`${state.config.routerURL}/challenge`);
if (!response.ok) throw new Error(‘Failed to get challenge’);
return await response.json();
}

export async function sendMessage(message) {
const { challenge, timestamp } = await getChallenge();
const body = JSON.stringify({ message, conversation: state.conversation });
const signature = await computeHMAC(state.config.sharedSecret, challenge + body);

const response = await fetch(`${state.config.routerURL}/chat`, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘X-Challenge’: challenge,
‘X-Signature’: signature,
‘X-Timestamp’: timestamp.toString()
},
body
});

if (!response.ok) throw new Error(‘Failed to send message’);
return await response.json();
}

export async function upgradeCode(instructions) {
const { challenge, timestamp } = await getChallenge();
const body = JSON.stringify({ instruction: instructions });
const signature = await computeHMAC(state.config.sharedSecret, challenge + body);

const response = await fetch(`${state.config.routerURL}/upgrade`, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘X-Challenge’: challenge,
‘X-Signature’: signature,
‘X-Timestamp’: timestamp.toString()
},
body
});

if (!response.ok) throw new Error(‘Failed to upgrade’);
return await response.json();
}

async function computeHMAC(secret, message) {
const encoder = new TextEncoder();
const key = await crypto.subtle.importKey(
‘raw’,
encoder.encode(secret),
{ name: ‘HMAC’, hash: ‘SHA-256’ },
false,
[‘sign’]
);
const signature = await crypto.subtle.sign(‘HMAC’, key, encoder.encode(message));
return Array.from(new Uint8Array(signature))
.map(b => b.toString(16).padStart(2, ‘0’))
.join(’’);
}
EOF

# Create speech.js

cat > frontend/js/speech.js << ‘EOF’
// Voice input/output
import { state } from ‘./state.js’;

let mediaRecorder = null;
let audioChunks = [];

export async function startRecording() {
if (state.flags.isRecording) return;

const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
mediaRecorder = new MediaRecorder(stream);
audioChunks = [];

mediaRecorder.ondataavailable = (event) => {
audioChunks.push(event.data);
};

mediaRecorder.start();
state.flags.isRecording = true;
}

export function stopRecording() {
return new Promise((resolve) => {
if (!mediaRecorder || !state.flags.isRecording) {
resolve(null);
return;
}

```
mediaRecorder.onstop = () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  state.flags.isRecording = false;
  mediaRecorder.stream.getTracks().forEach(track => track.stop());
  resolve(audioBlob);
};

mediaRecorder.stop();
```

});
}

export async function transcribeAudio(audioBlob) {
const formData = new FormData();
formData.append(‘audio’, audioBlob, ‘recording.webm’);

const response = await fetch(`${state.config.routerURL}/stt`, {
method: ‘POST’,
body: formData
});

if (!response.ok) throw new Error(‘Failed to transcribe’);
const data = await response.json();
return data.text;
}

export async function speakText(text) {
const response = await fetch(`${state.config.routerURL}/tts`, {
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify({ text })
});

if (!response.ok) throw new Error(‘Failed to generate speech’);
const audioBlob = await response.blob();
const audio = new Audio(URL.createObjectURL(audioBlob));
audio.play();
}
EOF

# Create ui.js

cat > frontend/js/ui.js << ‘EOF’
// UI updates and interactions
import { state } from ‘./state.js’;

export function showStatus(message, type = ‘info’) {
const status = document.getElementById(‘status’);
status.textContent = message;
status.style.color = type === ‘error’ ? ‘var(–accent)’ : ‘var(–secondary)’;
}

export function addMessage(role, content) {
const messages = document.getElementById(‘messages’);
const messageDiv = document.createElement(‘div’);
messageDiv.className = `message ${role}`;
messageDiv.innerHTML = `<strong>${role === 'user' ? 'You' : 'Assistant'}:</strong>${content}`;
messages.appendChild(messageDiv);
messages.scrollTop = messages.scrollHeight;

// Add to conversation history
state.conversation.push({ role, content });
}

export function clearMessages() {
document.getElementById(‘messages’).innerHTML = ‘’;
state.conversation = [];
}

export function setButtonState(buttonId, disabled) {
document.getElementById(buttonId).disabled = disabled;
}

export function updateScrollButton() {
const messages = document.getElementById(‘messages’);
const scrollButton = document.getElementById(‘scrollButton’);
const isNearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 100;
scrollButton.style.display = isNearBottom ? ‘none’ : ‘flex’;
}
EOF

# Create app.js (main orchestrator)

cat > frontend/js/app.js << ‘EOF’
// Main application orchestrator
import { state, saveConfig } from ‘./state.js’;
import { themes, applyTheme, initTheme } from ‘./themes.js’;
import { sendMessage, upgradeCode } from ‘./api.js’;
import { startRecording, stopRecording, transcribeAudio, speakText } from ‘./speech.js’;
import { showStatus, addMessage, clearMessages, setButtonState, updateScrollButton } from ‘./ui.js’;

// Initialize on load
document.addEventListener(‘DOMContentLoaded’, () => {
initTheme();
initThemeSelector();
initEventListeners();
loadSettings();
showStatus(‘Ready’);
});

function initThemeSelector() {
const select = document.getElementById(‘themeSelect’);
themes.forEach(theme => {
const option = document.createElement(‘option’);
option.value = theme;
option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
if (theme === state.currentTheme) option.selected = true;
select.appendChild(option);
});
}

function initEventListeners() {
// Theme
document.getElementById(‘themeSelect’).addEventListener(‘change’, (e) => {
applyTheme(e.target.value);
});

// Settings
document.getElementById(‘saveSettings’).addEventListener(‘click’, () => {
state.config.routerURL = document.getElementById(‘routerURL’).value;
state.config.sharedSecret = document.getElementById(‘sharedSecret’).value;
saveConfig();
showStatus(‘Settings saved’);
});

// Messages
document.getElementById(‘sendMessage’).addEventListener(‘click’, handleSendMessage);
document.getElementById(‘userInput’).addEventListener(‘keypress’, (e) => {
if (e.key === ‘Enter’ && !e.shiftKey) {
e.preventDefault();
handleSendMessage();
}
});

// Voice
document.getElementById(‘voiceInput’).addEventListener(‘click’, handleVoiceInput);

// Upgrade mode
document.getElementById(‘toggleUpgrade’).addEventListener(‘click’, () => {
state.flags.isUpgradeMode = !state.flags.isUpgradeMode;
document.getElementById(‘upgradePanel’).classList.toggle(‘hidden’);
showStatus(state.flags.isUpgradeMode ? ‘⚠️ UPGRADE MODE ACTIVE’ : ‘Upgrade mode disabled’);
});

document.getElementById(‘executeUpgrade’).addEventListener(‘click’, handleUpgrade);

// Clear
document.getElementById(‘clearMessages’).addEventListener(‘click’, () => {
clearMessages();
showStatus(‘Conversation cleared’);
});

// Scroll
const messages = document.getElementById(‘messages’);
messages.addEventListener(‘scroll’, updateScrollButton);
document.getElementById(‘scrollButton’).addEventListener(‘click’, () => {
messages.scrollTop = messages.scrollHeight;
});
}

function loadSettings() {
document.getElementById(‘routerURL’).value = state.config.routerURL;
document.getElementById(‘sharedSecret’).value = state.config.sharedSecret;
}

async function handleSendMessage() {
const input = document.getElementById(‘userInput’);
const message = input.value.trim();
if (!message || state.flags.isSending) return;

try {
state.flags.isSending = true;
setButtonState(‘sendMessage’, true);
showStatus(‘Sending…’);

```
addMessage('user', message);
input.value = '';

const response = await sendMessage(message);
addMessage('assistant', response.message);

showStatus('Ready');
```

} catch (error) {
showStatus(`Error: ${error.message}`, ‘error’);
} finally {
state.flags.isSending = false;
setButtonState(‘sendMessage’, false);
}
}

async function handleVoiceInput() {
const button = document.getElementById(‘voiceInput’);

if (!state.flags.isRecording) {
try {
await startRecording();
button.textContent = ‘🔴 Stop’;
button.classList.add(‘recording’);
showStatus(‘Recording…’);
} catch (error) {
showStatus(`Microphone error: ${error.message}`, ‘error’);
}
} else {
try {
const audioBlob = await stopRecording();
button.textContent = ‘🎤 Voice’;
button.classList.remove(‘recording’);
showStatus(‘Transcribing…’);

```
  const text = await transcribeAudio(audioBlob);
  
  if (state.flags.isUpgradeMode && text.toLowerCase().includes('upgrade')) {
    document.getElementById('upgradeInstructions').value = text;
    showStatus('Upgrade instructions captured');
  } else {
    document.getElementById('userInput').value = text;
    await handleSendMessage();
  }
} catch (error) {
  showStatus(`Transcription error: ${error.message}`, 'error');
}
```

}
}

async function handleUpgrade() {
const instructions = document.getElementById(‘upgradeInstructions’).value.trim();
if (!instructions) return;

if (!confirm(‘⚠️ This will modify the application code. Continue?’)) return;

try {
setButtonState(‘executeUpgrade’, true);
showStatus(‘Upgrading application…’);

```
const result = await upgradeCode(instructions);
showStatus('✅ Upgrade complete! Reload the page.', 'info');

setTimeout(() => window.location.reload(), 3000);
```

} catch (error) {
showStatus(`Upgrade failed: ${error.message}`, ‘error’);
setButtonState(‘executeUpgrade’, false);
}
}
EOF

echo “✅ JavaScript modules created”

# Create new index.html

echo “🏗️  Creating new modular index.html…”
cat > frontend/index.html << ‘EOF’

<!DOCTYPE html>

<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Omni Agent UI</title>
  <link rel="stylesheet" href="styles/base.css">
  <link rel="stylesheet" href="styles/themes.css">
  <link rel="stylesheet" href="styles/components.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 Omni Agent</h1>
      <select id="themeSelect"></select>
    </header>

```
<div id="settings">
  <div class="setting-group">
    <label for="routerURL">Router URL:</label>
    <input type="text" id="routerURL" placeholder="https://your-worker.workers.dev">
  </div>
  <div class="setting-group">
    <label for="sharedSecret">Shared Secret:</label>
    <input type="password" id="sharedSecret" placeholder="Your HMAC secret">
  </div>
  <button id="saveSettings">💾 Save Settings</button>
</div>

<div id="messages"></div>

<div class="controls">
  <textarea id="userInput" placeholder="Type your message..."></textarea>
</div>

<div class="controls">
  <button id="sendMessage">📤 Send</button>
  <button id="voiceInput">🎤 Voice</button>
  <button id="toggleUpgrade" class="secondary">⚙️ Upgrade Mode</button>
  <button id="clearMessages" class="accent">🗑️ Clear</button>
</div>

<div id="upgradePanel" class="hidden">
  <h3>⚠️ Upgrade Mode Active</h3>
  <textarea id="upgradeInstructions" placeholder="Describe the changes to make..."></textarea>
  <button id="executeUpgrade">🚀 Execute Upgrade</button>
</div>

<button id="scrollButton" title="Scroll to bottom">↓</button>

<div id="status">Ready</div>
```

  </div>

  <script type="module" src="js/app.js"></script>

</body>
</html>
EOF

echo “✅ New index.html created”

# Create basic test file

echo “🧪 Creating test file…”
cat > frontend/tests/frontend.test.js << ‘EOF’
// Basic smoke tests
import { test } from ‘node:test’;
import assert from ‘node:assert’;

test(‘themes module exports required functions’, async () => {
// This would need proper module loading in a real test environment
assert.ok(true, ‘Placeholder test - implement with proper test runner’);
});

test(‘state module maintains proper structure’, async () => {
assert.ok(true, ‘Placeholder test - implement with proper test runner’);
});
EOF

echo “✅ Test file created”

echo “”
echo “=================================”
echo “✅ Migration Complete!”
echo “=================================”
echo “”
echo “Changes made:”
echo “  📁 Created frontend/styles/ with 3 CSS files”
echo “  📁 Created frontend/js/ with 6 JS modules”
echo “  📁 Created frontend/tests/ with test template”
echo “  📄 Replaced frontend/index.html with modular version”
echo “  💾 Created backup: frontend/index.backup.html”
echo “”
echo “Next steps:”
echo “  1. Review the changes”
echo “  2. Test locally if possible”
echo “  3. Commit and push to trigger CI/CD”
echo “”