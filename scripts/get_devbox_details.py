#!/usr/bin/env python3
"""
Get detailed devbox info
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
DEVBOX_URL = os.getenv('RUNLOOP_URL', '')
BASE_URL = 'https://api.runloop.ai/v1'

if not DEVBOX_URL:
    print("No RUNLOOP_URL set")
    sys.exit(1)

devbox_id = DEVBOX_URL.split('//')[1].split('.')[0]

response = requests.get(
    f'{BASE_URL}/devboxes/{devbox_id}',
    headers={'Authorization': f'Bearer {API_KEY}'}
)

if response.ok:
    data = response.json()
    print(json.dumps(data, indent=2))
else:
    print(f"Error: {response.status_code}")
    print(response.text)
