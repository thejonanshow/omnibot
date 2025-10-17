# Qwen Deployment Guide

## 🚀 Quick Start

### Step 1: Deploy Qwen to Runloop

```bash
# Option 1: Run with API key as argument
python3 scripts/deploy_qwen_simple.py <YOUR_RUNLOOP_API_KEY>

# Option 2: Set environment variable
export RUNLOOP_API_KEY=<YOUR_RUNLOOP_API_KEY>
python3 scripts/deploy_qwen_simple.py
```

### Step 2: Update Cloudflare Workers

```bash
# The script will automatically read the deployment info
python3 scripts/update_qwen_url.py

# Or specify the URL manually
python3 scripts/update_qwen_url.py https://your-devbox-id.runloop.dev:8000
```

### Step 3: Test the Deployment

```bash
# Test the Qwen endpoint
curl https://your-devbox-id.runloop.dev:8000/health

# Test coding request routing
python3 scripts/test_qwen_routing.py
```

## 📋 Detailed Steps

### Prerequisites

1. **Runloop API Key**: Get your API key from [Runloop Dashboard](https://runloop.ai)
2. **Cloudflare Access**: Ensure you have access to the production environment
3. **Python Dependencies**: `requests` library (usually pre-installed)

### Deployment Process

1. **Find Suitable Blueprint**: The script automatically finds the best available blueprint
2. **Create Devbox**: Creates a new devbox with the name `omni-agent-qwen-ollama`
3. **Wait for Ready**: Monitors the devbox until it's running (up to 5 minutes)
4. **Save Info**: Creates `qwen_deployment.json` with deployment details

### Configuration Update

1. **Update Secret**: Sets `QWEN_RUNLOOP_URL` in Cloudflare Workers secrets
2. **Deploy Worker**: The worker will automatically use the new URL
3. **Verify**: Test that coding requests route to Qwen

## 🔧 Troubleshooting

### Common Issues

1. **API Key Invalid**: Verify your Runloop API key is correct
2. **No Blueprints**: Ensure you have access to blueprints in your Runloop account
3. **Devbox Timeout**: The devbox may take longer than 5 minutes to start
4. **Secret Update Failed**: Ensure you have Cloudflare Workers access

### Manual Steps

If the automated scripts fail:

1. **Deploy Manually**:
   - Go to [Runloop Dashboard](https://runloop.ai)
   - Create a new devbox with a suitable blueprint
   - Note the devbox ID and URL

2. **Update Secret Manually**:
   ```bash
   cd cloudflare-worker
   wrangler secret put QWEN_RUNLOOP_URL --env production
   # Enter the devbox URL when prompted
   ```

3. **Test Manually**:
   ```bash
   # Test the endpoint
   curl https://your-devbox-id.runloop.dev:8000/health

   # Test routing (replace with your actual secret)
   python3 -c "
   import requests
   # ... (use the test script from earlier)
   "
   ```

## 📊 Monitoring

### Check Deployment Status

```bash
# View deployment info
cat qwen_deployment.json

# Check Cloudflare Workers logs
cd cloudflare-worker
wrangler tail --env production
```

### Verify Routing

The logs should show:
- `"isCodeRequest=true"` for coding requests
- `"Using Qwen instance: https://your-devbox-id.runloop.dev:8000 (remote)"`
- Successful Qwen responses

## 🎯 Success Criteria

✅ **Deployment Complete** when:
- Devbox is running and accessible
- `qwen_deployment.json` is created
- `QWEN_RUNLOOP_URL` secret is updated
- Coding requests route to Qwen successfully

## 📞 Support

If you encounter issues:
1. Check the deployment logs
2. Verify your Runloop API key and permissions
3. Ensure Cloudflare Workers access
4. Test the Qwen endpoint manually
