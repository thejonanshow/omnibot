#!/usr/bin/env python3
"""
Update Qwen URL in Cloudflare Workers
"""

import json
import subprocess
import sys
import os

def update_qwen_url(qwen_url: str):
    """Update Qwen URL in Cloudflare Workers secrets"""
    print(f"🔧 Updating Qwen URL in Cloudflare Workers: {qwen_url}")

    try:
        # Set the QWEN_RUNLOOP_URL secret
        result = subprocess.run([
            'wrangler', 'secret', 'put', 'QWEN_RUNLOOP_URL', '--env', 'production'
        ], input=qwen_url, text=True, cwd='cloudflare-worker')

        if result.returncode == 0:
            print("✅ Successfully updated QWEN_RUNLOOP_URL in Cloudflare Workers")
            return True
        else:
            print(f"❌ Failed to update secret: {result.stderr}")
            return False

    except Exception as e:
        print(f"❌ Error updating secret: {e}")
        return False

def main():
    """Main function"""
    print("🔧 QWEN URL UPDATER")
    print("=" * 30)

    # Get URL from command line or deployment file
    if len(sys.argv) > 1:
        qwen_url = sys.argv[1]
    else:
        # Try to read from deployment file
        try:
            with open("qwen_deployment.json", "r") as f:
                deployment_info = json.load(f)
                qwen_url = deployment_info.get("devbox_url")
        except FileNotFoundError:
            print("❌ No deployment file found and no URL provided")
            print("Usage: python3 update_qwen_url.py <QWEN_URL>")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error reading deployment file: {e}")
            sys.exit(1)

    if not qwen_url:
        print("❌ No Qwen URL found")
        sys.exit(1)

    print(f"📡 Qwen URL: {qwen_url}")

    # Update the secret
    success = update_qwen_url(qwen_url)

    if success:
        print("\n🎉 QWEN URL UPDATED!")
        print("Next steps:")
        print("1. Test the Qwen endpoint")
        print("2. Send a coding request to verify routing")
        sys.exit(0)
    else:
        print("\n❌ FAILED TO UPDATE QWEN URL!")
        sys.exit(1)

if __name__ == '__main__':
    main()
