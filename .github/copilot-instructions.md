# GitHub Copilot Instructions for Omnibot

## Project Overview

Omnibot is a voice-controlled AI assistant built on Cloudflare Workers with:
- **Architecture**: Single consolidated Cloudflare Worker with embedded HTML/CSS/JS UI
- **LLM Integration**: Auto-rotation between Groq/Gemini/Claude/GPT based on rate limits
- **Deployment**: Staging-to-production promotion workflow via GitHub Actions
- **Testing**: Mocha for structure tests, Playwright for E2E, ESLint for linting

## Key Architecture Principles

### Consolidated Build Approach
- **Source UI**: `frontend/index.html` - Edit this for UI changes
- **Worker Code**: `cloudflare-worker/src/index.js` - Contains worker logic AND embedded HTML
- **Build Process**: `npm run build` embeds frontend HTML into worker
- **Critical**: Always run `npm run build` after editing `frontend/index.html`

### File Roles
- `frontend/index.html` - **SOURCE** of truth for UI (edit this)
- `cloudflare-worker/src/index.js` - **BUILD ARTIFACT** (contains embedded HTML)
- `scripts/build-consolidated-worker.js` - Build tool that embeds HTML

## Development Workflow

### Making Changes

**UI Changes**:
```bash
# 1. Edit the source
vim frontend/index.html

# 2. Build consolidated worker (embeds HTML)
npm run build

# 3. Test changes
npm test

# 4. Commit BOTH files
git add frontend/index.html cloudflare-worker/src/index.js
```

**Worker Logic Changes**:
```bash
# 1. Edit worker (avoid editing the HTML section)
vim cloudflare-worker/src/index.js

# 2. Test changes
npm test

# 3. Commit changes
git add cloudflare-worker/src/index.js
```

