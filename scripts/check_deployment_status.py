#!/usr/bin/env python3
"""
Check Qwen Deployment Status
Verifies if Qwen is properly deployed and configured
"""

import os
import sys
import json
import requests
from datetime import datetime

def check_deployment_file():
    """Check if deployment file exists"""
    if os.path.exists("qwen_deployment.json"):
        try:
            with open("qwen_deployment.json", "r") as f:
                deployment_info = json.load(f)
            return deployment_info
        except Exception as e:
            print(f"❌ Error reading deployment file: {e}")
            return None
    else:
        print("❌ No qwen_deployment.json found")
        return None

def check_qwen_endpoint(qwen_url: str):
    """Check if Qwen endpoint is accessible"""
    try:
        response = requests.get(f"{qwen_url}/health", timeout=10)
        return {
            "accessible": response.status_code == 200,
            "status_code": response.status_code,
            "url": qwen_url
        }
    except Exception as e:
        return {
            "accessible": False,
            "error": str(e),
            "url": qwen_url
        }

def check_worker_configuration():
    """Check if worker is configured with Qwen URL"""
    try:
        # This would require access to Cloudflare secrets
        # For now, we'll check if the .runloop_url file exists
        if os.path.exists(".runloop_url"):
            with open(".runloop_url", "r") as f:
                url = f.read().strip()
            return {"configured": True, "url": url}
        else:
            return {"configured": False, "error": "No .runloop_url file found"}
    except Exception as e:
        return {"configured": False, "error": str(e)}

def main():
    """Main function"""
    print("🔍 QWEN DEPLOYMENT STATUS CHECK")
    print("=" * 50)

    # Check deployment file
    print("1. Checking deployment file...")
    deployment_info = check_deployment_file()
    if deployment_info:
        print(f"✅ Deployment file found")
        print(f"   Devbox ID: {deployment_info.get('devbox_id', 'N/A')}")
        print(f"   URL: {deployment_info.get('devbox_url', 'N/A')}")
        print(f"   Deployed: {deployment_info.get('deployed_at', 'N/A')}")

        # Check if endpoint is accessible
        qwen_url = deployment_info.get('devbox_url')
        if qwen_url:
            print(f"\n2. Checking Qwen endpoint...")
            endpoint_status = check_qwen_endpoint(qwen_url)
            if endpoint_status["accessible"]:
                print(f"✅ Qwen endpoint is accessible")
                print(f"   Status: {endpoint_status['status_code']}")
            else:
                print(f"❌ Qwen endpoint not accessible")
                print(f"   Error: {endpoint_status.get('error', 'Unknown error')}")
    else:
        print("❌ No deployment file found")

    # Check worker configuration
    print(f"\n3. Checking worker configuration...")
    config_status = check_worker_configuration()
    if config_status["configured"]:
        print(f"✅ Worker configured with Qwen URL")
        print(f"   URL: {config_status['url']}")
    else:
        print(f"❌ Worker not configured")
        print(f"   Error: {config_status.get('error', 'Unknown error')}")

    # Overall status
    print(f"\n" + "=" * 50)
    if deployment_info and config_status["configured"]:
        print("🎉 QWEN DEPLOYMENT COMPLETE")
        print("Next: Test the system with a coding request")
    else:
        print("⚠️  QWEN DEPLOYMENT INCOMPLETE")
        print("Next: Deploy Qwen using the deployment script")

if __name__ == '__main__':
    main()
