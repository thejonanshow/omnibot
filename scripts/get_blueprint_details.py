#!/usr/bin/env python3
"""
Get blueprint details to see what it's supposed to do
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

print(f"📋 Blueprint: {BLUEPRINT_ID}")
print("=" * 60)

response = requests.get(
    f'{BASE_URL}/blueprints/{BLUEPRINT_ID}',
    headers={'Authorization': f'Bearer {API_KEY}'}
)

if response.ok:
    data = response.json()
    print(json.dumps(data, indent=2))
else:
    print(f"Error: {response.status_code}")
    print(response.text)
