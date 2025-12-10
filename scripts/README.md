# Scripts Directory

This directory contains deployment, setup, and utility scripts for Omnibot.

## Main Scripts

### Deployment & Setup
- **`deploy.js`** - Main deployment script for Cloudflare Workers and Pages
- **`deploy_worker.js`** - Deploy Cloudflare Worker specifically
- **`deploy_swarm.js`** - Deploy swarm orchestration system
- **`deploy_runloop.py`** - Deploy Qwen model on Runloop devboxes (used by setup.sh)
- **`setup.js`** - Setup and configuration script
- **`start.js`** - Start development server

### Release Management
- **`promote.js`** - Promote staging to production
- **`rollback.js`** - Rollback to previous deployment
- **`cleanup.js`** - Clean up old deployments and resources

### Repository Management
- **`create_github_repo.js`** - Create GitHub repository
- **`create_kv_namespaces.js`** - Create Cloudflare KV namespaces
- **`setup_github.sh`** - GitHub setup automation

### Testing & Validation
- **`test.js`** - Run test suite
- **`test_system.js`** - System integration tests
- **`test_health.js`** - Health check tests
- **`test_code_routing.js`** - Test code routing logic
- **`test_mobile_connectivity.js`** - Mobile connectivity tests
- **`check-coverage.js`** - Check test coverage
- **`check_gemini_models.js`** - Validate Gemini model access

### Monitoring & Utilities
- **`health_check.py`** - Health check utilities
- **`monitor_qwen.py`** - Monitor Qwen model service
- **`update_qwen_url.py`** - Update Qwen service URL
- **`check_deployment_status.py`** - Check deployment status

### Qwen Model Deployment (Development)
- **`qwen_proxy_server.py`** - Proxy server for Qwen API
- **`qwen_mcp_server.py`** - MCP server for Qwen
- **`qwen_ollama_server.py`** - Ollama server for Qwen
- **`simple_qwen_server.py`** - Simple Qwen server implementation
- **`enhanced_server.py`** - Enhanced Qwen server with features
- **`qwen_blueprint_optimizer.py`** - Optimize Qwen blueprints
- **`swarm_orchestrator.py`** - Orchestrate swarm operations
- **`test_swarm.py`** - Swarm testing utilities

### Runloop Devbox Management
- **`step1_create_devbox.py`** - Step 1: Create devbox
- **`step2_check_devbox.py`** - Step 2: Check devbox status
- **`get_devbox_details.py`** - Get devbox information
- **`get_blueprint_details.py`** - Get blueprint information
- **`get_runloop_key.py`** - Retrieve Runloop API key
- **`list_runloop_resources.py`** - List Runloop resources
- **`debug_devbox.py`** - Debug devbox issues
- **`manual_qwen_setup.py`** - Manual Qwen setup process
- **`setup_qwen_devbox.sh`** - Automate Qwen devbox setup
- **`start_qwen.sh`** - Start Qwen service
- **`runloop_start_qwen.sh`** - Start Qwen on Runloop

## Experimental Scripts

The `experimental/` directory contains experimental deployment approaches for Qwen integration:
- Various Qwen deployment strategies (blueprint, ollama, simple, swarm, with progress)
- These are kept for reference but not actively used in production

## Usage

Most scripts can be run directly:
```bash
node scripts/deploy.js
python3 scripts/deploy_runloop.py
```

For shell scripts:
```bash
bash scripts/setup_github.sh
```

See individual script headers for specific usage instructions and requirements.
