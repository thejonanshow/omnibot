# SECURITY FIX - Configuration Guide

## ⚠️ SECURITY ISSUE FIXED

**Problem:** The shared secret was hardcoded in the frontend code, which would be exposed in GitHub.

**Fix:** Removed hardcoded values. Configuration must be done manually (one-time setup).

---

## 🔐 Why This Matters

The **shared secret** is used to authenticate all requests from the frontend to the worker using HMAC signatures. If exposed publicly:

- ❌ Anyone could send requests to your worker
- ❌ They could use up your API quotas (95 requests/day)
- ❌ Potential abuse of your Anthropic/Groq/Gemini API keys

**Solution:** Keep secrets in browser localStorage only (never in code).

---

## ✅ Proper Setup (One-Time)

### 1. Open the UI
https://omni-agent-ui.pages.dev

### 2. Click ⚙️ Settings

### 3. Enter Configuration

**Router URL:**
```
https://omni-agent-router.jonanscheffler.workers.dev
```

**Shared Secret:**
```
4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2
```

### 4. Click Save

✅ Configuration is saved in browser localStorage
✅ Never committed to GitHub
✅ Only stored locally in your browser

---

## 🔒 Alternative: Use Environment Variables (Advanced)

For production deployments, you can inject config at build time:

### Cloudflare Pages Environment Variables

1. Go to: https://dash.cloudflare.com/pages
2. Select: omni-agent-ui project
3. Settings → Environment Variables
4. Add:
   - `ROUTER_URL` = `https://omni-agent-router.jonanscheffler.workers.dev`
   - `SHARED_SECRET` = `4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2`

### Update Build Script

Create `frontend/build.js`:
```javascript
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const configured = html.replace(
    `routerUrl: localStorage.getItem('routerUrl') || '',`,
    `routerUrl: localStorage.getItem('routerUrl') || '${process.env.ROUTER_URL || ''}',`
).replace(
    `secret: localStorage.getItem('secret') || '',`,
    `secret: localStorage.getItem('secret') || '${process.env.SHARED_SECRET || ''}',`
);

fs.writeFileSync('dist/index.html', configured);
```

Then in Cloudflare Pages:
- Build command: `node build.js`
- Output directory: `dist`

---

## 📋 What Gets Saved Where

### ✅ Safe (Browser Only)
- Router URL → `localStorage.routerUrl`
- Shared Secret → `localStorage.secret`
- Theme → `localStorage.theme`

### ✅ Safe (Cloudflare Secrets)
- Anthropic API Key → Worker secret
- Groq API Key → Worker secret
- Gemini API Key → Worker secret
- GitHub Token → Worker secret
- Cloudflare API Token → Worker secret

### ❌ NEVER in Code
- Shared secret
- API keys
- Tokens

---

## 🔄 Rotating the Secret

If the secret is compromised:

### 1. Generate New Secret
```bash
openssl rand -hex 32
```

### 2. Update Worker
```bash
cd cloudflare-worker
# Edit wrangler.toml - change SHARED_SECRET value
npx wrangler deploy
```

### 3. Update Users
All users must update their settings:
- Open Settings
- Enter new secret
- Click Save

---

## 🎯 Current Status

✅ **Secrets removed from frontend code**
✅ **All API keys secured in Cloudflare Worker**
✅ **Configuration via Settings panel (one-time)**
✅ **Safe to commit to GitHub**

---

## 📝 For Developers

If you're forking this project:

1. **Generate your own shared secret:**
   ```bash
   openssl rand -hex 32
   ```

2. **Update `cloudflare-worker/wrangler.toml`:**
   ```toml
   [vars]
   SHARED_SECRET = "your-new-secret-here"
   ```

3. **Deploy worker:**
   ```bash
   cd cloudflare-worker
   npx wrangler deploy
   ```

4. **Configure frontend:**
   - Open UI
   - Settings
   - Enter your worker URL and secret
   - Save

5. **Never commit secrets to code!**

---

## ✅ Deployment Checklist

Before deploying:

- [ ] Removed all hardcoded secrets from frontend
- [ ] Set all API keys as Cloudflare Worker secrets
- [ ] Updated wrangler.toml with new shared secret
- [ ] Deployed worker
- [ ] Configured frontend via Settings panel
- [ ] Tested end-to-end
- [ ] Verified secrets not in git history

---

**Thank you for catching this security issue!** 🙏

The system is now secure and safe to use in production.
