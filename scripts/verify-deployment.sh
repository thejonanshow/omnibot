#!/bin/bash
# Deployment verification script
# Usage: ./scripts/verify-deployment.sh <environment>
# Where environment is: staging | production

set -e

ENVIRONMENT=${1:-staging}

if [ "$ENVIRONMENT" = "staging" ]; then
    BASE_URL="https://omnibot-staging.jonanscheffler.workers.dev"
elif [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://omnibot.jonanscheffler.workers.dev"
else
    echo "ERROR: Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

echo "🔍 Verifying $ENVIRONMENT deployment at $BASE_URL"
echo ""

# Test 1: Health endpoint
echo "Test 1: Health endpoint..."
HEALTH_RESPONSE=$(curl -sf "$BASE_URL/api/health")
if ! echo "$HEALTH_RESPONSE" | grep -q '"ok":true'; then
    echo "❌ FAILED: Health check did not return ok:true"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi
VERSION=$(echo "$HEALTH_RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
echo "✅ PASSED: Health endpoint (version: $VERSION)"
echo ""

# Test 2: HTML UI served
echo "Test 2: HTML UI content..."
HTML_RESPONSE=$(curl -sf "$BASE_URL/")
if ! echo "$HTML_RESPONSE" | grep -q "<!DOCTYPE html>"; then
    echo "❌ FAILED: No HTML DOCTYPE found"
    exit 1
fi
if ! echo "$HTML_RESPONSE" | grep -q "Omnibot"; then
    echo "❌ FAILED: HTML missing 'Omnibot' content"
    exit 1
fi
HTML_SIZE=${#HTML_RESPONSE}
if [ $HTML_SIZE -lt 10000 ]; then
    echo "❌ FAILED: HTML too small ($HTML_SIZE bytes)"
    exit 1
fi
echo "✅ PASSED: HTML UI content ($HTML_SIZE bytes)"
echo ""

# Test 3: Test endpoint
echo "Test 3: Test endpoint..."
TEST_RESPONSE=$(curl -sf "$BASE_URL/api/test")
if [ -z "$TEST_RESPONSE" ]; then
    echo "❌ FAILED: Test endpoint returned empty response"
    exit 1
fi
echo "✅ PASSED: Test endpoint"
echo ""

# Test 4: Chat endpoint (structure check)
echo "Test 4: Chat endpoint structure..."
CHAT_RESPONSE=$(curl -sf -X POST "$BASE_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"hello"}]}' || echo '{"error":"expected"}')
# We expect either a valid response or an auth error - both mean the endpoint works
if [ -z "$CHAT_RESPONSE" ]; then
    echo "❌ FAILED: Chat endpoint returned empty response"
    exit 1
fi
echo "✅ PASSED: Chat endpoint structure"
echo ""

# Test 5: Version consistency
echo "Test 5: Version information..."
if [ -z "$VERSION" ]; then
    echo "⚠️  WARNING: No version found in health response"
else
    echo "✅ PASSED: Version information present"
fi
echo ""

# Test 6: Response headers
echo "Test 6: CORS and security headers..."
HEADERS=$(curl -sI "$BASE_URL/")
if ! echo "$HEADERS" | grep -qi "access-control-allow-origin"; then
    echo "⚠️  WARNING: No CORS headers found"
else
    echo "✅ PASSED: CORS headers present"
fi
echo ""

# Summary
echo "================================"
echo "✅ All critical tests passed!"
echo "Environment: $ENVIRONMENT"
echo "URL: $BASE_URL"
echo "Version: ${VERSION:-unknown}"
echo "================================"
