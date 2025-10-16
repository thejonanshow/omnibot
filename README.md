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

## Cost

~$2/month (mostly free tiers)

## License

MIT
