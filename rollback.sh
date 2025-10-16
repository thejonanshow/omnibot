#!/bin/bash
set -e

if [ $# -eq 0 ]; then
    echo "❌ Usage: ./rollback.sh <backup-directory>"
    echo ""
    echo "Available backups:"
    ls -la backup-* 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory '$BACKUP_DIR' not found"
    exit 1
fi

echo "🔄 OMNI-AGENT ROLLBACK"
echo "======================"
echo ""
echo "Rolling back from: $BACKUP_DIR"
echo ""

# Restore worker configuration
if [ -f "$BACKUP_DIR/wrangler.toml" ]; then
    echo "📦 Restoring worker configuration..."
    cp "$BACKUP_DIR/wrangler.toml" "cloudflare-worker/wrangler.toml"
    echo "✓ Worker config restored"
fi

# Restore deployment URLs
if [ -f "$BACKUP_DIR/deployment-urls.txt" ]; then
    echo "📦 Restoring deployment URLs..."
    cp "$BACKUP_DIR/deployment-urls.txt" "deployment-urls.txt"
    echo "✓ Deployment URLs restored"
fi

# Restore .env file
if [ -f "$BACKUP_DIR/.env" ]; then
    echo "📦 Restoring environment configuration..."
    cp "$BACKUP_DIR/.env" ".env"
    echo "✓ Environment config restored"
fi

# Deploy the restored worker
echo ""
echo "🚀 Deploying restored worker..."
cd cloudflare-worker

DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract worker URL
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^ ]+\.workers\.dev' | head -1)

if [ -z "$WORKER_URL" ]; then
    WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^/]+workers\.dev[^ ]*' | head -1)
fi

cd ..

# Test the restored worker
echo ""
echo "🧪 Testing restored worker..."
sleep 5  # Give deployment time to propagate

if curl -s "$WORKER_URL/health" > /dev/null; then
    echo "✓ Restored worker test passed"
else
    echo "❌ Restored worker test failed"
    echo "⚠️  Manual intervention may be required"
fi

echo ""
echo "✅ ROLLBACK COMPLETE!"
echo "====================="
echo ""
echo "🎯 Restored Worker API: $WORKER_URL"
echo "🌐 Frontend UI: https://omni-agent-ui.pages.dev"
echo ""
echo "🔧 System restored to previous working state"
echo "💾 Backup preserved in: $BACKUP_DIR"
echo ""
