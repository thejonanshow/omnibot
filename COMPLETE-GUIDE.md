# OMNI-AGENT - COMPLETE GUIDE

## 🎨 **NEW: 6 Sci-Fi Themes!**

Your UI now has **6 different themes** selectable in Settings:

### 1. **Matrix** (Default) 🟢
Classic green terminal like The Matrix
- Background: Pure black
- Text: Neon green (#0f0)
- Perfect for: Feeling like Neo

### 2. **Cyberpunk** 💜💙
Neon pink and cyan like Blade Runner/Cyberpunk 2077
- Background: Deep blue-black
- Text: Magenta (#ff00ff) and Cyan (#00ffff)
- Perfect for: Night City vibes

### 3. **Borg** 🟩
"We are the Borg. You will be assimilated."
- Background: Dark gray
- Text: Bright green with glow effects
- Perfect for: Star Trek fans

### 4. **HAL 9000** 🔴
"I'm sorry Dave, I'm afraid I can't do that."
- Background: Pure black
- Text: Red (#ff0000)
- Perfect for: 2001: A Space Odyssey aesthetic

### 5. **War Games** 🟢
Classic 80s computer terminal
- Background: Black
- Text: Classic terminal green
- Perfect for: "Shall we play a game?"

### 6. **Modern Dark** 🔵
Clean, modern interface like Claude
- Background: Modern dark gray
- Text: White/blue
- Perfect for: Professional use

---

## 🎤 **Microphone Fix**

### The Problem
You got: `Speech recognition error: service-not-allowed`

### Why It Happens
- Speech recognition requires **HTTPS** (✅ you have this via Cloudflare Pages)
- Browser needs **explicit permission** from you
- Some browsers are more strict than others

### The Fix
The new UI handles this properly now:

1. **First time you click 🎤 Voice:**
   - Browser will show permission dialog
   - Click "Allow" to grant mic access
   
2. **If you accidentally blocked it:**
   - **Chrome/Edge:** Click 🔒 in address bar → Site settings → Microphone → Allow
   - **Firefox:** Click 🔒 in address bar → Permissions → Microphone → Allow
   - **Safari:** Safari → Settings → Websites → Microphone → Allow

3. **Better error messages:**
   - UI now shows helpful instructions if mic fails
   - No more cryptic "service-not-allowed" - you'll see:
     ```
     🎤 Microphone access required. Please allow microphone 
     permissions in your browser settings.
     
     Chrome: Click the 🔒 icon in address bar → Site settings 
     → Microphone → Allow
     ```

---

## 🔧 **WHAT UPGRADE MODE ACTUALLY DOES**

### Overview
**Upgrade Mode** is a self-modifying AI system that lets you change Omni-Agent itself using natural language commands.

### How It Works

#### 1. **You Activate Upgrade Mode**
- Click the **🔧 Upgrade** button
- UI turns yellow/warning colors
- Status shows "UPGRADE" mode

#### 2. **You Give A Command**
Type or speak what you want changed:
- "Add a dark mode toggle"
- "Make the microphone button bigger"
- "Add a feature to export chat history"
- "Change the theme colors to blue"

#### 3. **Behind The Scenes**
The system executes this workflow:

```
1. Pull Current Codebase
   ↓
   Fetch all files from GitHub repo
   (frontend/index.html, worker/src/index.js, etc.)

2. Analyze with AI
   ↓
   Send your instruction + current code to Claude API
   "User wants: [your request]"
   "Current code: [entire codebase]"
   "Generate necessary changes"

3. Generate Changes
   ↓
   AI decides which files to modify
   Creates diffs/patches
   Writes new code

4. Create Pull Request
   ↓
   Push changes to new branch on GitHub
   Create PR with description
   Tag with "auto-upgrade"

5. Auto-Deploy
   ↓
   If changes pass safety checks:
     - Merge PR automatically
     - Cloudflare Pages detects commit
     - Deploys new version (~60 seconds)
   
   If risky:
     - PR stays open for manual review
     - You approve/reject on GitHub
```

#### 4. **You Get Feedback**
```
✅ UPGRADE SUCCESSFUL
  • frontend/index.html: Added dark mode toggle
  • cloudflare-worker/src/index.js: Added endpoint
🚀 Deployment in progress (~60s)
```

### Technical Implementation

Located in: `cloudflare-worker/src/upgrade.js`

```javascript
async function handleUpgrade(request, env) {
  const { instruction } = await request.json();
  
  // 1. Get current codebase
  const files = await getCodebaseContext(env);
  
  // 2. Ask Claude to generate changes
  const changes = await callClaude({
    instruction,
    currentCode: files,
    systemPrompt: "You are a code modification AI..."
  });
  
  // 3. Create PR on GitHub
  const pr = await createGitHubPR({
    changes,
    branch: `auto-upgrade-${Date.now()}`,
    message: instruction
  });
  
  // 4. Auto-merge if safe
  if (isSafeChange(changes)) {
    await mergeGitHubPR(pr.number);
  }
  
  return { success: true, changes, pr };
}
```

### Safety Features

1. **Validation:**
   - Syntax checking before committing
   - Security scan for malicious code
   - File size limits

2. **Rollback:**
   - Every change is a Git commit
   - Can revert via GitHub
   - Previous version always available

3. **Manual Review:**
   - Complex changes stay as PR
   - You review on GitHub first
   - Only simple changes auto-merge

### Example Uses

#### Example 1: Add Feature
```
YOU: "Add a button to clear the conversation history"

SYSTEM DOES:
1. Adds clearHistory() function to frontend
2. Adds <button> element to HTML
3. Styles button to match theme
4. Deploys changes

RESULT: New "Clear" button appears in UI
```

#### Example 2: Fix Bug
```
YOU: "The voice button doesn't work on mobile"

SYSTEM DOES:
1. Analyzes mobile speech recognition code
2. Adds touch event handlers
3. Updates CSS for mobile viewport
4. Tests on mobile user agent
5. Deploys fix

RESULT: Voice works on phones
```

#### Example 3: Change Design
```
YOU: "Make the chat messages look like iMessage bubbles"

SYSTEM DOES:
1. Updates CSS for .message class
2. Adds border-radius, shadows
3. Changes color scheme
4. Adjusts spacing
5. Deploys

RESULT: Chat looks like iMessage
```

### Limitations

**Cannot Do:**
- Access your local files (only GitHub repo)
- Make changes to Cloudflare account settings
- Modify API keys or secrets
- Change domain/DNS settings
- Access other services

**Can Do:**
- Modify any file in the GitHub repo
- Add new files
- Delete files
- Change UI/UX
- Add new features
- Fix bugs
- Refactor code

---

## 🚀 **Quick Start**

### 1. Open UI
https://omni-agent-ui.pages.dev

### 2. Choose Theme
- Click **⚙️ Settings**
- Select theme from dropdown
- Options: Matrix, Cyberpunk, Borg, HAL, War Games, Modern

### 3. Configure
- Router URL: `https://omni-agent-router.jonanscheffler.workers.dev`
- Secret: `4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2`
- Click **Save**

### 4. Grant Mic Permission (First Time)
- Click **🎤 Voice**
- Allow mic when prompted
- Button turns red while recording

### 5. Chat!
- **Text:** Type and press Enter
- **Voice:** Click 🎤, speak, auto-sends
- **Status:** Click 📊 to see API usage

### 6. Try Upgrade Mode
- Click **🔧 Upgrade**
- UI turns yellow
- Type: "Add a countdown timer to the UI"
- Wait ~60 seconds
- New feature appears!

---

## 📊 **API Usage**

Check which AI is handling requests:
- **Groq** (Llama 3.3): 30/day - Fast
- **Gemini** (1.5 Flash): 15/day - Google
- **Claude** (Haiku): 50/day - Anthropic

System automatically rotates based on availability.

---

## 🎯 **Keyboard Shortcuts**

- **Enter**: Send message
- **Shift+Enter**: New line in message
- **Esc**: Close settings panel

---

## 🐛 **Troubleshooting**

### Voice Not Working
1. Check browser compatibility (Chrome/Edge best)
2. Verify HTTPS (should be ✅ on Pages)
3. Allow mic permissions
4. Try reloading page

### Upgrade Mode Failing
1. Check GitHub token is valid
2. Verify repo permissions
3. Check Cloudflare API token
4. Review GitHub for failed PR

### Theme Not Changing
1. Make sure you clicked Save
2. Reload page
3. Check browser console for errors

---

## 🔐 **Security**

- API keys stored as Cloudflare secrets (not in code)
- Challenge-response authentication
- HMAC SHA-256 signatures
- Time-based validation (60s expiry)
- HTTPS everywhere

---

## 📱 **Mobile Support**

All themes work on mobile:
- Responsive design
- Touch-friendly buttons
- Mobile keyboard support
- Voice works on iOS/Android

---

## 💡 **Pro Tips**

1. **Theme Selection:**
   - Matrix for 24/7 hacking vibes
   - Modern for professional screenshots
   - HAL for intimidation factor

2. **Voice vs Text:**
   - Use voice when you want audio responses
   - Use text for silent operation
   - Mix both as needed

3. **Upgrade Mode:**
   - Start small: "Change button colors"
   - Build up to: "Add entire new features"
   - Review PRs on GitHub for learning

---

**Ready to hack the planet?** 🚀

Open: https://omni-agent-ui.pages.dev
