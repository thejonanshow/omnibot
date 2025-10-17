#!/usr/bin/env python3
"""
Debug existing devbox - see what's actually running
"""
import os
import sys
import requests

# Load .env
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                try:
                    key, value = line.strip().split('=', 1)
                    if value:
                        os.environ[key] = value
                except:
                    pass

API_KEY = os.getenv('RUNLOOP_API_KEY')
DEVBOX_URL = os.getenv('RUNLOOP_URL', '')
BASE_URL = 'https://api.runloop.ai/v1'

if not DEVBOX_URL:
    print("No RUNLOOP_URL set")
    sys.exit(1)

devbox_id = DEVBOX_URL.split('//')[1].split('.')[0]

print(f"🔍 Debugging devbox: {devbox_id}")
print("=" * 60)

# Check what processes are running
print("\n1. Checking running processes...")
response = requests.post(
    f'{BASE_URL}/devboxes/{devbox_id}/execute_sync',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={'command': 'ps aux | grep -E "(ollama|python|qwen)" | grep -v grep'},
    timeout=30
)

if response.ok:
    result = response.json()
    print(f"Output: {result.get('stdout', 'No output')}")
else:
    print(f"Error: {response.status_code}")

# Check if ollama is installed
print("\n2. Checking if Ollama is installed...")
response = requests.post(
    f'{BASE_URL}/devboxes/{devbox_id}/execute_sync',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={'command': 'which ollama'},
    timeout=30
)

if response.ok:
    result = response.json()
    if result.get('exit_status') == 0:
        print(f"✓ Ollama installed at: {result.get('stdout', '').strip()}")
    else:
        print("✗ Ollama not found")
else:
    print(f"Error: {response.status_code}")

# Check what's listening on port 8000
print("\n3. Checking port 8000...")
response = requests.post(
    f'{BASE_URL}/devboxes/{devbox_id}/execute_sync',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={'command': 'netstat -tlnp 2>/dev/null | grep 8000 || lsof -i :8000 || echo "Nothing on port 8000"'},
    timeout=30
)

if response.ok:
    result = response.json()
    print(f"Output: {result.get('stdout', 'No output')}")
else:
    print(f"Error: {response.status_code}")

# Check filesystem
print("\n4. Checking filesystem...")
response = requests.post(
    f'{BASE_URL}/devboxes/{devbox_id}/execute_sync',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={'command': 'ls -la /workspace && echo "---" && ls -la /tmp'},
    timeout=30
)

if response.ok:
    result = response.json()
    print(f"Output:\n{result.get('stdout', 'No output')[:500]}")
else:
    print(f"Error: {response.status_code}")
