#!/bin/bash
set -e

# Source environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

echo "🚀 OMNI-AGENT DEPLOYMENT"
echo "========================"
echo ""

# Check if basic deployment is requested (function calling is now default)
if [ "$1" = "--basic" ] || [ "$1" = "-b" ]; then
    echo "🔧 Basic deployment requested (legacy mode)"
    echo "This will deploy without function calling capabilities"
    echo ""
    read -p "Continue with basic deployment? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        echo "Proceeding with basic deployment..."
    else
        echo "Basic deployment cancelled"
        exit 0
    fi
else
    # Function calling deployment is now the default
    echo "🔧 Deploying with function calling capabilities"
    echo "This includes web browsing, command execution, and shared context"
    echo ""
    read -p "Continue with deployment? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        echo "🚀 Deploying with function calling capabilities..."

        # Create backup only if this is a production deployment
        if [ "$2" = "--backup" ] || [ "$2" = "-b" ]; then
            BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
            mkdir -p "$BACKUP_DIR"
            if [ -f "cloudflare-worker/wrangler.toml" ]; then
                cp "cloudflare-worker/wrangler.toml" "$BACKUP_DIR/wrangler.toml"
            fi
            if [ -f "deployment-urls.txt" ]; then
                cp "deployment-urls.txt" "$BACKUP_DIR/deployment-urls.txt"
            fi
            if [ -f ".env" ]; then
                cp ".env" "$BACKUP_DIR/.env"
            fi
            echo "✓ Backup created in: $BACKUP_DIR"
        else
            echo "ℹ️  No backup created (use --backup flag for production deployments)"
        fi

        # Deploy Runloop with function calling using blueprint manager
        if [ -n "$RUNLOOP_API_KEY" ]; then
            echo "🌐 Deploying Runloop services with blueprint manager..."
            python3 blueprint_manager.py
            if [ $? -eq 0 ]; then
                echo "✓ Runloop deployment successful"
            else
                echo "❌ Runloop deployment failed"
                exit 1
            fi
        else
            echo "⚠️  RUNLOOP_API_KEY not set, skipping Runloop deployment"
        fi

        # Deploy Cloudflare Worker
        echo "📦 Deploying Cloudflare Worker with function calling..."
        cd cloudflare-worker

        # Check if CONTEXT namespace exists
        CONTEXT_ID=$(npx wrangler kv:namespace list 2>&1 | grep -oE 'id = "[^"]+"' | grep -v "USAGE\|CHALLENGES" | head -1 | cut -d'"' -f2 || echo "")

        if [ -z "$CONTEXT_ID" ]; then
            echo "📦 Creating CONTEXT KV namespace..."
            CONTEXT_ID=$(npx wrangler kv:namespace create "CONTEXT" 2>&1 | grep -oE 'id = "[^"]+"' | head -1 | cut -d'"' -f2)
            echo "✓ CONTEXT namespace created: $CONTEXT_ID"
        else
            echo "✓ CONTEXT namespace already exists: $CONTEXT_ID"
        fi

        # Update wrangler.toml with CONTEXT namespace
        if [ -f "wrangler.toml" ] && ! grep -q "binding = \"CONTEXT\"" wrangler.toml; then
            cat >> wrangler.toml << EOF

[[kv_namespaces]]
binding = "CONTEXT"
id = "$CONTEXT_ID"
EOF
            echo "✓ CONTEXT namespace added to wrangler.toml"
        fi

        # Deploy worker
        DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
        echo "$DEPLOY_OUTPUT"

        # Extract worker URL
        WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^ ]+\.workers\.dev' | head -1)
        if [ -z "$WORKER_URL" ]; then
            WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^/]+workers\.dev[^ ]*' | head -1)
        fi
        if [ -z "$WORKER_URL" ]; then
            WORKER_URL="https://omni-agent-router.YOUR_SUBDOMAIN.workers.dev"
        fi

        cd ..

        # Deploy frontend
        echo "🎨 Deploying Frontend..."
        cd frontend
        if [ -f "index.html" ]; then
            echo "✓ Frontend files present"
        else
            echo "❌ Frontend files missing"
            exit 1
        fi
        cd ..

        echo "✅ DEPLOYMENT COMPLETE!"
        echo "======================="
        echo ""
        echo "🎯 Worker API: $WORKER_URL"
        echo "🌐 Frontend UI: https://omni-agent-ui.pages.dev"
        echo ""
        echo "🔧 NEW CAPABILITIES:"
        echo "   • Function calling for Groq"
        echo "   • Command execution via Runloop"
        echo "   • Web browsing with Playwright"
        echo "   • File operations"
        echo "   • Shared context storage"
        echo ""
        echo "🎤 To Test Function Calling Features:"
        echo ""
        echo "1. Open: https://omni-agent-ui.pages.dev"
        echo "2. Click ⚙️ Settings"
        echo "3. Router URL: $WORKER_URL"
        echo "4. Shared Secret: $SHARED_SECRET"
        echo "5. Click Save"
        echo "6. Try: 'List the files in the current directory'"
        echo "7. Try: 'Browse to https://example.com'"
        echo "8. Try: 'Run the command: ls -la'"
        echo ""
        echo "💾 Backup saved in: $BACKUP_DIR"
        echo "🔄 Rollback command: ./rollback.sh $BACKUP_DIR"
        echo ""
        exit 0
    else
        echo "Deployment cancelled"
        exit 0
    fi
