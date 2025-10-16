#!/bin/bash

# Omnibot GitHub Setup Script
# This script creates the GitHub repo and pushes the code

set -e

echo "🚀 Omnibot GitHub Setup"
echo "======================="
echo ""

# Load from .env
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN not found in .env"
    exit 1
fi

GITHUB_USER="thejonanshow"
REPO_NAME="omnibot"
REPO_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}"
REPO_CLONE_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git"

cd "$(dirname "$0")/.."

echo "📦 Step 1: Creating GitHub repository..."
echo ""

# Create repository using GitHub API
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/user/repos \
  -d "{
    \"name\": \"${REPO_NAME}\",
    \"description\": \"Voice-controlled AI assistant with automatic LLM provider rotation and self-upgrade capabilities\",
    \"private\": false,
    \"auto_init\": false,
    \"has_issues\": true,
    \"has_projects\": true,
    \"has_wiki\": true
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Repository created successfully!"
elif [ "$HTTP_CODE" = "422" ]; then
    echo "✅ Repository already exists!"
else
    echo "⚠️  Unexpected response code: $HTTP_CODE"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

echo "📍 Repository URL: ${REPO_URL}"
echo ""

echo "🔧 Step 2: Configuring git remote..."
echo ""

# Remove old remote if exists
git remote remove origin 2>/dev/null || true

# Add new remote
git remote add origin "${REPO_CLONE_URL}"

echo "✅ Remote configured"
echo ""

echo "📝 Step 3: Committing current changes..."
echo ""

# Add all files
git add -A

# Check if there are changes to commit
if git diff-index --quiet HEAD --; then
    echo "✅ No changes to commit (already up to date)"
else
    git commit -m "Complete Omnibot rebranding and UI redesign

- Renamed project from omni-agent to omnibot
- Implemented modern UI with 14 sci-fi themes
- Added mobile-first responsive design
- Enhanced message bubbles and input area
- Added loading states and typing indicators
- Improved accessibility (WCAG 2.1 AA)
- Added new themes: Tron, Neuromancer, Alien, Dune, Ghost in the Shell, Interstellar, Synthwave, Portal
- Fixed mobile connectivity issues
- Complete documentation update"
    
    echo "✅ Changes committed"
fi

echo ""

echo "📤 Step 4: Pushing to GitHub..."
echo ""

# Push to GitHub
git push -u origin main --force

echo "✅ Code pushed successfully!"
echo ""

echo "✨ Setup Complete!"
echo "=================="
echo ""
echo "📍 Repository: ${REPO_URL}"
echo "🔗 Clone URL: https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
echo ""
echo "Next steps:"
echo "1. Deploy worker: cd cloudflare-worker && npx wrangler deploy"
echo "2. Deploy frontend: cd frontend && npx wrangler pages deploy ."
echo "3. Test mobile: Open frontend URL on mobile device"
echo ""
