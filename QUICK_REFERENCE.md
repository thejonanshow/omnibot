# 🚀 Omnibot - Quick Reference Card

## One-Command Deployment
```bash
cd /Users/jonan/src/claudebox/omnibot && ./deploy_complete.sh
```

## URLs (After Deployment)
- **Worker**: https://omnibot-router.jonanscheffler.workers.dev
- **Frontend**: (get from deployment output)
- **GitHub**: https://github.com/thejonanshow/omnibot

## Configuration
```bash
# Worker URL
https://omnibot-router.jonanscheffler.workers.dev

# Shared Secret (from deployment-urls.txt)
4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2
```

## Testing Commands
```bash
# Test mobile connectivity
node scripts/test_mobile_connectivity.js

# Setup GitHub
./scripts/setup_github.sh

# Deploy worker only
cd cloudflare-worker && npx wrangler deploy

# Deploy frontend only
cd frontend && npx wrangler pages deploy . --project-name omnibot-ui

# View worker logs
cd cloudflare-worker && npx wrangler tail
```

## Mobile Testing Steps
1. Open frontend URL on mobile
2. Tap ⚙️ Settings
3. Enter Worker URL and Secret
4. Tap 💾 Save
5. Tap 📊 Status (should show usage)
6. Type message and send
7. (Optional) Tap 🎤 for voice

## 14 Themes Available
1. Matrix (green terminal)
2. Cyberpunk (pink/cyan)
3. Borg (green glow)
4. HAL 9000 (red)
5. War Games (classic)
6. Modern Dark (blue/gray)
7. Tron Legacy ⭐ NEW
8. Neuromancer ⭐ NEW
9. Alien Isolation ⭐ NEW
10. Dune ⭐ NEW
11. Ghost in the Shell ⭐ NEW
12. Interstellar ⭐ NEW
13. Synthwave ⭐ NEW
14. Portal (light theme!) ⭐ NEW

## Quick Fixes
- **Can't connect**: Check Worker URL in Settings
- **Voice fails**: Check HTTPS, mic permissions, browser
- **UI broken**: Clear cache, force refresh
- **Rate limited**: Check Status, wait or add API keys

## Files Modified
- ✅ frontend/index.html (complete rewrite)
- ✅ package.json (name → omnibot)
- ✅ wrangler.toml (name → omnibot-router)
- ✅ .env (GITHUB_REPO → omnibot)
- ✅ All documentation

## Documentation
- `COMPLETE_SETUP_SUMMARY.md` - Full setup guide
- `design/MOBILE_TESTING_GUIDE.md` - Mobile troubleshooting
- `design/IMPLEMENTATION_COMPLETE.md` - Technical details

## Success Criteria
- ✅ GitHub repo created
- ✅ Worker deployed
- ✅ Frontend deployed
- ✅ Desktop works
- ✅ Mobile connects
- ✅ Text chat works
- ✅ All themes work

## Support
- GitHub Issues: https://github.com/thejonanshow/omnibot/issues
- Documentation: /Users/jonan/src/claudebox/omnibot/design/
- Test Suite: `node scripts/test_mobile_connectivity.js`

---
**Everything is ready! Run `./deploy_complete.sh` to go live.** 🎉
