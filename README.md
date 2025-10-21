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

# Deploy
npm run deploy
```

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

## Configuration

Set via `npm run setup` or manually in `.env`:

```env
# LLM Providers (at least one required)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=

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
