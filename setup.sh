#!/bin/bash
set -e

echo "⚙️  OMNI-AGENT SETUP"
echo "==================="
echo ""

# Create .env if doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
fi

# Source the .env file to check what we have
set -a
source .env 2>/dev/null || true
set +a

echo "🔍 Checking existing configuration..."
echo ""

# Function to prompt for API key
prompt_key() {
    local name=$1
    local url=$2
    local var_name=$3
    local current_value=${!var_name}
    
    if [ -n "$current_value" ] && [ "$current_value" != "" ]; then
        echo "✓ $name already configured"
        return
    fi
    
    echo ""
    echo "❌ $name not found"
    echo "📖 Opening $url..."
    
    # Open browser
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$url"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$url" 2>/dev/null || echo "Please open: $url"
    fi
    
    echo ""
    read -p "Enter your $name (or press Enter to skip): " key
    
    if [ -z "$key" ]; then
        echo "⚠️  Skipped. You can add this later."
        return
    fi
    
    # Update .env
    if grep -q "^${var_name}=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${var_name}=.*|${var_name}=${key}|" .env
        else
            sed -i "s|^${var_name}=.*|${var_name}=${key}|" .env
        fi
    else
        echo "${var_name}=${key}" >> .env
    fi
    
    export ${var_name}="${key}"
}

# Generate shared secret if needed
if [ -z "$SHARED_SECRET" ]; then
    echo "🔐 Generating shared secret..."
    SECRET=$(openssl rand -hex 32)
    if grep -q "^SHARED_SECRET=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^SHARED_SECRET=.*|SHARED_SECRET=${SECRET}|" .env
        else
            sed -i "s|^SHARED_SECRET=.*|SHARED_SECRET=${SECRET}|" .env
        fi
    else
        echo "SHARED_SECRET=${SECRET}" >> .env
    fi
    export SHARED_SECRET="$SECRET"
    echo "✓ Shared secret generated"
fi

# Check Node.js
echo ""
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        read -p "Install Node.js with Homebrew? (y/n): " install_node
        if [ "$install_node" = "y" ]; then
            brew install node
        else
            echo "Please install Node.js from https://nodejs.org"
            exit 1
        fi
    else
        echo "Please install Node.js from https://nodejs.org"
        exit 1
    fi
else
    echo "✓ Node.js installed: $(node --version)"
fi

# Install wrangler if needed
if ! command -v npx &> /dev/null; then
    echo "📦 Installing Wrangler..."
    npm install -g wrangler
fi

# Login to Cloudflare
echo ""
echo "🔐 Cloudflare Authentication"
if ! npx wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare..."
    npx wrangler login
else
    echo "✓ Already logged in to Cloudflare"
fi

# Re-source .env to get any updates
set -a
source .env 2>/dev/null || true
set +a

# Prompt for API keys
echo ""
echo "🔑 API Key Configuration"
echo "========================"

prompt_key "Anthropic API Key" "https://console.anthropic.com/settings/keys" "ANTHROPIC_API_KEY"
prompt_key "OpenAI API Key" "https://platform.openai.com/api-keys" "OPENAI_API_KEY"
prompt_key "Groq API Key" "https://console.groq.com/keys" "GROQ_API_KEY"
prompt_key "Gemini API Key" "https://makersuite.google.com/app/apikey" "GEMINI_API_KEY"

# Runloop setup
echo ""
echo "🎤 Voice Services (Runloop)"
echo "==========================="
read -p "Deploy voice services to Runloop? (y/n): " use_runloop

if [ "$use_runloop" = "y" ]; then
    prompt_key "Runloop API Key" "https://runloop.ai/dashboard" "RUNLOOP_API_KEY"
    
    echo ""
    echo "🚀 Deploying to Runloop..."
    echo "This will set up Whisper (speech-to-text) and Piper (text-to-speech)"
    
    if [ -n "$RUNLOOP_API_KEY" ]; then
        python3 scripts/deploy_runloop.py
        
        # Get Runloop URL
        if [ -f .runloop_url ]; then
            RUNLOOP_URL=$(cat .runloop_url)
            if grep -q "^RUNLOOP_URL=" .env; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s|^RUNLOOP_URL=.*|RUNLOOP_URL=${RUNLOOP_URL}|" .env
                else
                    sed -i "s|^RUNLOOP_URL=.*|RUNLOOP_URL=${RUNLOOP_URL}|" .env
                fi
            fi
            echo "✓ Runloop deployed: $RUNLOOP_URL"
        fi
    else
        echo "⚠️  Runloop API key missing, skipping deployment"
    fi
