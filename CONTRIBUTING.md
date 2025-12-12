# Contributing to OmniBot

Thank you for your interest in contributing to OmniBot! This guide will help you understand our development workflow and quality standards.

## Table of Contents

- [Development Setup](#development-setup)
- [Git Hooks](#git-hooks)
- [Code Quality Standards](#code-quality-standards)
- [CI/CD Pipeline](#cicd-pipeline)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Emergency Procedures](#emergency-procedures)

## Development Setup

### Prerequisites

- Node.js 20 or higher
- npm (comes with Node.js)
- Git

### Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/thejonanshow/omnibot.git
   cd omnibot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Git hooks will be automatically installed via Husky (see below).

## Git Hooks

OmniBot uses [Husky](https://typicode.github.io/husky/) to enforce code quality standards before commits and pushes.

### Pre-Commit Hook

**What it does:** Runs ESLint on all staged files before allowing a commit.

**Why:** Catches syntax errors, code style issues, and potential bugs before they enter the repository.

**If it fails:**
```bash
# View linting errors
npm run lint

# Automatically fix some issues
npm run lint:fix

# Then try committing again
git commit -m "Your message"
```

### Pre-Push Hook

**What it does:** Runs the full test suite before allowing a push.

**Why:** Ensures that code changes don't break existing functionality before sharing them with the team.

**If it fails:**
```bash
# Run tests to see failures
npm test

# Fix the failing tests, then try pushing again
git push
```

### Bypassing Hooks (Emergency Only)

⚠️ **WARNING:** Only bypass hooks in true emergencies. Bypassed code will still need to pass CI/CD checks.

```bash
# Skip pre-commit hook (NOT RECOMMENDED)
git commit --no-verify -m "Emergency fix"

# Skip pre-push hook (NOT RECOMMENDED)
git push --no-verify
```

**Note:** Even if you bypass local hooks, your code must still pass CI/CD validation before it can be merged or deployed.

## Code Quality Standards

### Linting

We use ESLint to maintain code quality and consistency.

```bash
# Check for linting issues
npm run lint

# Automatically fix fixable issues
npm run lint:fix

# Lint only worker code
npm run lint:worker
```

**Current Standards:**
- ESLint configuration: `.eslintrc.json`
- Errors block commits and CI/CD
- Warnings are informational but don't block

### Code Complexity

Monitor code complexity to maintain readability:

```bash
# Analyze complexity across the codebase
npm run complexity

# Analyze only worker code
npm run complexity:worker
```

## CI/CD Pipeline

OmniBot has a multi-stage CI/CD pipeline that ensures code quality at every step.

### Pipeline Stages

1. **Pull Request Validation** (`.github/workflows/pr-validation.yml`)
   - Triggered on: Every PR to main, staging, or develop
   - Checks: Linting, tests, build verification
   - **Must pass before merging**

2. **Staging Deployment** (`.github/workflows/staging-deploy.yml`)
   - Triggered on: Push to staging/develop, PRs to main
   - Steps: Lint → Test → Build → Deploy to staging → Verify
   - Environment: `https://omnibot-staging.jonanscheffler.workers.dev`

3. **Production Deployment** (`.github/workflows/test-and-deploy.yml`)
   - Triggered on: Push to main
   - Steps: Install → Lint → Test → Build → Verify → Deploy → Post-deploy checks
   - Environment: `https://omnibot.jonanscheffler.workers.dev`

4. **Production Promotion** (`.github/workflows/promote-to-production.yml`)
   - Triggered on: Manual workflow dispatch
   - Requires: Typing "promote" to confirm
   - Steps: Validate staging → Smoke tests → Build → Deploy → Verify

### Pipeline Gates

All pipeline stages include the following gates that **block deployment** on failure:

- ✋ **Linting errors** - Code must be syntactically correct and follow style guidelines
- ✋ **Test failures** - All tests must pass
- ✋ **Build failures** - Build must produce valid output with embedded HTML
- ✋ **Size checks** - Built worker must be > 100KB (indicates HTML embedding)
- ✋ **Post-deployment validation** - Deployed app must respond correctly

### Why These Gates Matter

These gates prevent issues like:
- Syntax errors reaching production
- Broken functionality being deployed
- Missing or corrupt build artifacts
- Stale content being served

See [docs/DEPLOYMENT_FAILURE_2024_12_12.md](docs/DEPLOYMENT_FAILURE_2024_12_12.md) for a real example of what happens when gates are missing.

## Testing

### Running Tests

```bash
# Run structure tests (default)
npm test

# Run structure tests only
npm run test:structure

# Run safety tests only
npm run test:safety

# Run end-to-end tests (Playwright)
npm run test:e2e

# Run unit tests
npm run test:unit
```

### Test Organization

- `tests/structure-*.test.js` - Core structure validation
- `tests/e2e/` - Browser-based end-to-end tests
- `tests/api/` - API endpoint tests
- `tests/security/` - Security vulnerability tests
- `tests/smoke/` - Critical path smoke tests
- `tests/integration/` - Integration tests

### Writing Tests

Tests should:
- Be focused and test one thing
- Have clear, descriptive names
- Include both positive and negative cases
- Clean up after themselves

## Submitting Changes

### Standard Workflow

1. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write code
   - Add/update tests
   - Update documentation if needed

3. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Descriptive commit message"
   # Pre-commit hook runs linting
   ```

4. **Push your changes:**
   ```bash
   git push origin feature/your-feature-name
   # Pre-push hook runs tests
   ```

5. **Create a Pull Request:**
   - Go to GitHub and create a PR
   - PR validation workflow runs automatically
   - Wait for checks to pass ✅
   - Request review from maintainers

6. **Address feedback:**
   - Make requested changes
   - Push updates (pre-push hook runs again)
   - PR checks run again automatically

7. **Merge:**
   - Once approved and all checks pass, merge to main
   - Staging or production deployment happens automatically

### Commit Message Guidelines

- Use present tense ("Add feature" not "Added feature")
- Be descriptive but concise
- Reference issues if applicable: "Fix #123"

Example:
```
Add pre-commit hooks for code quality

- Install and configure Husky
- Add pre-commit hook for linting
- Add pre-push hook for testing
- Update documentation

Fixes #123
```

## Emergency Procedures

### Hotfix Process

For critical production issues:

1. Create hotfix branch from `main`
2. Make minimal fix
3. Test thoroughly locally
4. Push (hooks still run)
5. Create PR with `[HOTFIX]` prefix
6. Fast-track review
7. Merge and deploy

**Never bypass CI/CD checks, even for hotfixes.**

### Rollback Procedure

If a deployment causes issues:

1. Don't panic - assess the situation
2. Check post-deployment verification logs
3. If needed, revert the merge commit:
   ```bash
   git revert <commit-hash>
   git push
   ```
4. Document the issue in `docs/DEPLOYMENT_FAILURE_YYYY_MM_DD.md`
5. Fix the root cause before redeploying

### When CI/CD is Down

If GitHub Actions is unavailable:

1. **Do not deploy manually** - wait for CI/CD to recover
2. If absolutely necessary for critical fix:
   - Run all checks locally: `npm run lint && npm test && npm run build`
   - Deploy via Wrangler manually
   - Document the manual deployment
   - Run post-deployment verification script

## Getting Help

- **Documentation:** Check `/docs` directory for detailed guides
- **Issues:** Search existing GitHub issues or create a new one
- **Code Review:** Request review from maintainers on your PR
- **Testing:** See `tests/README.md` for detailed testing guide

## Additional Resources

- [Deployment Postmortem](docs/DEPLOYMENT_FAILURE_2024_12_12.md) - Learn from past issues
- [Testing Improvements](docs/TESTING_IMPROVEMENTS.md) - Testing best practices
- [Build Process](BUILD_PROCESS.md) - How the build works
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) - Pre-deployment verification

---

Thank you for contributing to OmniBot! Your efforts to maintain code quality help keep the project reliable and maintainable. 🚀
