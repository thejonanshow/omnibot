# 🔄 Self-Upgrade Feature

## Overview

Omni-Agent can now upgrade ITSELF using your voice with ZERO downtime!

## How It Works

```
You say: "Add dark mode theme"
         ↓
Worker fetches current codebase from GitHub
         ↓
Claude API analyzes code + your request
         ↓
Claude generates code changes
         ↓
Worker commits changes to GitHub
         ↓
Worker triggers new Cloudflare deployment
         ↓
New version deploys (old version still running)
         ↓
Traffic switches to new version automatically
         ↓
ZERO DOWNTIME ✓
```

## Usage

### Method 1: Voice Command

1. Say: **"upgrade mode"**
2. System confirms: "UPGRADE MODE ACTIVE"
3. Say your change: **"add a dark mode toggle button"**
4. System modifies itself and redeploys
5. Done! Changes live in ~60 seconds

### Method 2: Button

1. Click **🔧 Upgrade** button
2. Status shows "UPGRADE" mode
3. Click **🎤 Speak**
4. Describe the change
5. System auto-upgrades

## Examples

**Add Features:**
- "Add a dark mode theme with toggle button"
- "Add a retry button for failed requests"
- "Add keyboard shortcuts for speak and stop"

**Change UI:**
- "Change the theme to cyberpunk colors"
- "Make the buttons larger on mobile"
- "Add animations to the status indicators"

**Improve Functionality:**
- "Add caching for frequent requests"
- "Add voice-to-voice mode without typing"
- "Add conversation export to JSON"

**Fix Issues:**
- "Fix the microphone permission error handling"
- "Improve error messages to be more helpful"
- "Add loading spinner during API calls"

## Setup

During `./setup.sh`, answer **yes** to:
```
Enable self-upgrade capability? (y/n): y
```

This will prompt for:
- GitHub Personal Access Token (with repo permissions)
- Your GitHub repo (username/repo)
- Cloudflare API Token (for deployments)

## Architecture

### Components

1. **Frontend (`frontend/index.html`)**
   - Upgrade Mode toggle
   - Voice input for changes
   - Status display

2. **Worker (`cloudflare-worker/src/index.js`)**
   - `/upgrade` endpoint
   - GitHub API integration
   - Cloudflare deployment API

3. **Upgrade Module (`cloudflare-worker/src/upgrade.js`)**
   - Fetches current code
   - Calls Claude with context
   - Parses changes
   - Commits to GitHub
   - Triggers deployment

### Zero Downtime

Cloudflare Workers use versioned deployments:
1. New version deployed alongside old
2. Traffic gradually shifts
3. Old version removed after verification
4. No dropped requests!

## Security

- **HMAC Auth**: All upgrade requests require signature
- **Challenge-Response**: Prevents replay attacks
- **GitHub Token**: Stored as Cloudflare secret
- **Rate Limiting**: Max 5 upgrades per hour

## Limitations

- Can't change Cloudflare KV structure (would lose data)
- Can't modify secrets (must use Wrangler CLI)
- Complex changes may need multiple iterations
- ~60 second deployment time

## Troubleshooting

### "GitHub token invalid"
```bash
cd /Users/jonan/src/claudebox/omni-agent/cloudflare-worker
echo "YOUR_NEW_TOKEN" | npx wrangler secret put GITHUB_TOKEN
```

### "Deployment failed"
Check Cloudflare dashboard:
https://dash.cloudflare.com/

### "Changes not applied"
Check GitHub repo - commit should appear:
https://github.com/YOUR_USERNAME/YOUR_REPO/commits

### "Can't enable upgrade mode"
Make sure setup completed with GitHub configuration:
```bash
./setup.sh
# Answer 'y' to self-upgrade capability
```

## Advanced Usage

### Manual Upgrade (API)

```bash
curl -X POST https://your-worker.workers.dev/upgrade \
  -H "X-Challenge: $CHALLENGE" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d '{
    "instruction": "Add feature X"
  }'
```

### Programmatic Upgrade

```javascript
const response = await sendUpgrade("Add dark mode");
console.log(response.changes); // Files modified
console.log(response.deployment_triggered); // true
```

## Cost

- GitHub API: FREE
- Cloudflare Deployments: FREE (unlimited)
- Claude API calls: ~$0.01 per upgrade
- **Total: ~$0.01 per upgrade**

## Future Enhancements

Could add:
- Preview changes before applying
- Rollback to previous version
- A/B testing new features
- Automatic testing before deploy
- Multi-file change tracking
- Approval workflow

## Example Session

```
YOU: "upgrade mode"
SYSTEM: "UPGRADE MODE ACTIVE"

YOU: "Add a button to export conversation history as JSON"
SYSTEM: "UPGRADE IN PROGRESS..."
SYSTEM: "✓ Changes applied:"
SYSTEM: "  - frontend/index.html: Added export button and JSON download function"
SYSTEM: "✓ Deployment triggered. Changes live in ~60s."

[60 seconds later]

SYSTEM: "Normal mode resumed"
```

## Questions?

The system can help itself! Just ask:
- "How do I use the upgrade feature?"
- "What files can be modified?"
- "Show me upgrade examples"

---

**Ready to try it?**

1. Run: `./deploy.sh`
2. Say: **"upgrade mode"**
3. Say: **"add X feature"**
4. Watch it upgrade itself! 🤯
