# OmniBot Build Process

## Overview

OmniBot uses a consolidated build approach where the frontend HTML is embedded directly into the Cloudflare Worker. This ensures that all changes to both the worker logic and the UI are deployed together as a single atomic unit.

## Architecture

### Source Files
- **Frontend UI**: `frontend/index.html` - The source of truth for the UI
- **Worker Logic**: `cloudflare-worker/src/index.js` - Contains both worker code and embedded HTML

### Build Process
The build process (`scripts/build-consolidated-worker.js`) does the following:
1. Reads the frontend HTML from `frontend/index.html`
2. Embeds it into the worker's `const HTML` template literal
3. Writes the consolidated worker back to `cloudflare-worker/src/index.js`

## Making Changes

### To modify the UI:
1. Edit `frontend/index.html`
2. Run `npm run build` to embed it into the worker
3. Test locally with `npm test`
4. Commit both files

### To modify the worker logic:
1. Edit `cloudflare-worker/src/index.js` (avoid editing the HTML section)
2. Run `npm test` to verify
3. Commit changes

## Deployment

All deployments automatically build the consolidated worker with comprehensive validation:

### Staging Deployment (Automatic)
1. Push to a branch and create a PR to `main`
2. GitHub Actions automatically:
   - Runs tests (`npm test`)
   - Installs dependencies (`npm install`)
   - Builds consolidated worker (`npm run build`)
   - Verifies build output:
     * File exists
     * Size >100KB (ensures HTML is embedded)
     * Contains `<!DOCTYPE html>`
   - Deploys to staging environment via Wrangler
   - Post-deployment validation:
     * Health endpoint returns `{"ok":true}`
     * HTML UI is served at root path
     * API endpoints are accessible
     * Version information is present

### Production Deployment (Manual)
1. Verify staging deployment is healthy
2. Manually trigger "Promote Staging to Production" workflow
3. Type "promote" to confirm
4. GitHub Actions:
   - Validates staging is healthy (smoke tests)
   - Installs dependencies (`npm install`)
   - Builds consolidated worker (`npm run build`)
   - Verifies build output (same checks as staging)
   - Deploys to production via Wrangler
   - Comprehensive post-deployment validation
   - Reports version and deployment status

### Build Guarantees

The CI/CD pipeline ensures every deployment:
- ✅ Has all dependencies installed
- ✅ Runs the build step successfully
- ✅ Produces valid output with embedded HTML
- ✅ Is verified post-deployment
- ✅ Has accessible health and API endpoints

If any step fails, the deployment is aborted with clear error messages.

## Local Testing

```bash
# Build the consolidated worker
npm run build

# Run tests
npm test

# Test with Wrangler (requires credentials)
cd cloudflare-worker
npx wrangler dev
```

## Why This Approach?

### Benefits
1. **Atomic Deployments**: UI and worker logic always deploy together
2. **No Sync Issues**: Single source prevents inconsistencies between environments
3. **Simpler CI/CD**: No need to deploy to multiple Cloudflare services
4. **Faster Deployments**: Single worker deployment is faster than worker + Pages

### Trade-offs
1. **Build Step Required**: Must run build before deploying
2. **Larger Worker File**: Embedded HTML increases worker size (but still within limits)
3. **Git Diffs**: Changes to frontend result in large diffs in worker file

## File Roles

- `frontend/index.html` - **Source** - Edit this to change the UI
- `cloudflare-worker/src/index.js` - **Built Artifact** - Contains embedded HTML
- `scripts/build-consolidated-worker.js` - **Build Tool** - Embeds HTML into worker
- `deploy.sh` - **Legacy** - Old deployment script (use GitHub Actions instead)

## Verification

### Manual Deployment Verification

Use the verification script to check a deployment:

```bash
# Verify staging
./scripts/verify-deployment.sh staging

# Verify production
./scripts/verify-deployment.sh production
```

The script checks:
- Health endpoint returns valid JSON
- HTML UI is served and contains expected content
- API endpoints are accessible
- Version information is present
- CORS and security headers

## Troubleshooting

### Build fails
- Ensure `frontend/index.html` exists and is valid HTML
- Check for syntax errors in the frontend HTML
- Verify dependencies are installed: `npm install`
- Check Node.js version (requires v20+)

### Tests fail after build
- Verify the HTML was embedded correctly: `grep -c "<!DOCTYPE html>" cloudflare-worker/src/index.js`
- Check that required functions are still present
- Run `npm test` to see specific failures

### Deployment fails

#### Build verification fails
- Check if file size is too small: `wc -c cloudflare-worker/src/index.js`
- Verify HTML is embedded: `grep "<!DOCTYPE html>" cloudflare-worker/src/index.js`
- Re-run build: `npm run build`

#### Post-deployment verification fails
- Wait 30-60 seconds for Cloudflare to propagate changes
- Check deployment logs in GitHub Actions
- Manually verify endpoints:
  ```bash
  curl -s https://omnibot-staging.jonanscheffler.workers.dev/api/health | jq
  curl -s https://omnibot-staging.jonanscheffler.workers.dev/ | grep "DOCTYPE"
  ```
- Run verification script: `./scripts/verify-deployment.sh staging`

#### Dependencies missing
- Ensure `npm install` runs before `npm run build` in workflows
- Check package.json for any missing dependencies
- Verify GitHub Actions has access to npm registry

### See Also

For detailed information about recent deployment pipeline improvements, see [DEPLOYMENT_POSTMORTEM.md](DEPLOYMENT_POSTMORTEM.md).
