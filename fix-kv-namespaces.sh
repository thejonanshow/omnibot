#!/bin/bash
# Fix KV namespace creation for Wrangler 4.x

set -e

echo "🔧 Fixing KV Namespaces for Wrangler 4.x"
echo "========================================="
echo ""

cd cloudflare-worker

# Source the .env from parent directory
set -a
source ../.env 2>/dev/null || true
set +a

echo "📦 Creating KV Namespaces..."
echo ""

# Create USAGE namespace
echo "Creating USAGE namespace..."
USAGE_OUTPUT=$(npx wrangler kv namespace create "USAGE" 2>&1)
echo "$USAGE_OUTPUT"
USAGE_ID=$(echo "$USAGE_OUTPUT" | grep -oE '[0-9a-f]{32}' | head -1)

echo ""
echo "Creating CHALLENGES namespace..."
CHALLENGES_OUTPUT=$(npx wrangler kv namespace create "CHALLENGES" 2>&1)
echo "$CHALLENGES_OUTPUT"
CHALLENGES_ID=$(echo "$CHALLENGES_OUTPUT" | grep -oE '[0-9a-f]{32}' | head -1)

echo ""
echo "📝 Captured IDs:"
echo "  USAGE: $USAGE_ID"
echo "  CHALLENGES: $CHALLENGES_ID"

if [ -z "$USAGE_ID" ] || [ -z "$CHALLENGES_ID" ]; then
    echo ""
    echo "❌ Failed to capture namespace IDs"
    echo "Please create them manually:"
    echo "  npx wrangler kv namespace create USAGE"
    echo "  npx wrangler kv namespace create CHALLENGES"
    echo ""
    echo "Then update wrangler.toml with the IDs"
    exit 1
fi

# Update wrangler.toml
echo ""
echo "✍️  Updating wrangler.toml..."

cat > wrangler.toml << EOF
name = "omni-agent-router"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
SHARED_SECRET = "$SHARED_SECRET"
RUNLOOP_URL = "$RUNLOOP_URL"
GITHUB_REPO = "$GITHUB_REPO"
GITHUB_BRANCH = "$GITHUB_BRANCH"
CLOUDFLARE_ACCOUNT_ID = "$CLOUDFLARE_ACCOUNT_ID"

[[kv_namespaces]]
binding = "USAGE"
id = "$USAGE_ID"

[[kv_namespaces]]
binding = "CHALLENGES"
id = "$CHALLENGES_ID"
EOF

echo "✅ wrangler.toml updated!"
echo ""
echo "📋 Current configuration:"
cat wrangler.toml

cd ..

echo ""
echo "✅ KV Namespaces fixed!"
echo ""
echo "Next: Run ./deploy.sh to deploy"
