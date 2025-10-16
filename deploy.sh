#!/bin/bash
set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 OMNIBOT DEPLOYMENT${NC}"
echo "========================"
echo ""

# Determine environment
ENV=${1:-staging}

if [ "$ENV" = "production" ]; then
    echo -e "${RED}⚠️  WARNING: PRODUCTION DEPLOYMENT${NC}"
    echo ""
    echo "You are about to deploy to PRODUCTION."
    echo "This should only be done after successful staging tests."
    echo ""
    read -p "Are you absolutely sure? Type 'DEPLOY TO PRODUCTION' to confirm: " confirm
    
    if [ "$confirm" != "DEPLOY TO PRODUCTION" ]; then
        echo -e "${YELLOW}Production deployment cancelled.${NC}"
        exit 0
    fi
    
    WORKER_ENV="production"
    PAGES_PROJECT="omnibot-ui"
    echo -e "${GREEN}✓ Production deployment confirmed${NC}"
else
    WORKER_ENV="staging"
    PAGES_PROJECT="omnibot-ui-staging"
    echo -e "${GREEN}📦 Deploying to STAGING environment${NC}"
fi

echo ""
echo "Environment: $WORKER_ENV"
echo "Worker: omnibot-router-$WORKER_ENV"
echo "Pages: $PAGES_PROJECT"
echo ""

# Run tests first
echo -e "${BLUE}🧪 Running tests...${NC}"
npm test
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed! Deployment aborted.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ All tests passed${NC}"
echo ""

# Deploy Cloudflare Worker
echo -e "${BLUE}📦 Deploying Cloudflare Worker to $WORKER_ENV...${NC}"
cd cloudflare-worker

DEPLOY_OUTPUT=$(npx wrangler deploy --env $WORKER_ENV 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract worker URL
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^ ]+\.workers\.dev' | head -1)

if [ -z "$WORKER_URL" ]; then
    echo -e "${RED}❌ Could not extract worker URL from deploy output${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Worker deployed: $WORKER_URL${NC}"
cd ..

# Deploy Frontend
echo ""
echo -e "${BLUE}🎨 Deploying Frontend to $PAGES_PROJECT...${NC}"
cd frontend

# Check if project exists
if ! npx wrangler pages project list 2>&1 | grep -q "$PAGES_PROJECT"; then
    echo "Creating Pages project..."
    npx wrangler pages project create $PAGES_PROJECT --production-branch main
fi

# Deploy to Pages
FRONTEND_DEPLOY=$(npx wrangler pages deploy . --project-name $PAGES_PROJECT --commit-dirty=true 2>&1)
echo "$FRONTEND_DEPLOY"

# Extract frontend URL
FRONTEND_URL=$(echo "$FRONTEND_DEPLOY" | grep -oE 'https://[^ ]+\.pages\.dev' | head -1)

if [ -z "$FRONTEND_URL" ]; then
    FRONTEND_URL="https://$PAGES_PROJECT.pages.dev"
fi

echo -e "${GREEN}✓ Frontend deployed: $FRONTEND_URL${NC}"
cd ..

# Save deployment info
DEPLOYMENT_FILE="deployment-${ENV}.txt"
cat > $DEPLOYMENT_FILE << EOF
ENVIRONMENT=$ENV
WORKER_URL=$WORKER_URL
FRONTEND_URL=$FRONTEND_URL
DEPLOYED_AT=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
EOF

echo ""
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo "======================="
echo ""
echo -e "${BLUE}🎯 Worker API:${NC} $WORKER_URL"
echo -e "${BLUE}🌐 Frontend UI:${NC} $FRONTEND_URL"
echo ""
echo -e "${YELLOW}📝 Configuration for Settings:${NC}"
echo "   Router URL: $WORKER_URL"
echo "   Shared Secret: (use the secret from .env)"
echo ""
echo -e "${GREEN}💾 Deployment info saved to: $DEPLOYMENT_FILE${NC}"

if [ "$ENV" = "staging" ]; then
    echo ""
    echo -e "${YELLOW}🔄 To promote to production after testing:${NC}"
    echo "   ./deploy.sh production"
fi

echo ""
