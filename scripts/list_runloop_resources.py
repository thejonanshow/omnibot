#!/usr/bin/env python3
"""
List existing Runloop blueprints and devboxes
"""
import os
import sys
import requests

# Load from .env file
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

if not API_KEY:
    print("❌ RUNLOOP_API_KEY not found in .env")
    sys.exit(1)

BASE_URL = 'https://api.runloop.ai/v1'

def list_blueprints():
    """List all blueprints"""
    print("\n🔍 Existing Blueprints:")
    print("=" * 60)
    try:
        response = requests.get(
            f'{BASE_URL}/blueprints',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        if response.ok:
            data = response.json()
            # Handle both list and dict responses
            if isinstance(data, str):
                print(f"API returned string: {data}")
                return []
            blueprints = data if isinstance(data, list) else data.get('blueprints', [])
            if not blueprints:
                print("No blueprints found")
                return []
            for bp in blueprints:
                print(f"\nID: {bp.get('id')}")
                print(f"Name: {bp.get('name')}")
                print(f"Status: {bp.get('status')}")
                print(f"Created: {bp.get('created_at')}")
            return blueprints
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"Exception: {e}")
        return []

def list_devboxes():
    """List all devboxes"""
    print("\n🖥️  Existing Devboxes:")
    print("=" * 60)
    try:
        response = requests.get(
            f'{BASE_URL}/devboxes',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        if response.ok:
            data = response.json()
            # Handle both list and dict responses
            if isinstance(data, str):
                print(f"API returned string: {data}")
                return []
            devboxes = data if isinstance(data, list) else data.get('devboxes', [])
            if not devboxes:
                print("No devboxes found")
                return []
            for db in devboxes:
                print(f"\nID: {db.get('id')}")
                print(f"Name: {db.get('name')}")
                print(f"Status: {db.get('status')}")
                print(f"Blueprint: {db.get('blueprint_id', 'N/A')}")
                print(f"Created: {db.get('created_at')}")
            return devboxes
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"Exception: {e}")
        return []

if __name__ == '__main__':
    print("🔑 Runloop API Key:", API_KEY[:15] + "...")
    blueprints = list_blueprints()
    devboxes = list_devboxes()
    
    print("\n" + "=" * 60)
    print(f"📊 Summary: {len(blueprints)} blueprints, {len(devboxes)} devboxes")