fi

# Check if .env exists and has required keys
if [ ! -f .env ]; then
    echo "No configuration found. Running setup..."
    ./setup.sh
else
    # Source and check for required keys
    set -a
    source .env 2>/dev/null || true
    set +a

    if [ -z "$SHARED_SECRET" ] || [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$GROQ_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
        echo "Incomplete configuration. Running setup..."
        ./setup.sh
    else
        echo "✓ Configuration found"

        # Re-source after potential setup
        set -a
        source .env 2>/dev/null || true
        set +a
    fi
fi

# Deploy Cloudflare Worker
echo ""
echo "📦 Deploying Cloudflare Worker..."
cd cloudflare-worker
npm install

# Deploy and capture output
DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract worker URL
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^ ]+\.workers\.dev' | head -1)

if [ -z "$WORKER_URL" ]; then
    # Try alternative pattern
    WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^/]+workers\.dev[^ ]*' | head -1)
fi

if [ -z "$WORKER_URL" ]; then
    echo "⚠️  Could not extract worker URL from deploy output"
    WORKER_URL="https://omni-agent-router.YOUR_SUBDOMAIN.workers.dev"
fi

cd ..

# Deploy frontend
echo ""
echo "🎨 Deploying Frontend..."
cd frontend

# Create _routes.json
cat > _routes.json << EOF
{
  "version": 1,
  "include": ["/*"],
  "exclude": []
}
EOF

# Ensure project exists
echo "Checking if Pages project exists..."
if ! npx wrangler pages project list 2>&1 | grep -q "omni-agent-ui"; then
    echo "Creating Pages project..."
    npx wrangler pages project create omni-agent-ui --production-branch main
fi

# Deploy to Pages
echo "Deploying to Cloudflare Pages..."
FRONTEND_DEPLOY=$(npx wrangler pages deploy . --project-name omni-agent-ui --commit-dirty=true 2>&1)
echo "$FRONTEND_DEPLOY"

# Extract frontend URL
FRONTEND_URL=$(echo "$FRONTEND_DEPLOY" | grep -oE 'https://[^ ]+\.pages\.dev' | head -1)

if [ -z "$FRONTEND_URL" ]; then
    # Try to get from pages list
    FRONTEND_URL=$(npx wrangler pages deployment list --project-name omni-agent-ui 2>&1 | grep -oE 'https://[^ ]+\.pages\.dev' | head -1)
fi

if [ -z "$FRONTEND_URL" ]; then
    echo "⚠️  Could not extract frontend URL"
    FRONTEND_URL="https://omni-agent-ui.pages.dev"
fi

cd ..

# Save URLs
cat > deployment-urls.txt << EOF
WORKER_URL=$WORKER_URL
FRONTEND_URL=$FRONTEND_URL
SHARED_SECRET=$SHARED_SECRET
EOF

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================="
echo ""
echo "🎯 Worker API: $WORKER_URL"
echo "🌐 Frontend UI: $FRONTEND_URL"
echo ""
echo "🔐 Configuration:"
echo "   Shared Secret: $SHARED_SECRET"
echo ""
echo "🎤 To Start Using Omni-Agent:"
echo ""
echo "1. Open: $FRONTEND_URL"
echo "2. Click ⚙️ Settings"
echo "3. Router URL: $WORKER_URL"
echo "4. Shared Secret: $SHARED_SECRET"
echo "5. Click Save"
echo "6. Click 🎤 Speak and start talking!"
echo ""
if [ -n "$RUNLOOP_URL" ]; then
    echo "🎙️  Voice Services: $RUNLOOP_URL"
    echo ""
fi
echo "💾 URLs saved to: deployment-urls.txt"
echo ""
echo "🔧 Want self-upgrade capability?"
echo "   Say: 'upgrade mode' then describe changes"
echo "   (Requires GitHub setup - run ./setup.sh if not configured)"
echo ""
echo "🔧 Function calling is now the default!"
echo "   Run: ./deploy.sh (with function calling capabilities)"
echo "   Run: ./deploy.sh --basic (legacy mode without function calling)"
echo "   Run: ./deploy.sh --backup (create backup before deployment)"
echo "   Includes: command execution, web browsing, and shared context"
echo ""
