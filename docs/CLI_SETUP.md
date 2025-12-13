# Omnibot CLI Setup Guide

This guide covers setting up the backend infrastructure and provisioning tokens for the Omnibot CLI.

## Prerequisites

- Cloudflare Workers account with Wrangler CLI installed
- Access to the Omnibot worker deployment
- Node.js 18+ for CLI usage

## Backend Setup

### 1. Create CLI_TOKENS KV Namespace

Create a new KV namespace for storing CLI authentication tokens:

```bash
# Create KV namespace
wrangler kv:namespace create "CLI_TOKENS"

# For preview/development environment
wrangler kv:namespace create "CLI_TOKENS" --preview
```

This will output a namespace ID. Note it for the next step.

**Example output:**
```
⛅️ wrangler 3.x.x
-------------------
🌀  Creating namespace with title "omnibot-CLI_TOKENS"
✨  Success!
Add the following to your wrangler.toml:
[[kv_namespaces]]
binding = "CLI_TOKENS"
id = "abc123def456..."
```

### 2. Update wrangler.toml

Update `cloudflare-worker/wrangler.toml` with the actual KV namespace ID:

```toml
[[kv_namespaces]]
binding = "CLI_TOKENS"
id = "abc123def456..."  # Replace with your actual namespace ID
```

Remove or update the `CLI_TOKENS_KV_ID_PLACEHOLDER` line.

### 3. Deploy Worker

Build and deploy the worker with the new KV binding:

```bash
# Build consolidated worker
npm run build

# Deploy to staging
cd cloudflare-worker
wrangler deploy --env staging

# Or deploy to production
wrangler deploy
```

## Token Provisioning

CLI tokens must be manually provisioned in the `CLI_TOKENS` KV namespace.

### Token Structure

Each token is stored as a key-value pair:

**Key:** A randomly generated token string (e.g., UUID)
**Value:** JSON object with user metadata

```json
{
  "id": "user123",
  "email": "user@example.com",
  "scopes": ["chat", "whoami"],
  "expires_at": 1735689600000
}
```

**Fields:**
- `id` (required): Unique user identifier
- `email` (optional): User email for display
- `scopes` (required): Array of permitted actions
  - `chat`: Allow chat API access
  - `whoami`: Allow whoami API access
  - `*`: Wildcard for all scopes
- `expires_at` (optional): Unix timestamp (milliseconds) for token expiry

### Provisioning Methods

#### Method 1: Using Wrangler CLI

```bash
# Generate a secure token
TOKEN=$(uuidgen)  # Or: openssl rand -hex 32

# Create token entry
wrangler kv:key put --namespace-id="YOUR_KV_NAMESPACE_ID" \
  "$TOKEN" \
  '{"id":"user123","email":"user@example.com","scopes":["chat","whoami"]}'

# Display token for user
echo "CLI Token: $TOKEN"
```

#### Method 2: Using Cloudflare Dashboard

1. Go to Workers & Pages → KV
2. Select the `CLI_TOKENS` namespace
3. Click "Add entry"
4. **Key:** Enter a secure random token (e.g., from `uuidgen`)
5. **Value:** Enter the JSON metadata
6. Click "Add"

#### Method 3: Bulk Provisioning Script

Create a script to provision multiple tokens:

```bash
#!/bin/bash
# provision-tokens.sh

NAMESPACE_ID="your_kv_namespace_id"

provision_token() {
  local user_id=$1
  local email=$2
  local scopes=$3
  
  local token=$(uuidgen)
  local json=$(cat <<EOF
{"id":"${user_id}","email":"${email}","scopes":${scopes}}
EOF
)
  
  wrangler kv:key put --namespace-id="$NAMESPACE_ID" "$token" "$json"
  
  echo "✓ Token provisioned for $email"
  echo "  Token: $token"
  echo ""
}

# Provision tokens
provision_token "user1" "alice@example.com" '["chat","whoami"]'
provision_token "user2" "bob@example.com" '["chat","whoami"]'
```

### Token with Expiry

To create a token that expires in 30 days:

```bash
# Calculate expiry timestamp (30 days from now)
EXPIRY=$(($(date +%s) * 1000 + 30 * 24 * 60 * 60 * 1000))

# Provision token
wrangler kv:key put --namespace-id="YOUR_KV_NAMESPACE_ID" \
  "$(uuidgen)" \
  "{\"id\":\"user123\",\"email\":\"user@example.com\",\"scopes\":[\"chat\",\"whoami\"],\"expires_at\":$EXPIRY}"
```

### Token Scopes

