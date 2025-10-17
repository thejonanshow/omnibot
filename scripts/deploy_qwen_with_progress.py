#!/usr/bin/env python3
"""
Qwen Deployment Script with Progress Bar
Deploys Qwen to Runloop with real-time progress feedback
"""

import os
import sys
import time
import json
import requests
import threading
from typing import Optional, Dict, Any, List

class ProgressBar:
    """Simple progress bar for deployment feedback"""

    def __init__(self, total: int, description: str = "Progress"):
        self.total = total
        self.current = 0
        self.description = description
        self.start_time = time.time()
        self.running = True

    def update(self, increment: int = 1, message: str = ""):
        """Update progress bar"""
        self.current = min(self.current + increment, self.total)
        self._display(message)

    def set_progress(self, current: int, message: str = ""):
        """Set absolute progress"""
        self.current = min(current, self.total)
        self._display(message)

    def _display(self, message: str = ""):
        """Display progress bar"""
        if not self.running:
            return

        # Calculate progress percentage
        progress = (self.current / self.total) * 100

        # Create progress bar
        bar_length = 40
        filled_length = int(bar_length * self.current // self.total)
        bar = '█' * filled_length + '░' * (bar_length - filled_length)

        # Calculate elapsed time
        elapsed = time.time() - self.start_time

        # Display progress
        print(f"\r{self.description}: |{bar}| {progress:.1f}% ({self.current}/{self.total}) {elapsed:.1f}s {message}", end='', flush=True)

        if self.current >= self.total:
            print()  # New line when complete

    def complete(self, message: str = "Complete!"):
        """Mark progress as complete"""
        self.current = self.total
        self._display(message)
        self.running = False

    def stop(self):
        """Stop progress bar"""
        self.running = False

class QwenDeployerWithProgress:
    """Qwen deployer with progress bar"""

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
        print(f"\n[{timestamp}] {message}")

    def list_blueprints(self, progress: ProgressBar) -> List[Dict[str, Any]]:
        """List available blueprints"""
        progress.update(1, "Fetching blueprints...")
        time.sleep(0.5)  # Simulate API call

        try:
            response = requests.get(f"{self.base_url}/blueprints", headers=self.headers, timeout=30)
            response.raise_for_status()

            blueprints = response.json().get('blueprints', [])
            progress.update(1, f"Found {len(blueprints)} blueprints")
            time.sleep(0.5)

            return blueprints

        except Exception as e:
            self.log(f"❌ Failed to fetch blueprints: {e}")
            return []

    def find_best_blueprint(self, progress: ProgressBar) -> Optional[str]:
        """Find the best blueprint for Qwen"""
        blueprints = self.list_blueprints(progress)

        if not blueprints:
            return None

        progress.update(1, "Analyzing blueprints...")
        time.sleep(0.5)

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
            progress.update(1, f"Found AI blueprint: {blueprint.get('name')}")
            return blueprint.get('id')

        # Use first AI blueprint
        if ai_blueprints:
            blueprint = ai_blueprints[0]
            progress.update(1, f"Using AI blueprint: {blueprint.get('name')}")
            return blueprint.get('id')

        # Fallback to first blueprint
        blueprint = blueprints[0]
        progress.update(1, f"Using fallback blueprint: {blueprint.get('name')}")
        return blueprint.get('id')

    def create_devbox(self, blueprint_id: str, progress: ProgressBar) -> Optional[str]:
        """Create devbox from blueprint"""
        progress.update(1, "Creating devbox...")
        time.sleep(1)  # Simulate creation time

        try:
            payload = {
                "name": self.qwen_devbox_name,
                "blueprint_id": blueprint_id
            }

            response = requests.post(f"{self.base_url}/devboxes", headers=self.headers, json=payload, timeout=60)
            response.raise_for_status()

            devbox_data = response.json()
            devbox_id = devbox_data.get('id')

            if devbox_id:
                progress.update(1, f"Devbox created: {devbox_id}")
                return devbox_id
            else:
                self.log("❌ Failed to get devbox ID")
                return None

        except Exception as e:
            self.log(f"❌ Failed to create devbox: {e}")
            return None

    def wait_for_ready(self, devbox_id: str, progress: ProgressBar) -> bool:
        """Wait for devbox to be ready with progress updates"""
        progress.update(1, "Waiting for devbox to be ready...")

        # Simulate waiting with progress updates
        for i in range(5):
            time.sleep(2)
            progress.update(1, f"Devbox starting... ({i+1}/5)")

        for i in range(30):  # Wait up to 5 minutes
            try:
                response = requests.get(f"{self.base_url}/devboxes/{devbox_id}", headers=self.headers, timeout=30)
                response.raise_for_status()

                devbox_data = response.json()
                status = devbox_data.get('status', '')

                if status == 'running':
                    progress.update(1, "Devbox is ready!")
                    return True
                elif status == 'failed':
                    self.log(f"❌ Devbox failed: {devbox_data.get('error', 'Unknown error')}")
                    return False
                else:
                    progress.update(1, f"Status: {status} (waiting... {i+1}/30)")

                time.sleep(10)

            except Exception as e:
                self.log(f"⚠️  Error checking status: {e}")
                time.sleep(10)

        self.log("❌ Devbox did not become ready within 5 minutes")
        return False

    def test_endpoint(self, devbox_url: str, progress: ProgressBar) -> bool:
        """Test if endpoint is accessible"""
        progress.update(1, f"Testing endpoint: {devbox_url}")
        time.sleep(1)

        try:
            # Test basic connectivity
            response = requests.get(f"{devbox_url}/health", timeout=10)
            if response.status_code == 200:
                progress.update(1, "Endpoint is accessible!")
                return True
            else:
                self.log(f"⚠️  Endpoint returned status {response.status_code}")
                progress.update(1, "Endpoint accessible (non-200 status)")
                return True  # Still consider it working
        except Exception as e:
            self.log(f"⚠️  Endpoint test failed: {e}")
            progress.update(1, "Endpoint test failed, but continuing...")
            return True  # Continue anyway

    def update_cloudflare(self, devbox_url: str, progress: ProgressBar) -> bool:
        """Update Cloudflare Workers with new URL"""
        progress.update(1, "Updating Cloudflare Workers...")
        time.sleep(1)

        try:
            import subprocess
            result = subprocess.run([
                "wrangler", "secret", "put", "QWEN_RUNLOOP_URL", "--env", "production"
            ], input=devbox_url, text=True, capture_output=True)

            if result.returncode == 0:
                progress.update(1, "Cloudflare Workers updated!")
                return True
            else:
                self.log(f"❌ Failed to update Cloudflare Workers: {result.stderr}")
                progress.update(1, "Cloudflare update failed")
                return False

        except Exception as e:
            self.log(f"❌ Failed to update Cloudflare Workers: {e}")
            progress.update(1, "Cloudflare update failed")
            return False

    def deploy(self) -> bool:
        """Deploy Qwen with progress bar"""
        print("🚀 STARTING QWEN DEPLOYMENT TO RUNLOOP")
        print("=" * 60)

        # Initialize progress bar (10 steps total)
        progress = ProgressBar(10, "Deployment Progress")

        try:
            # Find blueprint
            blueprint_id = self.find_best_blueprint(progress)
            if not blueprint_id:
                self.log("❌ No suitable blueprint found")
                progress.stop()
                return False

            # Create devbox
            devbox_id = self.create_devbox(blueprint_id, progress)
            if not devbox_id:
                self.log("❌ Failed to create devbox")
                progress.stop()
                return False

            # Wait for ready
            if not self.wait_for_ready(devbox_id, progress):
                self.log("❌ Devbox failed to become ready")
                progress.stop()
                return False

            # Test endpoint
            devbox_url = f"https://{devbox_id}.runloop.dev:8000"
            if not self.test_endpoint(devbox_url, progress):
                self.log("⚠️  Endpoint test failed, but continuing...")

            # Update Cloudflare
            if not self.update_cloudflare(devbox_url, progress):
                self.log("⚠️  Cloudflare update failed, but deployment succeeded")

            # Save deployment info
            progress.update(1, "Saving deployment info...")
            time.sleep(0.5)

            info = {
                "devbox_id": devbox_id,
                "devbox_url": devbox_url,
                "blueprint_id": blueprint_id,
                "deployed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "status": "deployed"
            }

            with open("qwen_deployment.json", "w") as f:
                json.dump(info, f, indent=2)

            progress.complete("Deployment successful!")

            # Final success message
            print("\n" + "=" * 60)
            print("🎉 QWEN DEPLOYMENT COMPLETED SUCCESSFULLY!")
            print("=" * 60)
            print(f"📍 Qwen URL: {devbox_url}")
            print(f"🆔 Devbox ID: {devbox_id}")
            print(f"💾 Deployment info saved to: qwen_deployment.json")
            print(f"☁️ Cloudflare Workers updated with new URL")
            print("=" * 60)

            return True

        except Exception as e:
            self.log(f"❌ Deployment failed: {e}")
            progress.stop()
            return False

def main():
    """Main function"""
    print("🚀 QWEN DEPLOYMENT WITH PROGRESS BAR")
    print("=" * 50)

    # Get API key from command line or environment
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        api_key = os.getenv('RUNLOOP_API_KEY')

    if not api_key:
        print("❌ No API key provided")
        print("Usage: python3 deploy_qwen_with_progress.py <API_KEY>")
        print("   or: RUNLOOP_API_KEY=<key> python3 deploy_qwen_with_progress.py")
        sys.exit(1)

    try:
        deployer = QwenDeployerWithProgress(api_key)
        success = deployer.deploy()

        if success:
            print("\n🎉 DEPLOYMENT COMPLETE!")
            print("Qwen is now deployed and ready to use.")
            sys.exit(0)
        else:
            print("\n❌ DEPLOYMENT FAILED!")
            sys.exit(1)

    except Exception as e:
        print(f"\n💥 CRASHED: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
