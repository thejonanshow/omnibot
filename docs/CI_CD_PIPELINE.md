# OmniBot CI/CD Pipeline Documentation

This document provides a comprehensive overview of OmniBot's Continuous Integration and Continuous Deployment (CI/CD) pipeline.

## Table of Contents

- [Overview](#overview)
- [Pipeline Architecture](#pipeline-architecture)
- [Workflows](#workflows)
- [Gates and Validations](#gates-and-validations)
- [Troubleshooting](#troubleshooting)

## Overview

OmniBot uses GitHub Actions for CI/CD with multiple workflows that enforce code quality and prevent broken deployments.

### Design Principles

1. **Fail Fast** - Catch issues as early as possible
2. **Multiple Gates** - Each stage validates different aspects
3. **No Bypassing** - All code must pass validation
4. **Clear Feedback** - Errors are reported with helpful messages
5. **Automated Recovery** - Post-deployment validation catches deployment issues

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Developer Workflow                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Git Hooks (Local)                        │
│  • Pre-commit: Linting (blocks commits with errors)         │
│  • Pre-push: Tests (blocks pushes with failures)            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Pull Request Validation                     │
│  • Lint code (strict)                                        │
│  • Run full test suite                                       │
│  • Verify build process                                      │
│  • Must pass before merge                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Staging Deployment                         │
│  • Install dependencies                                      │
│  • Lint code                                                 │
│  • Pre-test validation                                       │
│  • Run tests                                                 │
│  • Build worker                                              │
│  • Verify build output                                       │
│  • Deploy to staging                                         │
│  • Post-deployment verification                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Production Deployment                       │
│  • Install dependencies                                      │
│  • Lint code                                                 │
│  • Run tests                                                 │
│  • Build worker                                              │
│  • Verify build output                                       │
│  • Deploy to production                                      │
│  • Wait for propagation                                      │
│  • Health check                                              │
│  • HTML UI verification                                      │
│  • API endpoint checks                                       │
└─────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. Pull Request Validation (`pr-validation.yml`)

**Purpose:** Ensures all PRs meet quality standards before being merged.

**Triggers:**
- Pull requests to `main`, `staging`, or `develop`
- PR opened, synchronized, or reopened

**Steps:**
1. **Checkout code** - Get PR branch code
2. **Setup Node.js** - Install Node.js 20 with npm caching
3. **Install dependencies** - `npm install`
4. **Lint code (strict mode)** - Runs ESLint, fails on errors
5. **Run test suite** - Runs all tests, fails on any failure
6. **Build verification** - Ensures build produces valid output
7. **Validation summary** - Reports success/failure

**Exit Conditions:**
- ✅ Pass: All checks succeed → PR can be merged
- ❌ Fail: Any check fails → Blocks merge, requires fixes

**Status:** **Required** - Must pass before PR can be merged

---

### 2. Staging Deployment (`staging-deploy.yml`)

**Purpose:** Deploy code to staging environment for testing before production.

**Triggers:**
- Push to `staging` or `develop` branches
- Pull requests to `main`
- Manual trigger via workflow dispatch

**Jobs:**

#### Job 1: Test
1. **Checkout code**
2. **Setup Node.js**
3. **Install dependencies**
4. **Lint code** - Blocks on errors
5. **Pre-test validation** - Checks file existence, size, critical patterns
6. **Run tests** - Full test suite

#### Job 2: Deploy to Staging (only if tests pass)
1. **Checkout code**
2. **Setup Node.js**
3. **Install dependencies**
4. **Build consolidated worker**
5. **Verify build output:**
   - File exists
   - Size > 100KB
   - Contains HTML DOCTYPE
6. **Install Wrangler**
7. **Deploy to staging**
8. **Post-deployment verification:**
   - Health check returns `"ok":true`
   - HTML UI is served with DOCTYPE
   - HTML contains "Omnibot"
   - Test endpoint is accessible

**Deployment URL:** `https://omnibot-staging.jonanscheffler.workers.dev`

---

### 3. Production Deployment (`test-and-deploy.yml`)

**Purpose:** Deploy validated code to production environment.

**Triggers:**
- Push to `main` branch
- Changes to specific paths: `cloudflare-worker/src/**`, `frontend/**`, `tests/**`, `scripts/**`, `.github/workflows/**`

**Steps:**
1. **Checkout code**
2. **Setup Node.js**
3. **Install dependencies** - `npm install`
4. **Lint code** - `npm run lint` (blocks on errors)
5. **Run tests** - `npm test` (blocks on failures)
6. **Build consolidated worker** - `npm run build`
7. **Verify build output:**
   - File: `cloudflare-worker/src/index.js` exists
   - Size: > 100KB (ensures HTML is embedded)
   - Content: Contains `<!DOCTYPE html>`
8. **Install Wrangler** - Global installation
9. **Deploy to Cloudflare Workers**
10. **Post-deployment verification:**
    - Wait 30s for propagation
    - Health check validation
    - HTML UI verification
    - API endpoint accessibility

**Deployment URL:** `https://omnibot.jonanscheffler.workers.dev`

---

### 4. Production Promotion (`promote-to-production.yml`)

**Purpose:** Promote staging to production with extra validation.

**Triggers:**
- Manual workflow dispatch only
- Requires typing "promote" to confirm

**Jobs:**

#### Job 1: Validate Staging
1. **Verify staging is healthy** - Health endpoint check
2. **Run smoke tests on staging:**
   - Chat endpoint test
   - Edit validation test
   - Test endpoint accessibility

#### Job 2: Promote to Production (only if staging validates)
1. **Checkout code**
2. **Setup Node.js**
3. **Install dependencies**
4. **Lint code** - Must pass
5. **Run tests** - Must pass
6. **Build consolidated worker**
7. **Verify build output**
8. **Install Wrangler**
9. **Deploy to Production**
10. **Wait for deployment** - 30s
11. **Production health check**
12. **Post-deployment verification**

#### Job 3: Notify on Invalid Confirmation
- Aborts if user didn't type "promote"

**Safety Feature:** Requires explicit "promote" confirmation to prevent accidental deployments.

---

## Gates and Validations

### Gate 1: Linting

**What it checks:** Code syntax, style, potential bugs

**Command:** `npm run lint`

**Fails on:**
- Syntax errors
- Undefined variables
- Parsing errors
- ESLint rule violations marked as errors

**Passes with:** Warnings are allowed (89 warnings currently), but errors block

**Why it matters:** Prevents syntactically incorrect code from being deployed

**Example failure:**
```
error  'handleRequest' is not defined  no-undef
```

---

### Gate 2: Testing

**What it checks:** Functional correctness, regression prevention

**Command:** `npm test`

**Tests run:**
- Structure tests (30 tests)
- Configuration tests
- Functional tests
- Safety tests

**Fails on:** Any test failure

**Why it matters:** Ensures code changes don't break existing functionality

**Example failure:**
```
1) OmniBot Structure Tests
   should have minimum size:
   AssertionError: expected 1234 to be at least 5000
```

---

### Gate 3: Build Verification

**What it checks:** Build process produces valid output

**Steps:**
1. Check `cloudflare-worker/src/index.js` exists
2. Verify file size > 100KB
3. Verify HTML embedding (grep for `<!DOCTYPE html>`)

**Fails on:**
- Missing output file
- File too small (indicates build failure or missing HTML)
- Missing HTML content

**Why it matters:** Prevents deploying incomplete or corrupt builds

**Example failure:**
```
ERROR: Built worker is too small (expected >100KB with embedded HTML)
Built worker size: 5432 bytes
```

---

### Gate 4: Post-Deployment Verification

**What it checks:** Deployed application works correctly

**Steps:**
1. Wait 30s for CDN propagation
2. Health endpoint returns `{"ok":true}`
3. Root path serves HTML with DOCTYPE
4. HTML contains "Omnibot" text
5. API test endpoint is accessible

**Fails on:**
- Health check fails
- HTML not served
- Missing expected content
- Endpoints not accessible

**Why it matters:** Catches deployment issues, CDN problems, configuration errors

**Example failure:**
```
ERROR: Health check failed
Response: {"ok":false,"error":"Database connection failed"}
```

---

## Troubleshooting

### Linting Failures in CI

**Symptoms:**
- PR validation fails at lint step
- Error shows: `❌ Linting failed with errors`

**Solution:**
```bash
# Run linting locally
npm run lint

# Auto-fix issues
npm run lint:fix

# Review remaining errors
npm run lint

# Fix manually, then commit
git add .
git commit -m "Fix linting errors"
```

---

### Test Failures in CI

**Symptoms:**
- PR validation fails at test step
- Specific test failures shown

**Solution:**
```bash
# Run tests locally
npm test

# For specific test types
npm run test:structure
npm run test:safety

# Fix the failing tests
# Then commit and push
```

**Common issues:**
- Tests expect specific file structure
- Tests check for minimum file sizes
- Tests validate HTML presence

---

### Build Verification Failures

**Symptoms:**
- `ERROR: Build did not produce index.js`
- `ERROR: Built worker is too small`
- `ERROR: Built worker does not contain embedded HTML`

**Solution:**
```bash
# Test build locally
npm run build

# Check output
ls -lh cloudflare-worker/src/index.js
wc -c cloudflare-worker/src/index.js
grep "<!DOCTYPE html>" cloudflare-worker/src/index.js

# If build fails, check build script
cat scripts/build-consolidated-worker.js

# Ensure frontend/index.html exists
ls -lh frontend/index.html
```

---

### Post-Deployment Verification Failures

**Symptoms:**
- Deployment succeeds but verification fails
- Health check returns errors
- HTML not served correctly

**Possible causes:**
1. **CDN propagation delay** - Wait longer (already 30s)
2. **Environment variables missing** - Check Cloudflare Worker settings
3. **Build didn't include latest changes** - Check build step
4. **Cloudflare Worker crashed** - Check Cloudflare dashboard logs

**Solution:**
```bash
# Manual verification
curl -s https://omnibot.jonanscheffler.workers.dev/api/health | jq
curl -s https://omnibot.jonanscheffler.workers.dev/ | head -20

# Check if HTML is embedded in worker
grep -c "<!DOCTYPE html>" cloudflare-worker/src/index.js

# If needed, check Cloudflare dashboard
# - Worker logs
# - Error rates
# - Recent deployments
```

---

### Pre-commit Hook Failures

**Symptoms:**
- Commit is blocked with linting errors
- Message: `❌ Linting failed. Please fix the errors before committing.`

**Solution:**
```bash
# View errors
npm run lint

# Auto-fix
npm run lint:fix

# Or bypass (NOT RECOMMENDED)
git commit --no-verify -m "Your message"
```

---

### Pre-push Hook Failures

**Symptoms:**
- Push is blocked with test failures
- Message: `❌ Tests failed. Please fix the failing tests before pushing.`

**Solution:**
```bash
# Run tests
npm test

# Fix failures
# Then push again

# Or bypass (NOT RECOMMENDED)
git push --no-verify
```

---

## Maintenance

### Adding New Validation Steps

To add a new validation step to the pipeline:

1. **Choose the right workflow** - PR validation, staging, or production
2. **Add step in correct order** - Usually after existing validations
3. **Ensure it fails appropriately** - Exit code 1 on failure
4. **Provide clear error messages** - Help developers fix issues
5. **Test locally first** - Ensure the step works
6. **Update this documentation** - Keep docs current

### Monitoring Pipeline Health

**Metrics to track:**
- PR validation pass rate
- Deployment success rate
- Average time to deploy
- Frequency of post-deployment failures

**Tools:**
- GitHub Actions UI - View workflow runs
- Cloudflare Dashboard - View worker errors and logs
- Post-deployment verification logs

### Emergency Procedures

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Hotfix process
- Rollback procedures
- Manual deployment (emergency only)

---

## Historical Context

### Past Deployment Failures

For detailed analysis of past issues and how the current pipeline prevents them:

- [Deployment Failure 2024-12-12](DEPLOYMENT_FAILURE_2024_12_12.md) - Missing linting in CI/CD
- [Deployment Postmortem](../DEPLOYMENT_POSTMORTEM.md) - Missing npm install steps

### Lessons Learned

1. **Linting must be mandatory** - Optional linting allows errors to slip through
2. **Test success ≠ code quality** - Need multiple validation layers
3. **Always install dependencies** - Never assume CI environment has packages
4. **Verify build artifacts** - Don't trust that build succeeded
5. **Validate deployed content** - Health checks aren't enough

---

## Additional Resources

- [Contributing Guide](../CONTRIBUTING.md) - Development workflow
- [Testing Guide](TESTING_IMPROVEMENTS.md) - Testing best practices
- [Build Process](../BUILD_PROCESS.md) - How builds work
- [Deployment Checklist](../DEPLOYMENT_CHECKLIST.md) - Pre-deployment checks

---

**Last Updated:** 2024-12-12  
**Maintained By:** OmniBot SRE Team
