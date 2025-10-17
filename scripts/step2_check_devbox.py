#!/usr/bin/env python3
"""
Step 2: Check devbox status and test endpoint
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
DEVBOX_URL = os.getenv('RUNLOOP_URL')
BASE_URL = 'https://api.runloop.ai/v1'

if not API_KEY or not DEVBOX_URL:
    print("❌ Missing RUNLOOP_API_KEY or RUNLOOP_URL in .env")
    sys.exit(1)

# Extract devbox ID from URL
devbox_id = DEVBOX_URL.split('//')[1].split('.')[0]

print(f"🔍 Checking devbox: {devbox_id}")
print("=" * 60)

# Check status
for i in range(20):
    response = requests.get(
        f'{BASE_URL}/devboxes/{devbox_id}',
        headers={'Authorization': f'Bearer {API_KEY}'}
    )
    
    if response.ok:
        data = response.json()
        status = data.get('status')
        print(f"Status: {status}")
        
        if status == 'running':
            print("\n✅ Devbox is running!")
            break
        elif status == 'failure':
            print("\n❌ Devbox failed to start")
            sys.exit(1)
    
    if i < 19:
        time.sleep(3)
else:
    print("\n⚠️ Devbox didn't reach 'running' state")
    sys.exit(1)

# Test health endpoint
print(f"\n🏥 Testing health endpoint...")
time.sleep(5)  # Give services time to start

try:
    response = requests.get(f"{DEVBOX_URL}/health", timeout=10)
    if response.ok:
        print(f"✅ Health check passed!")
        print(f"Response: {response.json()}")
    else:
        print(f"⚠️ Health check returned: {response.status_code}")
except Exception as e:
    print(f"⚠️ Health check failed: {e}")

# Test Qwen endpoint
print(f"\n🤖 Testing Qwen endpoint...")

try:
    response = requests.post(
        f"{DEVBOX_URL}/qwen/chat",
        json={
            "message": "Write a Python function to add two numbers. Just the code.",
            "conversation": [],
            "sessionId": "test"
        },
        timeout=30
    )
    
    if response.ok:
        result = response.json()
        print(f"✅ Qwen is working!")
        print(f"Response: {str(result.get('response', ''))[:150]}...")
    else:
        print(f"⚠️ Qwen returned: {response.status_code}")
        print(f"Response: {response.text[:200]}")
except Exception as e:
    print(f"⚠️ Qwen test failed: {e}")

print("\n" + "=" * 60)
print(f"✅ Setup complete! URL: {DEVBOX_URL}")
