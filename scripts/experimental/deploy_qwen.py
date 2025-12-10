#!/usr/bin/env python3
"""
Qwen Deployment Script
Deploys Qwen to Runloop with optimal configuration
"""

import os
import sys
import time
import json
import requests
from typing import Optional, Dict, Any, List

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class QwenDeployer:
    """Deploys Qwen to Runloop with optimal configuration"""

    def __init__(self, runloop_api_key: str):
        self.api_key = runloop_api_key
        self.base_url = "https://api.runloop.ai/v1"
        self.headers = {
            "Authorization": f"Bearer {runloop_api_key}",
            "Content-Type": "application/json"
        }
        self.qwen_devbox_name = 'omni-agent-qwen-ollama'

    def log_progress(self, message: str):
        """Log progress with timestamps"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        sys.stdout.flush()

    def log_error(self, message: str, error: Exception = None):
        """Error logging with context"""
        timestamp = time.strftime("%H:%M:%S")
        error_msg = f"[{timestamp}] ERROR: {message}"
        if error:
            error_msg += f" - {str(error)}"
        print(error_msg)
        sys.stdout.flush()

    def list_blueprints(self) -> List[Dict[str, Any]]:
        """List available blueprints"""
        self.log_progress("📦 Fetching available blueprints...")

        try:
            response = requests.get(f"{self.base_url}/blueprints", headers=self.headers, timeout=30)
            response.raise_for_status()

            blueprints = response.json().get('data', [])
            self.log_progress(f"✅ Found {len(blueprints)} blueprints")

            return blueprints

        except Exception as e:
            self.log_error("Failed to fetch blueprints", e)
            return []

    def find_qwen_blueprint(self) -> Optional[str]:
        """Find a suitable Qwen/Ollama blueprint"""
        blueprints = self.list_blueprints()

        if not blueprints:
            self.log_error("No blueprints found")
            return None

        # Look for Qwen or Ollama blueprints
        qwen_blueprints = []
        for bp in blueprints:
            name = bp.get('name', '').lower()
            description = bp.get('description', '').lower()

            if any(keyword in name or keyword in description for keyword in ['qwen', 'ollama', 'llm', 'ai']):
                qwen_blueprints.append(bp)

        if not qwen_blueprints:
            self.log_progress("⚠️  No Qwen/Ollama blueprints found, using first available blueprint")
            return blueprints[0].get('id')

        # Prefer ready blueprints
        ready_blueprints = [bp for bp in qwen_blueprints if bp.get('status') == 'build_complete']
        if ready_blueprints:
            blueprint = ready_blueprints[0]
            self.log_progress(f"✅ Found ready Qwen blueprint: {blueprint.get('name')} (ID: {blueprint.get('id')})")
            return blueprint.get('id')

        # Use first Qwen blueprint
        blueprint = qwen_blueprints[0]
        self.log_progress(f"⚠️  Using Qwen blueprint: {blueprint.get('name')} (ID: {blueprint.get('id')}) - Status: {blueprint.get('status')}")
        return blueprint.get('id')

    def create_qwen_devbox(self, blueprint_id: str) -> Optional[str]:
        """Create Qwen devbox from blueprint"""
        self.log_progress(f"🚀 Creating Qwen devbox from blueprint {blueprint_id}...")

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
                self.log_progress(f"✅ Qwen devbox created: {devbox_id}")
                return devbox_id
            else:
                self.log_error("Failed to get devbox ID from response")
                return None

        except Exception as e:
            self.log_error("Failed to create devbox", e)
            return None

    def wait_for_devbox_ready(self, devbox_id: str, timeout: int = 300) -> bool:
        """Wait for devbox to be ready"""
        self.log_progress(f"⏳ Waiting for devbox {devbox_id} to be ready...")

        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                response = requests.get(f"{self.base_url}/devboxes/{devbox_id}", headers=self.headers, timeout=30)
                response.raise_for_status()

                devbox_data = response.json().get('data', {})
                status = devbox_data.get('status', '')

                if status == 'running':
                    self.log_progress("✅ Devbox is ready!")
                    return True
                elif status == 'failed':
                    self.log_error(f"Devbox failed to start: {devbox_data.get('error', 'Unknown error')}")
                    return False
                else:
                    self.log_progress(f"  Status: {status} (waiting...)")

                time.sleep(10)

            except Exception as e:
                self.log_error("Error checking devbox status", e)
                time.sleep(10)

        self.log_error(f"Devbox did not become ready within {timeout} seconds")
        return False

    def test_qwen_endpoint(self, devbox_id: str) -> bool:
        """Test Qwen endpoint"""
        self.log_progress("🧪 Testing Qwen endpoint...")

        devbox_url = f"https://{devbox_id}.runloop.dev:8000"

        try:
            # Test basic connectivity
            response = requests.get(f"{devbox_url}/health", timeout=30)
            if response.status_code == 200:
                self.log_progress("✅ Qwen endpoint is responding")
                return True
            else:
                self.log_progress(f"⚠️  Qwen endpoint returned status {response.status_code}")
                return False

        except Exception as e:
            self.log_error("Failed to test Qwen endpoint", e)
            return False

    def deploy(self) -> bool:
        """Main deployment method"""
        self.log_progress("🚀 STARTING QWEN DEPLOYMENT")
        self.log_progress("=" * 50)

        # Find suitable blueprint
        blueprint_id = self.find_qwen_blueprint()
        if not blueprint_id:
            self.log_error("No suitable blueprint found")
            return False

        # Create devbox
        devbox_id = self.create_qwen_devbox(blueprint_id)
        if not devbox_id:
            self.log_error("Failed to create devbox")
            return False

        # Wait for devbox to be ready
        if not self.wait_for_devbox_ready(devbox_id):
            self.log_error("Devbox failed to become ready")
            return False

        # Test endpoint
        if not self.test_qwen_endpoint(devbox_id):
            self.log_progress("⚠️  Qwen endpoint test failed, but devbox is running")

        # Success!
        devbox_url = f"https://{devbox_id}.runloop.dev:8000"
        self.log_progress("🎉 QWEN DEPLOYMENT SUCCESSFUL!")
        self.log_progress(f"   Devbox ID: {devbox_id}")
        self.log_progress(f"   URL: {devbox_url}")
        self.log_progress(f"   Blueprint ID: {blueprint_id}")

        # Save deployment info
        self.save_deployment_info(devbox_id, devbox_url, blueprint_id)

        return True

    def save_deployment_info(self, devbox_id: str, devbox_url: str, blueprint_id: str):
        """Save deployment information"""
        self.log_progress("💾 Saving deployment information...")

        deployment_info = {
            "devbox_id": devbox_id,
            "devbox_url": devbox_url,
            "blueprint_id": blueprint_id,
            "deployed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "running"
        }

        try:
            with open("qwen_deployment.json", "w") as f:
                json.dump(deployment_info, f, indent=2)

            self.log_progress("✅ Deployment info saved to qwen_deployment.json")

        except Exception as e:
            self.log_error("Failed to save deployment info", e)

def main():
    """Main function"""
    print("🚀 QWEN DEPLOYMENT SCRIPT")
    print("=" * 50)

    # Get API key from user
    runloop_api_key = input("Enter your Runloop API key: ").strip()

    if not runloop_api_key:
        print("❌ No API key provided")
        sys.exit(1)

    try:
        deployer = QwenDeployer(runloop_api_key)
        success = deployer.deploy()

        if success:
            print("\n🎉 QWEN DEPLOYMENT COMPLETE!")
            print("Next steps:")
            print("1. Update Cloudflare Workers with the new Qwen URL")
            print("2. Test the Qwen endpoint")
            print("3. Configure production environment")
            sys.exit(0)
        else:
            print("\n❌ QWEN DEPLOYMENT FAILED!")
            sys.exit(1)

    except Exception as e:
        print(f"\n💥 DEPLOYMENT CRASHED: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
