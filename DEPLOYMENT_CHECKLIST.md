# OmniBot Deployment Checklist

Quick reference for deployments and troubleshooting.

## Pre-Deployment

### Local Development
- [ ] Make code changes
- [ ] Run `npm install` (if dependencies changed)
- [ ] Run `npm run build` (embeds frontend HTML)
- [ ] Run `npm test` (all tests pass)
- [ ] Test locally with `npx wrangler dev` (optional)

### Code Quality
- [ ] No console.log statements in production code
- [ ] Error handling in place
- [ ] Documentation updated if needed
- [ ] Commit messages are descriptive

## Staging Deployment (Automatic)

### Trigger
- Create PR to `main` branch
- Or push to `staging` or `develop` branches

### What Happens
GitHub Actions automatically:
1. ✅ Runs tests
2. ✅ Installs dependencies (`npm install`)
3. ✅ Builds consolidated worker (`npm run build`)
4. ✅ Verifies build output:
   - File exists and size >100KB
   - HTML is embedded (`<!DOCTYPE html>` present)
5. ✅ Deploys to staging via Wrangler
6. ✅ Post-deployment validation:
   - Health endpoint accessible
   - HTML UI served correctly
   - API endpoints responsive

### Manual Verification
```bash
# Quick check
./scripts/verify-deployment.sh staging

# Manual checks
curl -s https://omnibot-staging.jonanscheffler.workers.dev/api/health | jq
curl -s https://omnibot-staging.jonanscheffler.workers.dev/ | grep "Omnibot"
```

### What to Check
- [ ] Health endpoint returns `{"ok": true, "version": "..."}`
- [ ] UI loads in browser
- [ ] Theme switcher works
- [ ] Chat functionality works (if authenticated)
- [ ] No console errors in browser

## Production Deployment (Manual)

### Prerequisites
- [ ] Staging deployment is healthy
- [ ] Staging has been tested manually
- [ ] All tests pass
- [ ] Team/stakeholders notified

### Process
1. Go to GitHub Actions
2. Select "Promote Staging to Production" workflow
3. Click "Run workflow"
4. Type **"promote"** to confirm
5. Wait for workflow to complete

### What Happens
GitHub Actions:
1. ✅ Validates staging is healthy
2. ✅ Runs smoke tests on staging
3. ✅ Installs dependencies
4. ✅ Builds fresh consolidated worker
5. ✅ Verifies build output
6. ✅ Deploys to production
7. ✅ Comprehensive post-deployment validation

### Manual Verification
```bash
# Quick check
./scripts/verify-deployment.sh production

# Manual checks
curl -s https://omnibot.jonanscheffler.workers.dev/api/health | jq
curl -s https://omnibot.jonanscheffler.workers.dev/ | grep "Omnibot"
```

### What to Check
- [ ] Health endpoint returns correct version
- [ ] UI loads in browser
- [ ] All functionality works
- [ ] No errors in browser console
- [ ] Compare with staging to ensure consistency

## Troubleshooting

### Build Fails
```bash
# Check if dependencies are installed
npm install

# Try building locally
npm run build

# Check output
wc -c cloudflare-worker/src/index.js
grep -c "<!DOCTYPE html>" cloudflare-worker/src/index.js
```

**Expected:**
- File size: >100,000 bytes
- HTML count: 1 (embedded)

### Tests Fail
```bash
# Run tests with verbose output
npm test

# Check specific test file
npx mocha tests/structure-basic.test.js
```

### Deployment Fails
1. Check GitHub Actions logs for specific error
2. Verify secrets are configured:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Check Cloudflare dashboard for errors
4. Verify wrangler config files are correct

### Post-Deployment Validation Fails
```bash
# Wait for propagation (Cloudflare can take 30-60s)
sleep 60

# Check manually
curl -v https://omnibot-staging.jonanscheffler.workers.dev/api/health

# Run verification script
./scripts/verify-deployment.sh staging
```

**Common Issues:**
- **DNS propagation delay:** Wait 30-60 seconds
- **Cache issues:** Clear Cloudflare cache
- **Old code deployed:** Verify build step ran
- **Secrets missing:** Check GitHub Actions secrets

## Rollback Procedure

If production deployment fails or has issues:

### Option 1: Redeploy Previous Version
1. Find last good commit
2. Create new PR from that commit
3. Deploy to staging first
4. Promote to production

### Option 2: Quick Fix
1. Fix the issue in a new branch
2. Create PR
3. Deploy to staging
4. Verify fix works
5. Promote to production

### Option 3: Emergency Revert
```bash
# Locally checkout previous good version
git checkout <previous-commit-hash>

# Deploy directly (requires Wrangler credentials)
npm install
npm run build
cd cloudflare-worker
npx wrangler deploy
```

## Monitoring

### Key Metrics
- Health endpoint response time
- Error rates in Cloudflare dashboard
- User reports/feedback

### Health Check
Set up monitoring to ping:
- https://omnibot-staging.jonanscheffler.workers.dev/api/health
- https://omnibot.jonanscheffler.workers.dev/api/health

**Expected Response:**
```json
{
  "ok": true,
  "version": "v1.1.1 Electric Eel",
  "timestamp": "2025-12-11T..."
}
```

## Emergency Contacts

- **Cloudflare Issues:** Check status.cloudflare.com
- **GitHub Actions Issues:** Check www.githubstatus.com
- **Code Issues:** Create GitHub issue

## Quick Commands Reference

```bash
# Local development
npm install              # Install dependencies
npm run build           # Build consolidated worker
npm test                # Run all tests
npm run test:e2e        # Run E2E tests

# Verification
./scripts/verify-deployment.sh staging
./scripts/verify-deployment.sh production

# Manual deployment (requires credentials)
cd cloudflare-worker
npx wrangler deploy                              # Production
npx wrangler deploy --config wrangler.staging.toml  # Staging

# Debugging
npm run lint            # Check code style
npm run complexity      # Check code complexity
git log --oneline -10   # Recent commits
```

## See Also

- [DEPLOYMENT_POSTMORTEM.md](DEPLOYMENT_POSTMORTEM.md) - Recent pipeline improvements
- [BUILD_PROCESS.md](BUILD_PROCESS.md) - Detailed build process
- [README.md](README.md) - General documentation
