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

cat > frontend/styles/base.css << ‘EOFCSS’
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
EOFCSS

# Create themes.css with data-driven system

cat > frontend/styles/themes.css << ‘EOFCSS’
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
EOFCSS

# Create components.css

cat > frontend/styles/components.css << ‘EOFCSS’
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

```
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
```

}
EOFCSS

echo “✅ CSS files created”

echo “”
echo “=================================”
echo “✅ Migration Complete!”
echo “=================================”
echo “”
echo “Changes made:”
echo “  📁 Created frontend/styles/ with 3 CSS files”
echo “  📄 CSS syntax corrected (proper – variables)”
echo “  💾 Created backup: frontend/index.backup.html”
echo “”
echo “Next steps:”
echo “  1. Review the changes”
echo “  2. Test locally if possible”
echo “  3. Commit and push to trigger CI/CD”
echo “”
