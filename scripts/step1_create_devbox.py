#!/usr/bin/env python3
"""
Step 1: Create devbox from blueprint
"""
import os
import sys
import requests
import json

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
BLUEPRINT_ID = os.getenv('OMNI_AGENT_BLUEPRINT_ID')
BASE_URL = 'https://api.runloop.ai/v1'

if not API_KEY or not BLUEPRINT_ID:
    print("❌ Missing credentials in .env")
    sys.exit(1)

print(f"🚀 Creating devbox from blueprint: {BLUEPRINT_ID}")

response = requests.post(
    f'{BASE_URL}/devboxes',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={
        'name': 'qwen-test',
        'blueprint_id': BLUEPRINT_ID
    }
)

if not response.ok:
    print(f"❌ Failed: {response.status_code}")
    print(response.text)
    sys.exit(1)

data = response.json()
devbox_id = data.get('id')
devbox_url = f"https://{devbox_id}.runloop.dev:8000"

print(f"✅ Devbox created: {devbox_id}")
print(f"📍 URL: {devbox_url}")
print(f"\nSaving to .runloop_url and .env...")

# Save URL
with open('.runloop_url', 'w') as f:
    f.write(devbox_url)

# Update .env
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        lines = f.readlines()
    
    found = False
    for i, line in enumerate(lines):
        if line.startswith('RUNLOOP_URL='):
            lines[i] = f'RUNLOOP_URL={devbox_url}\n'
            found = True
            break
    
    if not found:
        lines.append(f'RUNLOOP_URL={devbox_url}\n')
    
    with open('.env', 'w') as f:
        f.writelines(lines)

print(f"✅ Saved!")
print(f"\nNext: Run step2_check_devbox.py to check status")