Currently supported scopes:

- `chat`: Access to `/api/cli/chat` endpoint
- `whoami`: Access to `/api/cli/whoami` endpoint
- `*`: All scopes (admin access)

Future scopes may include:
- `edit`: Self-edit capabilities
- `admin`: Administrative functions
- `read-only`: View-only access

## CLI Installation

Once tokens are provisioned, users can install and configure the CLI:

```bash
# Install CLI
cd cli
npm install
npm link  # Makes 'omnibot' available globally

# Login with provisioned token
omnibot login --token YOUR_TOKEN_HERE

# Verify
omnibot whoami
```

## Token Management

### List All Tokens

```bash
# List all keys in CLI_TOKENS namespace
wrangler kv:key list --namespace-id="YOUR_KV_NAMESPACE_ID"
```

### View Token Details

```bash
# Get specific token's metadata
wrangler kv:key get --namespace-id="YOUR_KV_NAMESPACE_ID" "token-value-here"
```

### Revoke Token

```bash
# Delete token
wrangler kv:key delete --namespace-id="YOUR_KV_NAMESPACE_ID" "token-value-here"
```

### Update Token Metadata

```bash
# Update scopes or other metadata
wrangler kv:key put --namespace-id="YOUR_KV_NAMESPACE_ID" \
  "existing-token" \
  '{"id":"user123","email":"user@example.com","scopes":["chat","whoami","edit"]}'
```

## Security Best Practices

### Token Generation

- Use cryptographically secure random token generation (UUIDs, `openssl rand`)
- Minimum token length: 32 characters
- Avoid predictable patterns or sequential values

### Token Storage

- Never commit tokens to source control
- Store tokens securely (password managers, secrets vaults)
- Use different tokens for different environments (dev, staging, prod)

### Token Distribution

- Communicate tokens via secure channels only
- Consider using time-limited tokens for temporary access
- Implement token rotation policy (e.g., quarterly)

### Monitoring

- Log CLI access via telemetry endpoints
- Monitor for suspicious activity patterns
- Set up alerts for high-volume token usage

## Troubleshooting

### Token Not Working

1. Verify token exists in KV:
   ```bash
   wrangler kv:key get --namespace-id="YOUR_KV_NAMESPACE_ID" "your-token"
   ```

2. Check token hasn't expired:
   ```bash
   # Get token metadata and check expires_at field
   wrangler kv:key get --namespace-id="YOUR_KV_NAMESPACE_ID" "your-token" | jq '.expires_at'
   ```

3. Verify KV binding in wrangler.toml:
   ```bash
   grep -A 2 "CLI_TOKENS" cloudflare-worker/wrangler.toml
   ```

### "Unauthorized" Errors

- Check token is correctly formatted in config: `~/.omnibot/config.json`
- Verify token has required scopes for the operation
- Ensure token hasn't been revoked

### KV Namespace Issues

- Confirm namespace ID is correct in wrangler.toml
- Verify deployment included the KV binding
- Check worker logs for KV access errors

## Environment Considerations

### Development

Use a separate KV namespace for development:

```toml
[[kv_namespaces]]
binding = "CLI_TOKENS"
id = "dev_namespace_id"
preview_id = "preview_namespace_id"
```

### Staging

Create staging-specific tokens with limited scopes:

```bash
wrangler kv:key put --namespace-id="STAGING_KV_ID" \
  "staging-token" \
  '{"id":"staging-user","scopes":["chat","whoami"]}'
```

### Production

- Use longer token expiry times (or no expiry)
- Implement audit logging
- Consider rate limiting per token
- Maintain backup of active tokens

## Migration from Existing Auth

If migrating from another auth system:

1. Create tokens for all existing users
2. Distribute tokens via secure communication
3. Update user documentation
4. Maintain backwards compatibility period
5. Deprecate old auth system

## Future Enhancements

Planned improvements to CLI authentication:

- **Google OAuth Device Flow**: Automated token generation via OAuth
- **Token Refresh**: Automatic token renewal
- **Scoped Tokens**: More granular permission controls
- **Usage Tracking**: Per-token analytics dashboard
- **Self-Service Portal**: Users generate their own tokens

## Support

For issues or questions:

1. Check CLI logs: `~/.omnibot/config.json`
2. Verify API health: `omnibot health`
3. Review worker logs in Cloudflare dashboard
4. Open an issue in the GitHub repository

## References

- [Cloudflare Workers KV Documentation](https://developers.cloudflare.com/kv/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Omnibot CLI README](../cli/README.md)
- [Omnibot Main README](../README.md)
