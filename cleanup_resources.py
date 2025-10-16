#!/usr/bin/env python3
"""
Cleanup unused Runloop resources to avoid unnecessary costs
"""

import os
import sys
import requests
import time
from typing import List, Dict, Any

# Load environment variables from .env file
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

API_KEY = os.getenv('RUNLOOP_API_KEY')
BASE_URL = 'https://api.runloop.ai/v1'

def log_progress(message: str, step: int = None, total: int = None):
    """Log progress with timestamps and step indicators"""
    timestamp = time.strftime("%H:%M:%S")
    if step and total:
        print(f"[{timestamp}] [{step}/{total}] {message}")
    else:
        print(f"[{timestamp}] {message}")

def list_devboxes() -> List[Dict[str, Any]]:
    """List all devboxes"""
    log_progress("Fetching devboxes...")
    try:
        response = requests.get(
            f'{BASE_URL}/devboxes',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        
        if response.status_code == 200:
            data = response.json()
            # Handle different response formats
            if isinstance(data, dict) and 'devboxes' in data:
                devboxes = data['devboxes']
            elif isinstance(data, list):
                devboxes = data
            else:
                devboxes = []
            log_progress(f"Found {len(devboxes)} devboxes")
            return devboxes
        else:
            log_progress(f"Failed to fetch devboxes: {response.status_code}")
            return []
    except Exception as e:
        log_progress(f"Error fetching devboxes: {e}")
        return []

def list_blueprints() -> List[Dict[str, Any]]:
    """List all blueprints"""
    log_progress("Fetching blueprints...")
    try:
        response = requests.get(
            f'{BASE_URL}/blueprints',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        
        if response.status_code == 200:
            data = response.json()
            # Handle different response formats
            if isinstance(data, dict) and 'blueprints' in data:
                blueprints = data['blueprints']
            elif isinstance(data, list):
                blueprints = data
            else:
                blueprints = []
            log_progress(f"Found {len(blueprints)} blueprints")
            return blueprints
        else:
            log_progress(f"Failed to fetch blueprints: {response.status_code}")
            return []
    except Exception as e:
        log_progress(f"Error fetching blueprints: {e}")
        return []

def suspend_devbox(devbox_id: str) -> bool:
    """Suspend a devbox to save costs"""
    log_progress(f"Suspending devbox {devbox_id}...")
    try:
        response = requests.post(
            f'{BASE_URL}/devboxes/{devbox_id}/suspend',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        
        if response.status_code in [200, 201]:
            log_progress(f"✓ Suspended devbox {devbox_id}")
            return True
        else:
            log_progress(f"✗ Failed to suspend devbox {devbox_id}: {response.status_code}")
            return False
    except Exception as e:
        log_progress(f"✗ Error suspending devbox {devbox_id}: {e}")
        return False

def delete_devbox(devbox_id: str) -> bool:
    """Delete a devbox"""
    log_progress(f"Deleting devbox {devbox_id}...")
    try:
        response = requests.delete(
            f'{BASE_URL}/devboxes/{devbox_id}',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        
        if response.status_code in [200, 204]:
            log_progress(f"✓ Deleted devbox {devbox_id}")
            return True
        else:
            log_progress(f"✗ Failed to delete devbox {devbox_id}: {response.status_code}")
            return False
    except Exception as e:
        log_progress(f"✗ Error deleting devbox {devbox_id}: {e}")
        return False

def cleanup_devboxes():
    """Clean up unused devboxes"""
    log_progress("🧹 CLEANING UP DEVOXES")
    log_progress("=" * 50)
    
    devboxes = list_devboxes()
    if not devboxes:
        log_progress("No devboxes found")
        return
    
    # Get current devbox from .runloop_url if it exists
    current_devbox_id = None
    if os.path.exists('.runloop_url'):
        with open('.runloop_url', 'r') as f:
            url = f.read().strip()
            if 'dbx_' in url:
                current_devbox_id = url.split('dbx_')[1].split('.')[0]
                current_devbox_id = f"dbx_{current_devbox_id}"
    
    log_progress(f"Current active devbox: {current_devbox_id or 'None'}")
    
    suspended_count = 0
    deleted_count = 0
    
    for i, devbox in enumerate(devboxes, 1):
        # Handle both dict and string responses
        if isinstance(devbox, dict):
            devbox_id = devbox.get('id', '')
            name = devbox.get('name', 'unnamed')
            status = devbox.get('status', 'unknown')
        else:
            # If it's a string, it might be just the ID
            devbox_id = str(devbox)
            name = 'unnamed'
            status = 'unknown'
        
        log_progress(f"Processing devbox {i}/{len(devboxes)}: {devbox_id} ({name}) - Status: {status}")
        
        # Skip current active devbox
        if devbox_id == current_devbox_id:
            log_progress(f"  → Keeping current active devbox")
            continue
        
        # If running, suspend it first
        if status == 'running':
            if suspend_devbox(devbox_id):
                suspended_count += 1
                time.sleep(2)  # Wait for suspension
        
        # For old devboxes (older than 1 day), delete them
        # For recent ones, just suspend
        try:
            created_at = devbox.get('created_at', '')
            if created_at:
                # Simple check: if it's not today, it's old
                if '2025-10-12' not in created_at:  # Today's date
                    log_progress(f"  → Deleting old devbox")
                    if delete_devbox(devbox_id):
                        deleted_count += 1
                else:
                    log_progress(f"  → Keeping recent devbox (suspended)")
            else:
                log_progress(f"  → Keeping devbox (no creation date)")
        except Exception as e:
            log_progress(f"  → Error processing devbox: {e}")
    
    log_progress(f"✓ Cleanup complete: {suspended_count} suspended, {deleted_count} deleted")

def cleanup_blueprints():
    """Clean up unused blueprints"""
    log_progress("🧹 CLEANING UP BLUEPRINTS")
    log_progress("=" * 50)
    
    blueprints = list_blueprints()
    if not blueprints:
        log_progress("No blueprints found")
        return
    
    # Get current blueprint from .env
    current_blueprint_id = os.getenv('OMNI_AGENT_BLUEPRINT_ID', '')
    log_progress(f"Current active blueprint: {current_blueprint_id or 'None'}")
    
    kept_count = 0
    
    for i, blueprint in enumerate(blueprints, 1):
        # Handle both dict and string responses
        if isinstance(blueprint, dict):
            blueprint_id = blueprint.get('id', '')
            name = blueprint.get('name', 'unnamed')
            status = blueprint.get('status', 'unknown')
        else:
            # If it's a string, it might be just the ID
            blueprint_id = str(blueprint)
            name = 'unnamed'
            status = 'unknown'
        
        log_progress(f"Processing blueprint {i}/{len(blueprints)}: {blueprint_id} ({name}) - Status: {status}")
        
        # Keep current blueprint and any that are build_complete
        if blueprint_id == current_blueprint_id or status == 'build_complete':
            log_progress(f"  → Keeping blueprint (active or ready)")
            kept_count += 1
        else:
            log_progress(f"  → Keeping blueprint (status: {status})")
            kept_count += 1
    
    log_progress(f"✓ Blueprint cleanup complete: {kept_count} kept")

def main():
    """Main cleanup function"""
    if not API_KEY:
        log_progress("❌ RUNLOOP_API_KEY not set")
        sys.exit(1)
    
    log_progress("🚀 STARTING RESOURCE CLEANUP")
    log_progress("=" * 50)
    log_progress("This will clean up unused Runloop resources to save costs")
    log_progress("")
    
    # Clean up devboxes
    cleanup_devboxes()
    log_progress("")
    
    # Clean up blueprints
    cleanup_blueprints()
    log_progress("")
    
    log_progress("✅ CLEANUP COMPLETE")
    log_progress("=" * 50)
    log_progress("Resources have been cleaned up to minimize costs")
    log_progress("Active devboxes and ready blueprints have been preserved")

if __name__ == "__main__":
    main()
