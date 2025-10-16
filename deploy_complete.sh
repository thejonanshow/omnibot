#!/bin/bash

# Complete Omnibot Deployment Script
# Deploys worker, frontend, sets up GitHub, and tests mobile connectivity

set -e

echo "🚀 Omnibot Complete Deployment"
echo "=============================="
echo ""

cd "$(dirname "$0")/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Setup GitHub
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1/4: Setting up GitHub repository${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "scripts/setup_github.sh" ]; then
    ./scripts/setup_github.sh
else
    echo -e "${YELLOW}⚠️  GitHub setup script not found, skipping...${NC}"
fi

echo ""

# Step 2: Deploy Cloudflare Worker
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2/4: Deploying Cloudflare Worker${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd cloudflare-worker

echo "📦 Installing dependencies..."
npm install --silent

echo "🚀 Deploying worker..."
npx wrangler deploy

cd ..

# Get worker URL
WORKER_URL=$(grep -o 'https://[^"]*' cloudflare-worker/wrangler.toml | head -1 || echo "https://omnibot-router.jonanscheffler.workers.dev")

echo ""
echo -e "${GREEN}✅ Worker deployed!${NC}"
echo -e "📍 Worker URL: ${WORKER_URL}"

echo ""

# Step 3: Deploy Frontend
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3/4: Deploying Frontend${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd frontend

echo "🚀 Deploying frontend to Cloudflare Pages..."
FRONTEND_DEPLOY_OUTPUT=$(npx wrangler pages deploy . --project-name omnibot-ui 2>&1)

# Extract URL from output
FRONTEND_URL=$(echo "$FRONTEND_DEPLOY_OUTPUT" | grep -o 'https://[^[:space:]]*\.pages\.dev' | head -1 || echo "")

cd ..

if [ -z "$FRONTEND_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not extract frontend URL from deployment output${NC}"
    FRONTEND_URL="https://omnibot-ui.pages.dev"
else
    echo -e "${GREEN}✅ Frontend deployed!${NC}"
    echo -e "📍 Frontend URL: ${FRONTEND_URL}"
fi

echo ""

# Update deployment URLs file
echo "📝 Updating deployment URLs..."
cat > deployment-urls.txt << EOF
WORKER_URL=${WORKER_URL}
FRONTEND_URL=${FRONTEND_URL}
SHARED_SECRET=4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2
GITHUB_REPO=https://github.com/thejonanshow/omnibot
EOF

echo -e "${GREEN}✅ URLs saved to deployment-urls.txt${NC}"

echo ""

# Step 4: Test Mobile Connectivity
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4/4: Testing Mobile Connectivity${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

export WORKER_URL=${WORKER_URL}
export SHARED_SECRET="4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2"

if [ -f "scripts/test_mobile_connectivity.js" ]; then
    node scripts/test_mobile_connectivity.js
else
    echo -e "${YELLOW}⚠️  Mobile connectivity test not found, skipping...${NC}"
fi

echo ""

# Final Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📍 Deployment URLs:"
echo "   Worker:   ${WORKER_URL}"
echo "   Frontend: ${FRONTEND_URL}"
echo "   GitHub:   https://github.com/thejonanshow/omnibot"
echo ""
echo "🎯 Next Steps:"
echo "   1. Open frontend URL on mobile device: ${FRONTEND_URL}"
echo "   2. Click Settings ⚙️"
echo "   3. Enter:"
echo "      - Router URL: ${WORKER_URL}"
echo "      - Shared Secret: (copy from deployment-urls.txt)"
echo "   4. Click 🎤 Voice to test"
echo ""
echo "📱 Mobile Testing Checklist:"
echo "   □ Grant microphone permissions"
echo "   □ Test voice input"
echo "   □ Try different themes (14 available!)"
echo "   □ Test in portrait and landscape"
echo "   □ Verify message bubbles display correctly"
echo "   □ Test scroll-to-bottom button"
echo ""
echo "🔧 Troubleshooting:"
echo "   - If voice doesn't work: Check HTTPS and mic permissions"
echo "   - If can't connect: Verify URLs in Settings match above"
echo "   - If themes look wrong: Try different browser (Chrome works best)"
echo ""
echo "📚 Documentation: /Users/jonan/src/claudebox/omnibot/design/"
echo ""

exit 0
