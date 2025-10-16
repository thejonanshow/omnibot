# Omni-Agent - Modern Setup Commands

## Quick Start

```bash
# One-time setup
npm run setup

# Deploy the system
npm run deploy

# Start the frontend
npm run start
```

## Available Commands

### Core Commands
- **`npm run setup`** - Interactive setup wizard (first time only)
- **`npm run deploy`** - Deploy the entire system
- **`npm run start`** - Start the frontend server
- **`npm run test`** - Run all test suites

### Development Commands
- **`npm run dev`** - Deploy and start (development workflow)
- **`npm run build`** - Alias for deploy

### Maintenance Commands
- **`npm run cleanup`** - Clean up unused cloud resources
- **`npm run rollback <backup-id>`** - Rollback to previous version

### Future Commands
- **`npm run lint`** - Code linting (to be configured)
- **`npm run format`** - Code formatting (to be configured)

## What Each Command Does

### `npm run setup`
- Checks prerequisites (Node.js 18+, npm, git)
- Prompts for API keys and environment variables
- Installs dependencies
- Sets up Cloudflare authentication
- Deploys initial Runloop services

### `npm run deploy`
- Creates backup (with `--backup` flag)
- Deploys Runloop services using blueprint manager
- Deploys Cloudflare Worker
- Runs health checks
- Shows deployment URLs

### `npm run start`
- Checks service health
- Starts frontend server on http://localhost:3000
- Provides access to the chat interface

### `npm run test`
- Runs Omni-Agent system tests
- Runs blueprint system tests
- Provides comprehensive test results

## Migration from Bash Scripts

| Old Command | New Command |
|-------------|-------------|
| `./setup.sh` | `npm run setup` |
| `./deploy.sh` | `npm run deploy` |
| `./start.sh` | `npm run start` |
| `./test.sh` | `npm run test` |
| `./rollback.sh <id>` | `npm run rollback <id>` |
| `python3 cleanup_resources.py` | `npm run cleanup` |

## Benefits of npm Scripts

✅ **Modern**: Uses Node.js instead of bash  
✅ **Cross-platform**: Works on Windows, macOS, Linux  
✅ **Consistent**: Same interface across all environments  
✅ **Discoverable**: `npm run` shows all available commands  
✅ **Extensible**: Easy to add new commands  
✅ **Integrated**: Works with npm ecosystem  

## Environment Variables

The setup script will prompt for these required variables:
- `GROQ_API_KEY` - Groq API key for LLM access
- `GEMINI_API_KEY` - Google Gemini API key
- `ANTHROPIC_API_KEY` - Claude API key
- `RUNLOOP_API_KEY` - Runloop API key for execution environment
- `GITHUB_TOKEN` - GitHub token for self-upgrade feature
- `SHARED_SECRET` - Secret for API authentication

## Troubleshooting

### Setup Issues
```bash
# If setup fails, check prerequisites
node --version  # Should be 18+
npm --version   # Should be available
git --version   # Should be available
```

### Deployment Issues
```bash
# Check environment variables
cat .env

# Manual deployment steps
npm run deploy --backup  # With backup
```

### Service Issues
```bash
# Check service health
npm run test

# Clean up and redeploy
npm run cleanup
npm run deploy
```

## Next Steps

1. **Run setup**: `npm run setup`
2. **Deploy system**: `npm run deploy`  
3. **Start frontend**: `npm run start`
4. **Open browser**: http://localhost:3000
5. **Start chatting**: Use the voice interface!

The system is now ready with modern, maintainable npm scripts! 🚀