else
    echo "⚠️  Skipping Runloop. Voice will use browser APIs only."
fi

# GitHub setup for self-upgrade
echo ""
echo "🔧 Self-Upgrade Capability (Optional)"
echo "======================================"
echo "This allows you to modify the system using voice commands!"
read -p "Enable self-upgrade? (y/n): " enable_upgrade

if [ "$enable_upgrade" = "y" ]; then
    prompt_key "GitHub Personal Access Token" "https://github.com/settings/tokens/new?scopes=repo&description=Omni-Agent" "GITHUB_TOKEN"
    
    if [ -z "$GITHUB_REPO" ]; then
        echo ""
        read -p "Enter GitHub repo (format: username/repo): " repo
        if [ -n "$repo" ]; then
            if grep -q "^GITHUB_REPO=" .env; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s|^GITHUB_REPO=.*|GITHUB_REPO=${repo}|" .env
                else
                    sed -i "s|^GITHUB_REPO=.*|GITHUB_REPO=${repo}|" .env
                fi
            fi
            export GITHUB_REPO="$repo"
        fi
    fi
    
    # Cloudflare credentials
    echo ""
    echo "Getting Cloudflare Account ID..."
    ACCOUNT_ID=$(npx wrangler whoami 2>&1 | grep -i "account id" | awk '{print $NF}' | tr -d '\n' || echo "")
    
    if [ -n "$ACCOUNT_ID" ]; then
        if grep -q "^CLOUDFLARE_ACCOUNT_ID=" .env; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^CLOUDFLARE_ACCOUNT_ID=.*|CLOUDFLARE_ACCOUNT_ID=${ACCOUNT_ID}|" .env
            else
                sed -i "s|^CLOUDFLARE_ACCOUNT_ID=.*|CLOUDFLARE_ACCOUNT_ID=${ACCOUNT_ID}|" .env
            fi
        fi
        echo "✓ Cloudflare Account ID: $ACCOUNT_ID"
    fi
    
    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        prompt_key "Cloudflare API Token" "https://dash.cloudflare.com/profile/api-tokens" "CLOUDFLARE_API_TOKEN"
    fi
    
    echo ""
    echo "✅ Self-upgrade enabled!"
    echo "   Say 'upgrade mode' then describe changes"
fi

# Create KV namespaces
echo ""
echo "📦 Creating Cloudflare KV Namespaces..."
cd cloudflare-worker

# Generate package-lock.json if needed
if [ ! -f package-lock.json ]; then
    npm install --package-lock-only
fi

USAGE_ID=$(npx wrangler kv:namespace create "USAGE" 2>&1 | grep -oE 'id = "[^"]+"' | head -1 | cut -d'"' -f2)
CHALLENGES_ID=$(npx wrangler kv:namespace create "CHALLENGES" 2>&1 | grep -oE 'id = "[^"]+"' | head -1 | cut -d'"' -f2)

# Re-source to get latest values
cd ..
set -a
source .env 2>/dev/null || true
set +a

# Update wrangler.toml
cd cloudflare-worker
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

# Set secrets
echo ""
echo "🔐 Setting Cloudflare Secrets..."

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "$ANTHROPIC_API_KEY" | npx wrangler secret put ANTHROPIC_API_KEY
fi

if [ -n "$OPENAI_API_KEY" ]; then
    echo "$OPENAI_API_KEY" | npx wrangler secret put OPENAI_API_KEY
fi

if [ -n "$GROQ_API_KEY" ]; then
    echo "$GROQ_API_KEY" | npx wrangler secret put GROQ_API_KEY
fi

if [ -n "$GEMINI_API_KEY" ]; then
    echo "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY
fi

if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | npx wrangler secret put GITHUB_TOKEN
fi

if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    echo "$CLOUDFLARE_API_TOKEN" | npx wrangler secret put CLOUDFLARE_API_TOKEN
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next: Run ./deploy.sh to deploy everything"
echo ""
