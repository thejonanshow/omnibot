# Omnibot

Voice-controlled AI assistant with automatic LLM provider rotation and self-upgrade capabilities.

## Quick Start

```bash
npm run setup    # One-time setup
npm run deploy   # Deploy to Cloudflare
npm run start    # Launch frontend
```

## Features

- Auto-rotates between Groq/Gemini/Claude/GPT based on rate limits
- Voice input/output (Web Speech API)
- Self-upgrade via voice commands ("upgrade mode")
- HMAC authentication
- Modern UI with 14 sci-fi themes

## Architecture

- **Frontend**: Single-page app (HTML/CSS/JS) hosted on Cloudflare Pages
- **Backend**: Cloudflare Worker routes requests to LLM providers
- **Storage**: KV stores for rate limiting and conversation history
- **Upgrade**: GitHub API + Cloudflare API for zero-downtime deploys

## Development

```bash
# Test changes locally
cd cloudflare-worker && npm test

# Run E2E tests
npx playwright test

# Deploy
npm run deploy
```

## Deployment Pipeline

Omnibot uses a staging-to-production deployment pipeline:

### Staging Deployment
- **Automatic**: Pushes to `main` automatically deploy to staging
- **URL**: https://ad6fdc76.omnibot-ui-staging.pages.dev
- **Purpose**: Test changes in production-like environment
- **Tests**: Full E2E test suite runs on staging

### Production Deployment
- **Manual**: Must be explicitly promoted from staging
- **URL**: https://omnibot-ui.pages.dev
- **Process**:
  1. Verify staging works correctly
  2. Run: `gh workflow run production-deploy.yml`
  3. Or tag release: `git tag -a v1.x.x -m "Release" && git push --tags`
- **Safety**: Full test suite must pass on staging before promotion

### Workflow
1. Develop and test locally
2. Push to `main` → Auto-deploys to staging
3. Test staging deployment
4. Manually promote to production
5. Verify production deployment

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

Omnibot uses a sophisticated multi-stage edit pipeline to ensure high-quality code changes:

### Pipeline Stages (Enforced Order)

1. **Groq (Llama 3.3 70B)** - Initial planning and analysis
   - Analyzes the change request
   - Creates focused implementation plan
   - Identifies sections to modify

2. **Kimi (Moonshot AI)** - Architecture review checkpoint
   - **⚠️ STOP HERE FOR ARCHITECTURE QUESTIONS**
   - Reviews architectural soundness
   - Validates approach before implementation
   - Provides checkpoint for design decisions

3. **Qwen (3 iterations)** - Implementation with refinement
   - Iteration 1: Initial patch generation
   - Iteration 2: Refinement for correctness
   - Iteration 3: Final validation pass
   - Produces code-only output (no markdown/prose)

4. **Claude/Gemini** - Review and polish
   - Final code review
   - Quality assurance
   - Recommendation for approval

### Code-Only Output Requirement

The edit pipeline enforces **code-only responses** to ensure downstream extraction succeeds:
- No markdown code fences (```)
- No explanatory prose or descriptions
- Only patch syntax (`<<<REPLACE>>>`, `<<<WITH>>>`, `<<<END>>>`) and code
- Critical for automated processing and deployment pipeline

This ensures reliable extraction and prevents parsing errors in the deployment workflow.

## Configuration

Set via `npm run setup` or manually in `.env`:

```env
# LLM Providers (at least one required)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
KIMI_API_KEY=        # Optional: For architecture review checkpoint

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