### Testing Commands
- `npm test` - Run structure tests (primary test suite)
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:unit` - Run unit tests
- `npm run lint` - Run ESLint (blocks CI if fails)
- `npm run complexity` - Analyze code complexity

### Important: Test File Patterns
- Use `router.fetch(request, mockEnv)` NOT `handleRequest(request, mockEnv)`
- Index.js exports default object with `fetch` method
- See `tests/api/endpoints.spec.js` for examples

## Code Quality Standards

### ESLint Configuration
- Uses `eslint:recommended` with practical rules
- Complexity max: 30, Max depth: 5, Max lines per function: 300
- Style rules disabled (semi, quotes, indent) - focus on correctness
- `no-var` is error, `prefer-const` is warning
- Ignore: `node_modules/`, `dist/`, `.wrangler/`, `scripts/experimental/`

### Code Style
- Use `const` over `let`, never use `var`
- Practical complexity limits, not strict style enforcement
- Minimal comments unless explaining complex logic
- Use existing libraries when possible

### Testing Philosophy
- processImmediate errors in test output are Node.js event loop references, not bugs
- Look at assertion messages for real failure causes
- Tests include enhanced error logging with file sizes and context
- See `docs/TESTING_IMPROVEMENTS.md` for details

## Deployment Pipeline

### Staging Deployment (Automatic)
- **Trigger**: PR to `main` branch
- **URL**: https://omnibot-staging.jonanscheffler.workers.dev
- **Process**:
  1. Run tests (`npm test`)
  2. Install dependencies (`npm install`)
  3. Build consolidated worker (`npm run build`)
  4. Verify build output (file size >40KB, HTML embedded)
  5. Deploy to staging via Wrangler
  6. Post-deployment validation (health check, HTML presence, API accessibility)

### Production Deployment (Manual)
- **Trigger**: Manual workflow dispatch "Promote Staging to Production"
- **URL**: https://omnibot.jonanscheffler.workers.dev
- **Process**:
  1. Validate staging is healthy (smoke tests)
  2. Install dependencies and build fresh worker
  3. Verify build output
  4. Deploy to production via Wrangler
  5. Comprehensive post-deployment validation

### Critical CI/CD Rules
- **ALWAYS** run `npm install` before `npm run build` in workflows
- **ALWAYS** run `npm run lint` before deployment (blocks on errors)
- Verify build output: file exists, size >40KB, contains `<!DOCTYPE html>`
- Post-deployment validation checks content freshness, not just endpoint availability
- See `docs/DEPLOYMENT_FAILURE_2024_12_12.md` for lessons learned

### Git Hooks (If Husky is installed)
- Pre-commit: Lints staged files (blocks on failure)
- Pre-push: Runs tests (blocks on failure)

## Common Patterns

### Edit Pipeline Architecture
The edit feature uses an enforced pipeline:
1. Groq (Llama) - Initial draft
2. Kimi - Architecture checkpoint
3. 3x Qwen - Implementation
4. Claude/Gemini - Polish

Edit responses must be code-only (no markdown fences) via `extractCodeOnly()` function.

### Theme System
- 14 sci-fi themes (13 dark, 1 light)
- Theme toggle button in header with `.theme-toggle-btn` class
- Functions: `toggleThemeQuick()`, `updateThemeToggleIcon()`
- See `frontend/index.html` lines 1544-1546, 2594-2630

### Security
- HMAC authentication for API calls
- Use `html_escape` as sanitizer to avoid XSS
- No inline scripts (CSP compatible)
- Secret storage in environment variables

## Documentation

### Key Documents
- `README.md` - Quick start and overview
- `BUILD_PROCESS.md` - Detailed build and deployment info
- `FEATURES.md` - Complete UI feature documentation
- `docs/DEPLOYMENT_FAILURE_2024_12_12.md` - Post-mortem and lessons learned
- `docs/TESTING_IMPROVEMENTS.md` - Testing best practices
- `scripts/README.md` - Script documentation

### Deployment Failures
Document deployment failures in `docs/DEPLOYMENT_FAILURE_YYYY_MM_DD.md` with:
- Root cause analysis
- Timeline of events
- Fixes implemented
- Prevention measures
- Lessons learned
- Future recommendations

## Scripts Organization

### Main Scripts
- `scripts/build-consolidated-worker.js` - Build tool (embeds HTML into worker)
- `scripts/analyze-complexity.js` - Code complexity analysis
- `scripts/verify-deployment.sh` - Manual deployment verification

### Experimental Scripts
- Location: `scripts/experimental/`
- Purpose: Testing variations and experiments
- Document in `scripts/README.md` with purpose and usage

## Common Pitfalls to Avoid

1. **Forgetting to build**: Always run `npm run build` after editing `frontend/index.html`
2. **Missing npm install**: CI/CD requires `npm install` before `npm run build`
3. **Wrong test patterns**: Use `router.fetch()` not `handleRequest()`
4. **Ignoring lint errors**: `npm run lint` blocks deployment - fix errors before pushing
5. **Incomplete build verification**: Check file size AND HTML embedding, not just existence
6. **Weak post-deploy validation**: Validate content freshness, not just endpoint availability

## Verification

### Manual Verification Commands
```bash
# Verify staging deployment
./scripts/verify-deployment.sh staging

# Verify production deployment
./scripts/verify-deployment.sh production

# Run CI validation tests
node --test tests/ci-validation.test.js
```

### Build Verification
```bash
# Check if HTML is embedded
grep -c "<!DOCTYPE html>" cloudflare-worker/src/index.js

# Check file size (should be >40KB)
wc -c cloudflare-worker/src/index.js

# Verify required functions exist
grep -c "handleRequest" cloudflare-worker/src/index.js
```

## Emergency Procedures

See `docs/DEPLOYMENT_FAILURE_2024_12_12.md` for:
- Rollback procedures
- Emergency contacts
- Troubleshooting steps
- Post-incident documentation requirements

## When Making Changes

1. **Understand the build process** - HTML embedding is critical
2. **Test locally first** - Run `npm test` before pushing
3. **Lint your code** - Run `npm run lint` and fix errors
4. **Verify builds** - Ensure HTML is embedded after building
5. **Document carefully** - Update relevant docs if changing architecture
6. **Follow deployment pipeline** - Use staging before production
7. **Validate deployments** - Check content, not just availability

## Contributing

- Follow existing code patterns and conventions
- Keep changes minimal and focused
- Write tests for new features
- Update documentation for significant changes
- Use descriptive commit messages
- Ensure all CI checks pass before merging

---

For more details, see README.md and BUILD_PROCESS.md in the repository root.
