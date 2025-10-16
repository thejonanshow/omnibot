# 🚀 Omnibot Deployment Guide

## Multi-Environment Deployment (dev → staging → production)

Omnibot uses a modern three-tier deployment strategy:
- **dev**: Development testing, unstable builds
- **staging**: Pre-production testing, stable builds  
- **production**: Live production environment

## 🔐 Security First - NO API Keys in Git!

All API keys and secrets are stored in Cloudflare Workers secrets, **NEVER** in Git.

### Initial Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env and add your API keys:**
   ```bash
   # Edit with your actual values
   nano .env  # or your preferred editor
   ```

3. **Create KV namespaces:**
   ```bash
   npm run setup:kv
   ```

4. **Push secrets to Cloudflare:**
   ```bash
   npm run setup:secrets
   ```
   This pushes your API keys from .env to Cloudflare Workers secrets for all environments.

## 🚀 Deployment Workflow

### Step 1: Deploy to Development
```bash
npm run deploy:dev
```

Test the deployment:
```bash
npm run test:dev
```

### Step 2: Promote to Staging
```bash
npm run promote:dev
# This runs: deploy to staging
```

Test staging:
```bash
npm run test:staging
```

**Test on mobile device!** Open staging URL on your phone and verify:
- Connection works
- Text chat works
- Voice works (if supported)
- All themes work
- UI is responsive

### Step 3: Promote to Production
```bash
npm run promote:staging
# This runs: deploy to production
```

Test production:
```bash
npm run test:prod
```

## 📋 Deployment URLs

After each deployment, URLs are saved to `deployment-<env>.json`:

- **dev**: `https://omnibot-router-dev.jonanscheffler.workers.dev`
- **staging**: `https://omnibot-router-staging.jonanscheffler.workers.dev`  
- **production**: `https://omnibot-router.jonanscheffler.workers.dev`

Frontends:
- **dev**: `https://omnibot-ui-dev.pages.dev`
- **staging**: `https://omnibot-ui-staging.pages.dev`
- **production**: `https://omnibot-ui.pages.dev`

## 🧪 Testing Each Environment

```bash
# Test development
npm run test:dev

# Test staging
npm run test:staging

# Test production
npm run test:prod
```

Tests check:
- ✅ Worker health
- ✅ CORS headers
- ✅ Authentication
- ✅ All endpoints
- ✅ Response times
- ✅ Security

## 🔄 Rollback Strategy

If production has issues:

1. **Emergency**: Redeploy previous staging
   ```bash
   npm run deploy:prod
   # Use previous commit or backup
   ```

2. **Hotfix**: Fix in dev, test, promote
   ```bash
   # Fix the issue
   npm run deploy:dev
   npm run test:dev
   npm run promote:dev
   npm run test:staging
   npm run promote:staging
   ```

## 📦 What Gets Deployed

### Worker (Cloudflare Workers)
- `cloudflare-worker/src/index.js` - Main router
- `cloudflare-worker/src/upgrade.js` - Self-upgrade system
- KV Namespaces (separate per environment)
- Secrets (separate per environment)

### Frontend (Cloudflare Pages)
- `frontend/index.html` - Complete UI
- All 14 themes
- Mobile-responsive design

## 🔐 Security Checklist

Before any deployment:
- [ ] .env file is NOT in Git (.gitignore)
- [ ] No API keys in wrangler.toml
- [ ] All secrets pushed to Cloudflare
- [ ] deployment-urls.txt is NOT in Git
- [ ] deployment-*.json files NOT in Git

Run this to verify:
```bash
git status
# Should NOT show:
# - .env
# - deployment-urls.txt
# - deployment-*.json
```

## 📱 Mobile Testing Checklist

Test on actual devices:
- [ ] iOS Safari
- [ ] iOS Chrome
- [ ] Android Chrome
- [ ] Android Samsung Internet

For each:
- [ ] Can access frontend
- [ ] Can connect to worker
- [ ] Status shows usage
- [ ] Can send messages
- [ ] Can receive responses
- [ ] Voice button appears
- [ ] (Optional) Voice works
- [ ] All themes render
- [ ] UI is responsive

## 🎯 Deployment Flow Diagram

```
┌─────────────┐
│     DEV     │  ← Deploy & test new features
│   omnibot-  │  
│   router-   │
│    dev      │
└──────┬──────┘
       │ promote:dev
       ↓
┌─────────────┐
│   STAGING   │  ← Pre-production testing
│   omnibot-  │     Test on mobile!
│   router-   │
│   staging   │
└──────┬──────┘
       │ promote:staging
       ↓
┌─────────────┐
│ PRODUCTION  │  ← Live for users
│   omnibot-  │
│   router    │
└─────────────┘
```

## 🔧 Troubleshooting

### "Secrets not found"
```bash
npm run setup:secrets
```

### "KV namespace not found"
```bash
npm run setup:kv
```

### "Deployment failed"
```bash
# Check wrangler login
cd cloudflare-worker
npx wrangler whoami

# Re-login if needed
npx wrangler login
```

### "Tests failing"
- Check worker URL is correct
- Verify secrets are pushed
- Check Cloudflare dashboard for errors
- View logs: `cd cloudflare-worker && npx wrangler tail --env <environment>`

## 📚 Commands Reference

```bash
# Setup (once)
npm run setup              # Create KV + push secrets
npm run setup:kv          # Create KV namespaces only
npm run setup:secrets     # Push secrets only

# Deploy
npm run deploy:dev        # Deploy to development
npm run deploy:staging    # Deploy to staging
npm run deploy:prod       # Deploy to production
npm run deploy            # Alias for deploy:prod

# Test
npm run test:dev          # Test development
npm run test:staging      # Test staging
npm run test:prod         # Test production
npm run test:mobile       # Alias for test:prod

# Promote
npm run promote:dev       # Promote dev → staging
npm run promote:staging   # Promote staging → production

# GitHub
npm run github:setup      # Create repo and push code
```

## 🎉 Quick Start (First Time)

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 2. Setup Cloudflare
npm run setup

# 3. Deploy to dev
npm run deploy:dev

# 4. Test dev
npm run test:dev

# 5. Promote to staging
npm run promote:dev

# 6. Test staging (including mobile!)
npm run test:staging

# 7. Promote to production
npm run promote:staging

# 8. Test production
npm run test:prod

# Done! 🎉
```

## 📈 Monitoring

Monitor deployments at:
- Cloudflare Dashboard: https://dash.cloudflare.com
- Workers: Check logs and analytics
- Pages: Check deployment history

## 🆘 Emergency Contacts

If production is down:
1. Check Cloudflare status: https://www.cloudflarestatus.com
2. View worker logs: `npx wrangler tail --env production`
3. Rollback if needed: Redeploy previous version
4. Check GitHub issues: https://github.com/thejonanshow/omnibot/issues

---

**Remember: Development → Staging → Production. Always test before promoting!**
