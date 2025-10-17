# 📊 Observability & Testing Implementation

## Current Issue
- 404 errors on page reload not properly diagnosed
- No way to tail logs in real-time
- Can't verify deployments work before declaring success

## Immediate Requirements

### 1. Log Streaming (✅ Added to package.json)

```bash
# Worker logs
npm run log:worker          # Staging worker (default)
npm run log:worker:staging  # Staging worker
npm run log:worker:prod     # Production worker

# Pages logs  
npm run log:pages           # Staging pages (default)
npm run log:pages:staging   # Staging pages
npm run log:pages:prod      # Production pages

# Devbox logs (TODO)
npm run log:devbox:alpha    # First devbox instance
npm run log:devbox:beta     # Second devbox instance
npm run log:devbox:omega    # Third devbox instance

# All logs (TODO)
npm run log:all            # Multiplex all logs together
```

### 2. Status Dashboard Enhancement

Add to `/status` endpoint response:
```json
{
  "llm_providers": {
    "groq": { "usage": 5, "limit": 30 },
    "gemini": { "usage": 2, "limit": 15 },
    "claude": { "usage": 1, "limit": 50 },
    "qwen": { "usage": 0, "limit": 1000 }
  },
  "runloop": {
    "credit_balance": 18.50,
    "credit_limit": 25.00,
    "credit_used": 6.50,
    "credit_remaining_pct": 74.0,
    "active_devboxes": 1,
    "suspended_devboxes": 0
  },
  "health": {
    "worker": "healthy",
    "kv_namespaces": "healthy",
    "last_check": "2025-10-16T22:30:00Z"
  }
}
```

### 3. Automated Testing Before Declaring Success

**Test Script:** `test-deployment.sh`
```bash
#!/bin/bash
# Test staging deployment

URL="https://omnibot-ui-staging.pages.dev"

echo "Testing $URL..."

# 1. Check page loads
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $URL)
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Failed: HTTP $HTTP_CODE"
  exit 1
fi

# 2. Check reload works (SPA routing)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $URL/settings)
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Failed: Reload test HTTP $HTTP_CODE"
  exit 1
fi

# 3. Check JavaScript loads
if ! curl -s $URL | grep -q "setupEventListeners"; then
  echo "❌ Failed: JavaScript not loading"
  exit 1
fi

# 4. Check API is reachable
API_URL=$(echo $URL | sed 's/omnibot-ui-staging/omnibot-router-staging/')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)
if [ "$HTTP_CODE" != "200" ]; then
  echo "⚠️  Warning: API returned HTTP $HTTP_CODE"
fi

echo "✅ All tests passed"
```

### 4. Browser Testing Plugin

**Headless Chrome Testing:**
```bash
# Add to package.json
"test:e2e": "node test-e2e.js"
```

**test-e2e.js:**
```javascript
import puppeteer from 'puppeteer';

async function testDeployment() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Test initial load
  await page.goto('https://omnibot-ui-staging.pages.dev');
  const title = await page.title();
  console.assert(title === 'Omnibot - AI Assistant', 'Title mismatch');
  
  // Test reload/navigation
  await page.reload();
  await page.waitForSelector('#message-input');
  
  // Test settings modal
  await page.click('#settings-btn');
  await page.waitForSelector('.settings-panel.active');
  
  // Check for console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await browser.close();
  
  if (errors.length > 0) {
    console.error('Console errors:', errors);
    process.exit(1);
  }
  
  console.log('✅ E2E tests passed');
}

testDeployment().catch(console.error);
```

## Implementation Priority

1. ✅ **Log commands** - Added to package.json
2. **Runloop credit tracking** - Add to status endpoint (30 min)
3. **Test script** - Create test-deployment.sh (30 min)
4. **E2E testing** - Add puppeteer tests (1 hour)
5. **Devbox log streaming** - Research Runloop API (TBD)
6. **Multi-tail all logs** - Combine all log streams (TBD)

## Runloop Credit Monitoring

**API Endpoint:** `https://api.runloop.ai/v1/account`

**Response:**
```json
{
  "id": "...",
  "email": "...",
  "credit_balance": 18.50,
  "credit_limit": 25.00
}
```

**Add to status endpoint:**
```javascript
async function handleStatus(env) {
  const providers = ['groq', 'gemini', 'qwen', 'claude'];
  const status = {};

  for (const provider of providers) {
    status[provider] = await getUsage(env, provider);
  }
  
  // Add Runloop credit info
  if (env.RUNLOOP_API_KEY) {
    try {
      const response = await fetch('https://api.runloop.ai/v1/account', {
        headers: { 'Authorization': `Bearer ${env.RUNLOOP_API_KEY}` }
      });
      const account = await response.json();
      status.runloop = {
        credit_balance: account.credit_balance,
        credit_limit: account.credit_limit,
        credit_used: account.credit_limit - account.credit_balance,
        credit_remaining_pct: (account.credit_balance / account.credit_limit * 100).toFixed(1)
      };
    } catch (error) {
      console.error('Failed to fetch Runloop status:', error);
    }
  }

  return new Response(JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Success Criteria

Before declaring any deployment successful:
1. ✅ HTTP 200 on main URL
2. ✅ HTTP 200 on sub-routes (SPA routing works)
3. ✅ JavaScript loads without errors
4. ✅ No console errors
5. ✅ API health check passes
6. ✅ Logs are accessible

**Never say "test it" without having tested it myself first.**
