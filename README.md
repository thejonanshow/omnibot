# 🎙️ Omnibot

Voice-controlled AI assistant with automatic provider rotation **that can upgrade itself!**

## 🚀 Modern Setup (Recommended)

```bash
# One-time setup
npm run setup

# Deploy the system  
npm run deploy

# Start the frontend
npm run start
```

**See [README-NPM.md](README-NPM.md) for complete npm commands documentation.**

## 🚀 Legacy Bash Deploy

```bash
cd /Users/jonan/src/claudebox/omnibot
./deploy.sh
```

**Enhanced deployment is now the default!** This includes function calling, web browsing, command execution, and shared context. For legacy mode without these features, use `./deploy.sh --basic`.

## 🤯 NEW: Self-Upgrade with Voice

Say **"upgrade mode"** then describe any change you want. The system will:
- ✅ Modify its own code
- ✅ Commit to GitHub
- ✅ Redeploy automatically
- ✅ **ZERO downtime**

Example: *"Add a dark mode theme"* → System upgrades itself in ~60 seconds!

[Read more about Self-Upgrade →](SELF-UPGRADE.md)

## ✨ Features

- 🔄 **Auto-rotates LLM providers** (Groq → Gemini → Claude → GPT)
- 🛠️ **Function calling** - LLMs can execute commands, browse web, manage files
- 🧠 **Shared context** - Persistent memory across sessions
- 🌐 **Web browsing** - Full headless browser capabilities with Playwright
- 💻 **Command execution** - Safe shell command execution
- 📁 **File operations** - Read, write, and manage files
- 🔐 **HMAC security** with challenge-response
- 🎤 **Voice input/output** (Web Speech API)
- 📊 **Usage tracking** per provider
- 🎨 **Matrix-themed UI**
- 💾 **Conversation history**
- 🔧 **Self-upgrading** (voice-controlled!)
- ⚡ **~500ms response time**
- 💰 **~$2/month cost**

## 📋 What You Need

### Required:
- Node.js (script installs if missing on Mac)
- Cloudflare account (free)

### API Keys (script opens dashboards):
- **Anthropic** - Claude models
- **OpenAI** - GPT models
- **Groq** - Free Llama (highly recommended!)
- **Google** - Gemini models

### Optional (for self-upgrade):
- **GitHub** - Token + repo for code changes
- **Cloudflare API** - Token for auto-deployment

### Optional (for voice):
- **Runloop** - Whisper STT + Piper TTS

## 🎯 What Happens When You Deploy

The `./deploy.sh` script:
1. ✅ Checks dependencies (installs if needed)
2. ✅ Prompts for API keys (opens browser dashboards)
3. ✅ Asks about self-upgrade (optional but recommended!)
4. ✅ Generates security keys
5. ✅ Creates Cloudflare KV namespaces
6. ✅ Deploys Worker (LLM router)
7. ✅ Deploys Frontend (voice UI)
8. ✅ Optional: Deploys to Runloop (voice services)
9. ✅ Returns production URLs

**Takes ~5 minutes. Zero manual configuration.**

## 💰 Cost

- Groq (primary): **FREE** unlimited
- Gemini (backup): **FREE** 15 RPM
- Claude/GPT overages: ~$2/month
- Cloudflare Workers & Pages: **FREE**
- Self-upgrades: ~$0.01 each

**Total: ~$2/month**

## 🎤 After Deployment

1. Open frontend URL
2. Click Settings ⚙️
3. Enter Router URL + Shared Secret
4. Click 🎤 Speak
5. Start talking!

## 🔧 Self-Upgrade Usage

### Method 1: Voice
```
Say: "upgrade mode"
Say: "add a retry button"
Wait: 60 seconds
Done: New feature live!
```

### Method 2: Button
1. Click **🔧 Upgrade** button
2. Speak your change
3. System upgrades itself

### Examples:
- *"Add dark mode theme"*
- *"Make buttons larger"*
- *"Add export conversation button"*
- *"Change colors to blue"*

## 📁 Project Structure

```
omnibot/
├── deploy.sh                  # ONE COMMAND - Deploy everything
├── setup.sh                   # Interactive setup
├── cloudflare-worker/         # LLM router
│   ├── src/
│   │   ├── index.js          # Main router (250 lines)
│   │   └── upgrade.js        # Self-upgrade logic (150 lines)
│   └── package.json
├── frontend/
│   └── index.html            # Voice UI with upgrade button
└── scripts/
    └── deploy_runloop.py     # Optional voice services
```

## 🔄 How Self-Upgrade Works

```
Voice → Worker → GitHub API → Claude analyzes code
                             → Returns changes
             → Worker commits changes
             → Triggers deployment
             → New version live (old still running)
             → Traffic switches
             → ZERO DOWNTIME ✓
```

## 📊 Commands

```bash
./deploy.sh     # Deploy everything
./setup.sh      # Setup API keys only
./test.sh       # Verify installation
./start.sh      # Show welcome banner
```

## 🐛 Troubleshooting

### Voice not working
- Grant microphone permissions
- Use Chrome or Edge
- Check Settings → Router URL

### Self-upgrade disabled
```bash
./setup.sh
# Answer 'y' to self-upgrade capability
```

### API key invalid
```bash
./setup.sh  # Re-run to update keys
```

## 🎓 How It Works

**Normal Mode:**
1. Browser → Speech to text
2. UI → Worker (HMAC auth)
3. Worker → Groq (tries first)
4. If limit → Gemini
5. If limit → Claude
6. Response → Browser → Speech

**Upgrade Mode:**
1. Say "upgrade mode"
2. Describe change
3. Worker gets current code from GitHub
4. Sends to Claude API with context
5. Claude generates changes
6. Worker commits to GitHub
7. Worker triggers Cloudflare deployment
8. New version goes live (~60s)
9. Old version removed
10. Zero downtime! ✓

## 🤝 Contributing

**Use the system to improve itself!**

Just say: *"upgrade mode"* then describe your improvement.
The system will modify its own code and redeploy.

## 📄 License

MIT

---

## 🎉 Quick Start

```bash
cd /Users/jonan/src/claudebox/omnibot
./deploy.sh
```

Takes ~5 minutes. Returns production URL. Start talking! 🎤

Want to modify the system? Just say: **"upgrade mode"** 🤯
