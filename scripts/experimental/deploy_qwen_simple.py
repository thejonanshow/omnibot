#!/usr/bin/env python3
"""
Simple Qwen Deployment Script
Run this script with your Runloop API key to deploy Qwen
"""

import os
import sys
import time
import json
import requests
from typing import Optional, Dict, Any, List

class SimpleQwenDeployer:
    """Simple Qwen deployer"""

    def __init__(self, runloop_api_key: str):
        self.api_key = runloop_api_key
        self.base_url = "https://api.runloop.ai/v1"
        self.headers = {
            "Authorization": f"Bearer {runloop_api_key}",
            "Content-Type": "application/json"
        }
        self.qwen_devbox_name = 'omni-agent-qwen-ollama'

    def log(self, message: str):
        """Log with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")

    def list_blueprints(self) -> List[Dict[str, Any]]:
        """List available blueprints"""
        self.log("📦 Fetching available blueprints...")

        try:
            response = requests.get(f"{self.base_url}/blueprints", headers=self.headers, timeout=30)
            response.raise_for_status()

            blueprints = response.json().get('data', [])
            self.log(f"✅ Found {len(blueprints)} blueprints")

            return blueprints

        except Exception as e:
            self.log(f"❌ Failed to fetch blueprints: {e}")
            return []

    def find_best_blueprint(self) -> Optional[str]:
        """Find the best blueprint for Qwen"""
        blueprints = self.list_blueprints()

        if not blueprints:
            return None

        # Look for AI/LLM related blueprints
        ai_blueprints = []
        for bp in blueprints:
            name = bp.get('name', '').lower()
            description = bp.get('description', '').lower()

            if any(keyword in name or keyword in description for keyword in
                   ['ai', 'llm', 'qwen', 'ollama', 'python', 'jupyter', 'ml']):
                ai_blueprints.append(bp)

        # Prefer ready blueprints
        ready_blueprints = [bp for bp in ai_blueprints if bp.get('status') == 'build_complete']
        if ready_blueprints:
            blueprint = ready_blueprints[0]
            self.log(f"✅ Found ready AI blueprint: {blueprint.get('name')}")
            return blueprint.get('id')

        # Use first AI blueprint
        if ai_blueprints:
            blueprint = ai_blueprints[0]
            self.log(f"⚠️  Using AI blueprint: {blueprint.get('name')} (Status: {blueprint.get('status')})")
            return blueprint.get('id')

        # Fallback to first blueprint
        blueprint = blueprints[0]
        self.log(f"⚠️  Using first available blueprint: {blueprint.get('name')}")
        return blueprint.get('id')

    def create_devbox(self, blueprint_id: str) -> Optional[str]:
        """Create devbox from blueprint"""
        self.log(f"🚀 Creating devbox from blueprint {blueprint_id}...")

        try:
            payload = {
                "name": self.qwen_devbox_name,
                "blueprint_id": blueprint_id
            }

            response = requests.post(f"{self.base_url}/devboxes", headers=self.headers, json=payload, timeout=60)
            response.raise_for_status()

            devbox_data = response.json().get('data', {})
            devbox_id = devbox_data.get('id')

            if devbox_id:
                self.log(f"✅ Devbox created: {devbox_id}")
                return devbox_id
            else:
                self.log("❌ Failed to get devbox ID")
                return None

        except Exception as e:
            self.log(f"❌ Failed to create devbox: {e}")
            return None

    def wait_for_ready(self, devbox_id: str) -> bool:
        """Wait for devbox to be ready"""
        self.log(f"⏳ Waiting for devbox {devbox_id} to be ready...")

        for i in range(30):  # Wait up to 5 minutes
            try:
                response = requests.get(f"{self.base_url}/devboxes/{devbox_id}", headers=self.headers, timeout=30)
                response.raise_for_status()

                devbox_data = response.json().get('data', {})
                status = devbox_data.get('status', '')

                if status == 'running':
                    self.log("✅ Devbox is ready!")
                    return True
                elif status == 'failed':
                    self.log(f"❌ Devbox failed: {devbox_data.get('error', 'Unknown error')}")
                    return False
                else:
                    self.log(f"  Status: {status} (waiting... {i+1}/30)")

                time.sleep(10)

            except Exception as e:
                self.log(f"⚠️  Error checking status: {e}")
                time.sleep(10)

        self.log("❌ Devbox did not become ready within 5 minutes")
        return False

    def deploy(self) -> bool:
        """Deploy Qwen"""
        self.log("🚀 STARTING QWEN DEPLOYMENT")
        self.log("=" * 40)

        # Find blueprint
        blueprint_id = self.find_best_blueprint()
        if not blueprint_id:
            self.log("❌ No suitable blueprint found")
            return False

        # Create devbox
        devbox_id = self.create_devbox(blueprint_id)
        if not devbox_id:
            self.log("❌ Failed to create devbox")
            return False

        # Wait for ready
        if not self.wait_for_ready(devbox_id):
            self.log("❌ Devbox failed to become ready")
            return False

        # Success!
        devbox_url = f"https://{devbox_id}.runloop.dev:8000"
        self.log("🎉 QWEN DEPLOYMENT SUCCESSFUL!")
        self.log(f"   Devbox ID: {devbox_id}")
        self.log(f"   URL: {devbox_url}")

        # Save info
        info = {
            "devbox_id": devbox_id,
            "devbox_url": devbox_url,
            "blueprint_id": blueprint_id,
            "deployed_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        with open("qwen_deployment.json", "w") as f:
            json.dump(info, f, indent=2)

        self.log("💾 Deployment info saved to qwen_deployment.json")
        return True

def main():
    """Main function"""
    print("🚀 SIMPLE QWEN DEPLOYMENT")
    print("=" * 40)

    # Get API key from command line or environment
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        api_key = os.getenv('RUNLOOP_API_KEY')

    if not api_key:
        print("❌ No API key provided")
        print("Usage: python3 deploy_qwen_simple.py <API_KEY>")
        print("   or: RUNLOOP_API_KEY=<key> python3 deploy_qwen_simple.py")
        sys.exit(1)

    try:
        deployer = SimpleQwenDeployer(api_key)
        success = deployer.deploy()

        if success:
            print("\n🎉 DEPLOYMENT COMPLETE!")
            print("Next: Update Cloudflare Workers with the new URL")
            sys.exit(0)
        else:
            print("\n❌ DEPLOYMENT FAILED!")
            sys.exit(1)

    except Exception as e:
        print(f"\n💥 CRASHED: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
