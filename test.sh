#!/bin/bash

echo "🧪 Testing Omni-Agent Setup"
echo "==========================="
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo "✓ Node.js installed: $(node --version)"
else
    echo "✗ Node.js not found"
fi

# Check npm
if command -v npm &> /dev/null; then
    echo "✓ npm installed: $(npm --version)"
else
    echo "✗ npm not found"
fi

# Check Python
if command -v python3 &> /dev/null; then
    echo "✓ Python installed: $(python3 --version)"
else
    echo "✗ Python3 not found"
fi

# Check wrangler
if command -v npx &> /dev/null; then
    if npx wrangler --version &> /dev/null; then
        echo "✓ Wrangler available"
    else
        echo "⚠ Wrangler not installed (will be installed during setup)"
    fi
else
    echo "✗ npx not available"
fi

# Check git
if command -v git &> /dev/null; then
    echo "✓ Git installed: $(git --version)"
else
    echo "✗ Git not found"
fi

# Check .env
if [ -f .env ]; then
    echo "✓ .env file exists"
    
    source .env
    
    if [ -n "$SHARED_SECRET" ]; then
        echo "  ✓ Shared secret configured"
    else
        echo "  ✗ Shared secret missing"
    fi
    
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        echo "  ✓ Anthropic API key configured"
    else
        echo "  ⚠ Anthropic API key missing"
    fi
    
    if [ -n "$GROQ_API_KEY" ]; then
        echo "  ✓ Groq API key configured"
    else
        echo "  ⚠ Groq API key missing"
    fi
    
else
    echo "⚠ .env file not found (will be created during setup)"
fi

# Check project structure
echo ""
echo "Project Structure:"
if [ -f cloudflare-worker/src/index.js ]; then
    echo "  ✓ Worker code exists"
else
    echo "  ✗ Worker code missing"
fi

if [ -f frontend/index.html ]; then
    echo "  ✓ Frontend exists"
else
    echo "  ✗ Frontend missing"
fi

if [ -f scripts/deploy_runloop.py ]; then
    echo "  ✓ Runloop script exists"
else
    echo "  ✗ Runloop script missing"
fi

echo ""
echo "======================="
if [ -f .env ] && [ -n "$SHARED_SECRET" ] && [ -n "$GROQ_API_KEY" ]; then
    echo "✅ Ready to deploy!"
    echo ""
    echo "Run: ./deploy.sh"
else
    echo "⚠️  Setup needed"
    echo ""
    echo "Run: ./setup.sh"
fi
