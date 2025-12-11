# Deprecated Files and Scripts

This document lists files that are deprecated or have been superseded by newer implementations.

## Deployment Scripts

### ❌ `deploy.sh` - DEPRECATED
**Status**: Superseded by GitHub Actions workflows  
**Reason**: This script deployed both worker and frontend to separate Cloudflare services (Workers + Pages). The new architecture uses a consolidated worker with embedded HTML.

**Use instead**: 
- For staging: Create PR to `main` (triggers automatic deployment)
- For production: Use GitHub Actions "Promote Staging to Production" workflow

### ❌ `setup.sh` - MAY BE DEPRECATED
**Status**: Review needed  
**Reason**: May contain outdated setup steps for Pages deployment

### ❌ `start.sh` - MAY BE DEPRECATED  
**Status**: Review needed
**Reason**: May have been used to serve frontend separately

## Experimental Scripts

### `scripts/experimental/` directory
Contains experimental deployment scripts for various Qwen integrations:
- `deploy_qwen.py`
- `deploy_qwen_blueprint.py`
- `deploy_qwen_ollama.py`
- `deploy_qwen_simple.py`
- `deploy_qwen_swarm.py`
- `deploy_qwen_with_progress.py`

**Status**: Experimental/testing only  
**Purpose**: Various approaches to deploying Qwen LLM models  
**Use**: Not for production deployment

## Frontend Directory

### `frontend/_redirects` and `frontend/_routes.json`
**Status**: May be deprecated  
**Reason**: These were Cloudflare Pages configuration files. Since we no longer deploy to Pages separately, they may not be needed.

**Current use**: The `frontend/` directory is still the **source** for the UI HTML, but the `_redirects` and `_routes.json` files are likely not used.

## Migration Notes

If you're updating from the old architecture:

### Old Workflow
1. Edit `frontend/index.html` or `cloudflare-worker/src/index.js`
2. Run `./deploy.sh staging` or `./deploy.sh production`
3. Worker and frontend deployed separately to Workers and Pages

### New Workflow
1. Edit `frontend/index.html` (for UI) or `cloudflare-worker/src/index.js` (for logic)
2. Run `npm run build` to create consolidated worker
3. Commit and push to GitHub
4. Create PR to `main` → triggers staging deployment
5. After verification, manually promote to production via GitHub Actions

## Cleanup Recommendations

The following files could potentially be removed after verification:
- [ ] `deploy.sh` - Confirm no scripts depend on it
- [ ] `frontend/_redirects` - Not needed without Pages deployment
- [ ] `frontend/_routes.json` - Not needed without Pages deployment
- [ ] Review `setup.sh` and `start.sh` for relevance

**Before removing**: Verify they're not referenced in any active workflows or documentation.
