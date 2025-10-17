#!/usr/bin/env python3
"""
Deploy Qwen from existing blueprint - test-driven approach
"""
import os
import sys
import requests
import time

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
    print("❌ Missing RUNLOOP_API_KEY or OMNI_AGENT_BLUEPRINT_ID in .env")
    sys.exit(1)

print(f"🚀 Deploying from blueprint: {BLUEPRINT_ID}")
print("=" * 60)

# Create devbox from blueprint
print("\n1. Creating devbox from blueprint...")
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
    print(f"❌ Failed: {response.status_code} - {response.text}")
    sys.exit(1)

data = response.json()
devbox_id = data.get('id')
print(f"✓ Devbox created: {devbox_id}")

# Wait for devbox to be ready
print("\n2. Waiting for devbox to start...")
for i in range(30):
    response = requests.get(
        f'{BASE_URL}/devboxes/{devbox_id}',
        headers={'Authorization': f'Bearer {API_KEY}'}
    )
    if response.ok:
        status = response.json().get('status')
        print(f"   Status: {status}")
        if status == 'running':
            break
    time.sleep(2)
else:
    print("⚠️  Devbox didn't start in time")
    sys.exit(1)

devbox_url = f"https://{devbox_id}.runloop.dev:8000"
print(f"\n✓ Devbox running at: {devbox_url}")

# Test the Qwen endpoint
print("\n3. Testing Qwen endpoint...")
time.sleep(5)  # Give services time to start

test_url = f"{devbox_url}/qwen/chat"
test_payload = {
    "message": "Write a Python function to add two numbers",
    "conversation": [],
    "sessionId": "test"
}

try:
    response = requests.post(
        test_url,
        json=test_payload,
        timeout=30
    )
    if response.ok:
        result = response.json()
        print(f"✓ Qwen responded!")
        print(f"Response preview: {str(result.get('response', ''))[:100]}...")
    else:
        print(f"⚠️  Qwen endpoint returned: {response.status_code}")
        print(f"Response: {response.text[:200]}")
except Exception as e:
    print(f"⚠️  Couldn't reach Qwen: {e}")

# Save URL for later use
with open('.runloop_url', 'w') as f:
    f.write(devbox_url)
print(f"\n✓ URL saved to .runloop_url")

print("\n" + "=" * 60)
print("🎉 Deployment complete!")
print(f"Use this URL in your .env: QWEN_RUNLOOP_URL={devbox_url}")
