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
- **CLI**: Command-line interface for terminal-based interaction (see [CLI README](cli/README.md))

## Architecture

- **Consolidated Worker**: Single Cloudflare Worker with embedded HTML/CSS/JS UI
  - Source UI: `frontend/index.html`
  - Built worker: `cloudflare-worker/src/index.js` (contains embedded HTML)
  - Build process: `npm run build` embeds frontend into worker
- **LLM Integration**: Routes requests to Groq/Gemini/Claude/GPT with auto-rotation
- **Storage**: KV stores for context, telemetry, CLI tokens, and conversations
- **Deployment**: GitHub Actions with staging → production promotion workflow
- **CLI**: Node.js-based command-line interface in `cli/` directory

See [BUILD_PROCESS.md](BUILD_PROCESS.md) for detailed build and deployment information.
See [CLI README](cli/README.md) for CLI installation and usage.

## CLI Usage

Omnibot includes a command-line interface for terminal-based interaction.

### Installation

```bash
cd cli
npm install
npm link  # Makes 'omnibot' available globally
```

### Quick Start

```bash
# 1. Login with your CLI token
omnibot login --token YOUR_TOKEN

# 2. Verify credentials
omnibot whoami

# 3. Check API health
omnibot health

# 4. Interactive chat
omnibot chat

# 5. One-shot query
omnibot chat -m "What is the weather today?"
```

### CLI Commands

- `omnibot login --token <TOKEN> [--base-url <URL>]` - Configure access credentials
- `omnibot whoami` - Show current user information
- `omnibot chat` - Interactive REPL for conversations
- `omnibot chat -m "message" [-c conversation-id]` - Send single message
- `omnibot health` - Check API health status

See [cli/README.md](cli/README.md) for detailed CLI documentation including:
- Token provisioning
- Configuration management
- Advanced usage examples
- Troubleshooting

## Development

### Quick Start

```bash
# Install dependencies (installs git hooks automatically)
npm install

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

### Git Hooks (Automatic Quality Checks)

OmniBot uses Git hooks to enforce code quality standards locally:

- **Pre-commit hook**: Runs ESLint on all staged files
  - Blocks commits with linting errors
  - Run `npm run lint:fix` to auto-fix issues
  - Bypass (emergency only): `git commit --no-verify`

- **Pre-push hook**: Runs the full test suite
  - Blocks pushes with test failures
  - Run `npm test` locally to see failures
  - Bypass (emergency only): `git push --no-verify`

**Note:** Even if you bypass local hooks, your code must still pass CI/CD validation before it can be merged.

### Development Workflow

1. **Clone and setup**: `git clone <repo> && cd omnibot && npm install`
2. **Create branch**: `git checkout -b feature/your-feature`
3. **Make changes**: Edit code, add tests
4. **Commit**: `git commit -m "Your message"` (pre-commit hook runs)
5. **Push**: `git push origin feature/your-feature` (pre-push hook runs)
6. **Create PR**: PR validation runs automatically
7. **Review & merge**: Once approved and validated, merge to main

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## CI/CD Pipeline

OmniBot uses a comprehensive CI/CD pipeline with multiple validation gates to ensure code quality.

### Pipeline Stages

1. **Pull Request Validation** (Automatic)
   - Triggers on: All PRs to main, staging, or develop
   - Checks: Linting, full test suite, build verification
   - **Required to pass before merging**

2. **Staging Deployment** (Automatic)
   - Triggers on: Push to staging/develop, PRs to main
   - URL: https://omnibot-staging.jonanscheffler.workers.dev
   - Steps: Lint → Test → Build → Deploy → Verify
   - Purpose: Test in production-like environment

3. **Production Deployment** (Automatic on main)
   - Triggers on: Push to main branch
   - URL: https://omnibot.jonanscheffler.workers.dev
   - Steps: Install → Lint → Test → Build → Deploy → Verify
   - Gates: All validation must pass

4. **Production Promotion** (Manual)
   - Requires: Manual trigger + typing "promote"
   - Steps: Validate staging → Smoke tests → Build → Deploy

### Validation Gates

All deployments must pass these gates (blocks on failure):

- 🛑 **Linting**: ESLint errors block commits and CI/CD
- 🛑 **Tests**: Test failures block pushes and deployments
- 🛑 **Build**: Build must produce valid output (>100KB with HTML)
- 🛑 **Post-deployment**: Health checks and content verification

### Manual Verification

```bash
# Verify staging deployment
./scripts/verify-deployment.sh staging

# Verify production deployment
./scripts/verify-deployment.sh production
```

### Pipeline Documentation

See [docs/CI_CD_PIPELINE.md](docs/CI_CD_PIPELINE.md) for comprehensive pipeline documentation including:
- Detailed workflow explanations
- Troubleshooting guide
- Historical deployment failures
- Maintenance procedures

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
