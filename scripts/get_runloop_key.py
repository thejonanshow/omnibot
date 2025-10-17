#!/usr/bin/env python3
"""
Helper script to get Runloop API key from Cloudflare secrets
"""

import subprocess
import sys
import os

def get_runloop_api_key():
    """Get Runloop API key from Cloudflare secrets"""
    print("🔑 Getting Runloop API key from Cloudflare secrets...")

    try:
        # Try to get the secret using wrangler
        result = subprocess.run([
            'wrangler', 'secret', 'get', 'RUNLOOP_API_KEY', '--env', 'production'
        ], capture_output=True, text=True, cwd='cloudflare-worker')

        if result.returncode == 0:
            api_key = result.stdout.strip()
            if api_key:
                print("✅ Successfully retrieved RUNLOOP_API_KEY")
                return api_key
            else:
                print("❌ Empty API key returned")
                return None
        else:
            print(f"❌ Failed to get secret: {result.stderr}")
            return None

    except Exception as e:
        print(f"❌ Error getting secret: {e}")
        return None

def main():
    """Main function"""
    api_key = get_runloop_api_key()

    if api_key:
        print(f"✅ API key retrieved: {api_key[:10]}...{api_key[-4:]}")

        # Set environment variable for current session
        os.environ['RUNLOOP_API_KEY'] = api_key
        print("✅ Environment variable set for current session")

        return api_key
    else:
        print("❌ Could not retrieve API key")
        print("\nAlternative options:")
        print("1. Run: wrangler secret get RUNLOOP_API_KEY --env production")
        print("2. Check your Cloudflare dashboard")
        print("3. Contact the system administrator")
        return None

if __name__ == '__main__':
    main()
