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

All deployments automatically build the consolidated worker:

### Staging Deployment
1. Push to a branch and create a PR to `main`
2. GitHub Actions automatically:
   - Runs tests
   - Builds consolidated worker (`npm run build`)
   - Deploys to staging environment
   - Runs health checks

### Production Deployment
1. Merge PR to `main` (after staging verification)
2. Manually trigger production promotion workflow
3. GitHub Actions:
   - Validates staging is healthy
   - Builds consolidated worker
   - Deploys to production
   - Verifies deployment

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

## Troubleshooting

### Build fails
- Ensure `frontend/index.html` exists and is valid HTML
- Check for syntax errors in the frontend HTML

### Tests fail after build
- Verify the HTML was embedded correctly
- Check that required functions are still present
- Run `npm test` to see specific failures

### Deployment fails
- Ensure you ran `npm run build` before deploying
- Check that the worker size is within Cloudflare limits (<1MB)
- Verify all secrets are configured in GitHub Actions
