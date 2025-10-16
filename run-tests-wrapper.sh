#!/bin/bash
set -e

cd /Users/jonan/src/claudebox/omnibot

# Source user's shell profile to get npm
source ~/.zshrc 2>/dev/null || source ~/.bash_profile 2>/dev/null || true

echo "🧪 Running Omnibot Test Suite"
echo "=============================="
echo ""

# Check Node/npm
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Run tests with coverage
echo "Running tests with coverage..."
echo ""
npm run test:coverage

echo ""
echo "=============================="
echo "✅ Tests complete!"
echo ""
echo "📊 View coverage report:"
echo "   open coverage/index.html"
