# Omnibot

Voice-controlled AI assistant with automatic LLM provider rotation and self-upgrade capabilities.

## Quick Start

```bash
npm install      # Install dependencies
npm run build    # Build consolidated worker (embeds frontend HTML)
npm test         # Run tests
# Deploy via GitHub Actions workflows (see Deployment Pipeline below)
```

## Features

- Auto-rotates between Groq/Gemini/Claude/GPT based on rate limits
- Voice input/output (Web Speech API)
- Self-upgrade via voice commands ("upgrade mode")
- HMAC authentication
- Modern UI with 14 sci-fi themes

## Architecture

- **Consolidated Worker**: Single Cloudflare Worker with embedded HTML/CSS/JS UI
  - Source UI: `frontend/index.html`
  - Built worker: `cloudflare-worker/src/index.js` (contains embedded HTML)
  - Build process: `npm run build` embeds frontend into worker
- **LLM Integration**: Routes requests to Groq/Gemini/Claude/GPT with auto-rotation
- **Storage**: KV stores for context and telemetry
- **Deployment**: GitHub Actions with staging → production promotion workflow

See [BUILD_PROCESS.md](BUILD_PROCESS.md) for detailed build and deployment information.

## Development

```bash
# Make changes to the UI
# Edit: frontend/index.html

# Make changes to worker logic
# Edit: cloudflare-worker/src/index.js

# Build consolidated worker (embeds frontend HTML)
npm run build

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Local development with Wrangler (requires credentials)
cd cloudflare-worker && npx wrangler dev
```

## Deployment Pipeline

Omnibot uses a staging-to-production deployment pipeline with comprehensive validation:

### Staging Deployment
- **Automatic**: Pull requests to `main` trigger staging deployment
- **URL**: https://omnibot-staging.jonanscheffler.workers.dev
- **Purpose**: Test changes in production-like environment before promoting
- **Process**:
  1. Create PR to `main`
  2. GitHub Actions runs tests (`npm test`)
  3. Installs dependencies (`npm install`)
  4. Builds consolidated worker (`npm run build`)
  5. Verifies build output (file size, HTML embedding)
  6. Deploys to staging worker via Wrangler
  7. Post-deployment validation:
     - Health check with JSON validation
     - HTML UI presence and content verification
     - API endpoint accessibility tests

### Production Deployment
- **Manual**: Must be explicitly promoted from staging via workflow dispatch
- **URL**: https://omnibot.jonanscheffler.workers.dev
- **Process**:
  1. Verify staging works correctly
  2. Go to Actions → "Promote Staging to Production"
  3. Click "Run workflow" and type "promote" to confirm
  4. Workflow validates staging deployment first
  5. Runs smoke tests on staging
  6. Installs dependencies and builds fresh worker
  7. Verifies build output
  8. Deploys to production via Wrangler
  9. Comprehensive post-deployment validation
- **Safety**: Staging health checks and smoke tests must pass before promotion is allowed

### Verification

Manual deployment verification:
```bash
# Verify staging deployment
./scripts/verify-deployment.sh staging

# Verify production deployment
./scripts/verify-deployment.sh production
```

### Build Process Guarantees

The build pipeline ensures:
- ✅ Dependencies installed before build
- ✅ Build output validated (>100KB with embedded HTML)
- ✅ HTML UI properly embedded in worker
- ✅ Deployment verified post-deploy
- ✅ Clear error messages on any failure

See [DEPLOYMENT_POSTMORTEM.md](DEPLOYMENT_POSTMORTEM.md) for details on recent pipeline improvements.

### Workflow
1. Develop and test locally (`npm test`)
2. Push to `main` → Auto-deploys to staging (with full validation)
3. Test staging deployment (manual or automated)
4. Manually promote to production (requires confirmation)
5. Verify production deployment (automated checks)

## LLM-Driven Contribution Guidelines

When working with AI assistants on this project, follow these rules to maintain code quality and enable effective collaboration:

### Testing Standards
- **Always maintain 100% test coverage** - Any new code must be fully tested
- **Red, Green, Refactor** - Never commit in red state (failing tests) so we can effectively bisect in the future
- **BDD Approach** - Write user stories first, then tests, then implementation
- **Test isolation** - Free tests (unit/mocks) vs paid tests (E2E/API calls) must be clearly separated

### Code Quality
- **Never leave something stubbed or half-implemented** - A feature is a story until it's fully tested and built
- **Be brief with docs but specific** - Focus on essential information, avoid verbose explanations
- **Complete implementations** - Every function, class, or module must be fully functional

### Development Workflow
- **Regular commits with useful messages** - Provide context for future models and developers
- **Feature completeness** - Each commit should represent a complete, working feature
- **Error handling** - Always include proper error handling and meaningful error messages
- **Performance considerations** - Optimize for cold start latency and resource efficiency

### AI Collaboration
- **Context preservation** - Commit messages should provide enough context for AI assistants to understand changes
- **Incremental progress** - Break large features into smaller, testable increments
- **Documentation as code** - Keep documentation close to implementation and update together

## Edit Pipeline Architecture

Omnibot uses a multi-stage AI pipeline to generate high-quality code changes with detailed explanations:

### Pipeline Flow

1. **Kimi (Moonshot AI)** - Initial analysis and architectural guidance
   - Analyzes the change request
   - Provides architectural recommendations
   - Sets the foundation for implementation

2. **Groq (Llama)** - Detailed planning
   - Creates focused implementation plan
   - Identifies code sections to modify
   - Assesses risk level

3. **Qwen (3 iterations)** - Implementation and refinement
   - Iteration 1: Initial code generation
   - Iteration 2: Refinement for correctness
   - Iteration 3: Final validation

4. **Claude/Gemini** - Review and explanation
   - Comprehensive code review
   - Detailed PR description generation
   - Testing considerations and risk assessment

### PR Creation

The pipeline automatically creates a GitHub Pull Request with:
- **Code changes**: Implemented in the PR diff
- **Elaborate description**: All AI responses formatted in a Claude-style interface
  - Initial analysis and architectural considerations
  - Implementation plan and details
  - Testing recommendations
  - Potential risks and edge cases

This separation allows for rich context in the PR while keeping the code changes clean and focused.

## Configuration

Set via `npm run setup` or manually in `.env`:

```env
# LLM Providers (at least one required)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
KIMI_API_KEY=        # Optional: For architecture analysis

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Optional: Self-upgrade
GITHUB_TOKEN=
GITHUB_REPO=
```

## Usage

1. Open frontend URL from deploy output
2. Configure Router URL and Secret in Settings
3. Click microphone and speak
4. Say "upgrade mode" then describe changes to modify the system

## Costs

~$2/month (mostly free tiers)

## License

MIT

<!-- CI test trigger: 1765179137.716695 -->
