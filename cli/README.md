# Omnibot CLI

Command-line interface for interacting with the Omnibot AI assistant.

## Installation

From the CLI directory:

```bash
npm install
npm link  # Makes 'omnibot' command available globally
```

Or install directly from the repository root:

```bash
cd cli
npm install
npm link
```

## Configuration

The CLI stores configuration in `~/.omnibot/config.json` with the following structure:

```json
{
  "baseUrl": "https://omnibot.jonanscheffler.workers.dev",
  "accessToken": "your-token-here"
}
```

You can override the base URL using the `OMNIBOT_BASE_URL` environment variable:

```bash
export OMNIBOT_BASE_URL=https://omnibot-staging.jonanscheffler.workers.dev
omnibot whoami
```

## Authentication

### Provisioning Tokens

CLI tokens must be provisioned manually in the Cloudflare Workers `CLI_TOKENS` KV namespace. The token data should be stored as JSON:

```json
{
  "id": "user123",
  "email": "user@example.com",
  "scopes": ["chat", "whoami"],
  "expires_at": 1735689600000
}
```

**Key:** A randomly generated token string (e.g., UUID)  
**Value:** JSON with user metadata

To create a token using Wrangler:

```bash
# Generate a token
TOKEN=$(uuidgen)

# Create token entry in KV
wrangler kv:key put --namespace-id="YOUR_KV_ID" \
  "$TOKEN" \
  '{"id":"user123","email":"user@example.com","scopes":["chat","whoami"]}'

echo "Token: $TOKEN"
```

### Logging In

Once you have a token, configure the CLI:

```bash
omnibot login --token YOUR_TOKEN_HERE
```

With custom base URL:

```bash
omnibot login --token YOUR_TOKEN --base-url https://custom-url.workers.dev
```

## Commands

### `omnibot login`

Configure access token and base URL.

**Options:**
- `-t, --token <token>` - Access token (required)
- `-b, --base-url <url>` - Base URL (optional, defaults to production)

**Example:**
```bash
omnibot login --token abc123xyz --base-url https://omnibot-staging.jonanscheffler.workers.dev
```

### `omnibot whoami`

Display current user information and verify credentials.

**Example:**
```bash
omnibot whoami
```

**Output:**
```
✓ Authenticated

User Information:
  ID:     user123
  Email:  user@example.com
  Source: cli
  Scopes: chat, whoami

  Base URL: https://omnibot.jonanscheffler.workers.dev
```

### `omnibot chat`

Interactive chat REPL or one-shot message.

**Options:**
- `-m, --message <message>` - Send a single message (one-shot mode)
- `-c, --conversation-id <id>` - Continue a specific conversation

**Interactive Mode:**
```bash
omnibot chat
```

Type your messages and press Enter. Type `exit` or `quit` to leave.

**One-shot Mode:**
```bash
omnibot chat -m "What is the weather today?"
```

**Continue a conversation:**
```bash
omnibot chat -m "Tell me more" -c conv_1234567890_abc123
```

### `omnibot health`

Check the health status of the Omnibot API.

**Example:**
```bash
omnibot health
```

**Output:**
```
✓ API is healthy

Status:
  OK:      true
  Version: ⚡ Electric Eel v1.1.1

  Base URL: https://omnibot.jonanscheffler.workers.dev
```

## Usage Examples

### Basic Workflow

```bash
# 1. Login
omnibot login --token YOUR_TOKEN

# 2. Verify credentials
omnibot whoami

# 3. Check API health
omnibot health

# 4. Interactive chat
omnibot chat

# 5. One-shot queries
omnibot chat -m "What are some interesting facts about electric eels?"
```

### Working with Conversations

```bash
# Start a conversation
omnibot chat -m "I need help with a coding problem"

# Note the conversation ID from the output, then continue:
omnibot chat -m "Here's my code..." -c conv_1234567890_abc123

# Continue in interactive mode
omnibot chat -c conv_1234567890_abc123
```

### Using Different Environments

```bash
# Use staging environment
export OMNIBOT_BASE_URL=https://omnibot-staging.jonanscheffler.workers.dev
omnibot whoami

# Or use production (default)
unset OMNIBOT_BASE_URL
omnibot whoami
```

## Architecture

The CLI is structured as follows:

- **`bin/omnibot.js`** - Executable entry point (shebang)
- **`src/index.js`** - Main CLI logic and command definitions
- **`src/config.js`** - Configuration file management
- **`src/api.js`** - HTTP API client

### API Integration

The CLI calls the following backend endpoints:

- `GET /api/cli/whoami` - Get user information
- `POST /api/cli/chat` - Send chat messages
- `GET /api/health` - Health check (no auth required)

All authenticated endpoints require a `Bearer` token in the `Authorization` header.

## Backend Requirements

The CLI requires the following backend components:

1. **KV Namespace:** `CLI_TOKENS` for storing access tokens
2. **Endpoints:** `/api/cli/whoami` and `/api/cli/chat`
3. **Auth:** Bearer token authentication via `cli-auth.js`
4. **Conversations:** KV-based conversation storage via `conversations.js`

See the main repository documentation for backend setup details.

## Troubleshooting

### "Not logged in" error

Run `omnibot login --token YOUR_TOKEN` to configure your credentials.

### "Failed to connect" error

Check that:
1. Your network connection is working
2. The base URL is correct (check with `OMNIBOT_BASE_URL`)
3. The Omnibot API is running and accessible

### "Unauthorized" error

Your token may be:
- Invalid or expired
- Not properly provisioned in the `CLI_TOKENS` KV namespace
- Missing required scopes

Try re-logging in or provisioning a new token.

### Configuration issues

Check your config file at `~/.omnibot/config.json` to verify the token and base URL are correct.

## Development

To work on the CLI:

```bash
cd cli
npm install

# Test locally without installing globally
node bin/omnibot.js --help

# Run with a specific command
node bin/omnibot.js whoami
```

## Future Enhancements

Potential features for future iterations:

- Google OAuth device flow for authentication
- `omnibot conversations list` - List recent conversations
- `omnibot conversations show <id>` - Display conversation history
- `omnibot edit` - Trigger self-edit workflows from CLI
- Output formatting options (JSON, table, etc.)
- Streaming responses for real-time output
- Shell completion (bash, zsh)
- Configuration profiles for multiple accounts/environments

## License

MIT
