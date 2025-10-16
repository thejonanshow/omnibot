# 🚀 Omnibot Staging Frontend - Configuration Guide

## Deployment Complete! ✅

### Frontend URLs
- **Staging:** https://omnibot-ui-staging.pages.dev
- **Production:** https://omni-agent-ui.pages.dev (existing)

### Backend URLs
- **Staging Worker:** https://omnibot-router-staging.jonanscheffler.workers.dev
- **Production Worker:** https://omnibot-router.jonanscheffler.workers.dev

---

## 📝 Settings Configuration for Staging

When you open the staging frontend, click **⚙️ Settings** and enter:

### Required Settings
```
Router URL: https://omnibot-router-staging.jonanscheffler.workers.dev
Shared Secret: [Get from .env file - SHARED_SECRET value]
```

**⚠️ SECURITY NOTE:** Never commit the shared secret to git or include it in documentation. Always retrieve it from your local `.env` file.

### Theme Options
Choose from 14 sci-fi themes:
- Matrix (Green Terminal) - Default
- Cyberpunk (Neon Pink/Cyan)
- Borg (Assimilation Green)
- HAL 9000 (Menacing Red)
- War Games (Classic Green)
- Modern Dark (Blue/Gray)
- Tron Legacy (Electric Blue)
- Neuromancer (Purple Cyberspace)
- Alien Isolation (CRT Green)
- Dune (Desert & Spice)
- Ghost in the Shell (Holographic)
- Interstellar (Deep Space)
- Synthwave (Retro Neon)
- Portal (Aperture Science)

---

## 🔄 Deployment Workflow

### New Standard Process

1. **Default Deploy → Staging**
   ```bash
   cd /Users/jonan/src/claudebox/omnibot
   ./deploy.sh
   # or explicitly:
   ./deploy.sh staging
   ```

2. **Test on Staging**
   - Open https://omnibot-ui-staging.pages.dev
   - Configure settings with staging URLs
   - Test all features
   - Verify LLM rotation
   - Test voice input
   - Test upgrade mode

3. **Promote to Production** (requires confirmation)
   ```bash
   ./deploy.sh production
   # Type: DEPLOY TO PRODUCTION
   ```

### Safety Features
- ✅ Tests must pass before deployment
- ✅ Production deploys require explicit confirmation
- ✅ Staging is the default environment
- ✅ Each environment has isolated KV namespaces
- ✅ Each environment has its own secrets

---

## 🧪 Testing Checklist

Before promoting staging to production, verify:

- [ ] Frontend loads correctly
- [ ] Settings save successfully
- [ ] Authentication works (challenge/response)
- [ ] Text chat messages send and receive
- [ ] Voice input works (microphone permission)
- [ ] Live transcription overlay appears
- [ ] LLM provider rotation functions
- [ ] Usage limits are tracked
- [ ] Status button shows correct data
- [ ] Theme changes apply correctly
- [ ] Secondary action buttons (Code, Translate, Swarm, Upgrade) toggle
- [ ] Upgrade mode can be activated
- [ ] Error messages display properly
- [ ] Mobile responsive design works

---

## 📊 Environment Comparison

| Feature | Staging | Production |
|---------|---------|------------|
| Worker | omnibot-router-staging | omnibot-router |
| Frontend | omnibot-ui-staging | omni-agent-ui |
| KV Namespaces | Isolated staging data | Production data |
| Secrets | Same as production | Production values |
| Purpose | Testing & validation | Live user traffic |

---

## 🔧 Quick Commands

```bash
# Deploy to staging (default)
./deploy.sh

# Deploy to production (with confirmation)
./deploy.sh production

# Run tests only
npm test

# Check deployment status
cat deployment-staging.txt
cat deployment-production.txt

# View worker logs (staging)
cd cloudflare-worker
npx wrangler tail --env staging

# View worker logs (production)
npx wrangler tail --env production
```

---

## 🚨 Rollback Plan

If production deployment has issues:

```bash
cd cloudflare-worker
npx wrangler rollback --env production
```

Or redeploy the last known good version from git.

---

## 🔐 Security Notes

- Shared secret is stored in `.env` - never commit this file
- Each environment has isolated KV storage
- API keys are configured as Cloudflare secrets
- No sensitive data in frontend code
- HMAC signature required for all API requests

---

## 📱 Mobile Testing

Test on multiple devices:
- iOS Safari
- Android Chrome  
- Desktop Chrome
- Desktop Firefox
- Desktop Safari

Check:
- Voice input on mobile
- Touch targets (44px minimum)
- Keyboard behavior
- Orientation changes
- Scroll performance

---

## 🎯 Success Criteria

Before production deploy, ensure:
1. ✅ All 56 tests passing
2. ✅ Staging frontend functional
3. ✅ Backend API responding
4. ✅ Authentication working
5. ✅ No console errors
6. ✅ Mobile experience smooth
7. ✅ Voice input reliable
8. ✅ Theme switching works

---

## 📞 Quick Links

- **Staging Frontend:** https://omnibot-ui-staging.pages.dev
- **Staging API:** https://omnibot-router-staging.jonanscheffler.workers.dev
- **GitHub Repo:** https://github.com/thejonanshow/omnibot
- **Cloudflare Dashboard:** https://dash.cloudflare.com

---

**Next Steps:**
1. Open staging frontend
2. Configure settings (get shared secret from .env)
3. Test all features
4. If everything works, run `./deploy.sh production`
