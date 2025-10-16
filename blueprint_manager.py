#!/usr/bin/env python3
"""
Blueprint Manager for Omni-Agent
Manages blueprints and suspended devboxes for efficient deployments
"""

import os
import sys
import time
from typing import Optional, Dict, Any, List

# Add utils to path
sys.path.append('utils')
from runloop_api import RunloopAPI
from devbox_lifecycle import DevboxLifecycleManager

# Load environment variables
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

def log_progress(message: str, step: int = None, total: int = None):
    """Log progress with timestamps"""
    timestamp = time.strftime("%H:%M:%S")
    if step and total:
        print(f"[{timestamp}] [{step}/{total}] {message}")
    else:
        print(f"[{timestamp}] {message}")
    sys.stdout.flush()

def log_debug(message: str):
    """Debug logging"""
    timestamp = time.strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] DEBUG: {message}")
    sys.stdout.flush()

class BlueprintManager:
    # Constants
    BLUEPRINT_WAIT_TIMEOUT = 300  # 5 minutes
    DEVOX_WAIT_TIMEOUT = 120      # 2 minutes
    POLL_INTERVAL = 10            # 10 seconds
    DEVOX_POLL_INTERVAL = 5       # 5 seconds

    def __init__(self):
        self.api = RunloopAPI()
        self.lifecycle = DevboxLifecycleManager()
        self.blueprint_name = 'omni-agent-enhanced'
        self.devbox_name = 'omni-agent-enhanced'

    def list_blueprints(self) -> List[Dict[str, Any]]:
        """List all blueprints"""
        log_debug("Fetching blueprints...")
        try:
            blueprints = self.api.list_blueprints()
            log_debug(f"Found {len(blueprints)} blueprints")
            return blueprints
        except Exception as e:
            log_debug(f"Error fetching blueprints: {e}")
            return []

    def find_blueprint(self) -> Optional[Dict[str, Any]]:
        """Find our blueprint by name"""
        blueprints = self.list_blueprints()
        for blueprint in blueprints:
            if isinstance(blueprint, dict) and blueprint.get('name') == self.blueprint_name:
                return blueprint
        return None

    def create_or_update_blueprint(self) -> Optional[str]:
        """Create or update the blueprint with current repository"""
        log_progress("🔧 Managing blueprint...")

        # Check if blueprint exists
        existing_blueprint = self.find_blueprint()

        if existing_blueprint:
            blueprint_id = existing_blueprint.get('id')
            status = existing_blueprint.get('status', 'unknown')
            log_progress(f"Found existing blueprint: {blueprint_id} (status: {status})")

            if status == 'build_complete':
                log_progress("✓ Blueprint is ready")
                return blueprint_id
            else:
                log_progress("⚠️  Blueprint not ready, will create fresh devbox instead")
                return None

        # For now, skip blueprint creation and create fresh devboxes
        # This avoids the GitHub repository dependency issue
        log_progress("⚠️  No ready blueprint found, will create fresh devbox")
        return None

    def wait_for_blueprint_ready(self, blueprint_id: str, max_wait: int = None) -> bool:
        """Wait for blueprint to be ready"""
        if max_wait is None:
            max_wait = self.BLUEPRINT_WAIT_TIMEOUT

        log_progress(f"⏳ Waiting for blueprint {blueprint_id} to be ready...")

        for i in range(max_wait // self.POLL_INTERVAL):
            try:
                blueprint_data = self.api.get_blueprint(blueprint_id)

                if blueprint_data:
                    status = blueprint_data.get('status', '')

                    if status == 'build_complete':
                        log_progress("✓ Blueprint is ready!")
                        return True
                    else:
                        log_progress(f"  Status: {status} (waiting...)")
                else:
                    log_progress(f"  Error checking status: blueprint not found")

                time.sleep(self.POLL_INTERVAL)
            except Exception as e:
                log_progress(f"  Error: {e}")
                time.sleep(self.POLL_INTERVAL)

        log_progress("⚠️  Blueprint did not become ready in time")
        return False

    def save_blueprint_id(self, blueprint_id: str):
        """Save blueprint ID to .env file"""
        env_path = '.env'
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                lines = f.readlines()

            # Update or add blueprint ID
            found = False
            for i, line in enumerate(lines):
                if line.startswith('OMNI_AGENT_BLUEPRINT_ID='):
                    lines[i] = f'OMNI_AGENT_BLUEPRINT_ID={blueprint_id}\n'
                    found = True
                    break

            if not found:
                lines.append(f'OMNI_AGENT_BLUEPRINT_ID={blueprint_id}\n')

            with open(env_path, 'w') as f:
                f.writelines(lines)

            log_progress(f"✓ Blueprint ID saved to .env")

    def list_devboxes(self) -> List[Dict[str, Any]]:
        """List all devboxes"""
        log_debug("Fetching devboxes...")
        try:
            devboxes = self.api.list_devboxes()
            log_debug(f"Found {len(devboxes)} devboxes")
            return devboxes
        except Exception as e:
            log_debug(f"Error fetching devboxes: {e}")
            return []

    def find_suspended_devbox(self) -> Optional[Dict[str, Any]]:
        """Find a suspended devbox of our type"""
        devboxes = self.list_devboxes()
        for devbox in devboxes:
            if isinstance(devbox, dict):
                name = devbox.get('name', '')
                status = devbox.get('status', '')
                if name == self.devbox_name and status == 'suspended':
                    return devbox
        return None

    def create_fresh_devbox(self) -> Optional[str]:
        """Create a new fresh devbox"""
        log_progress(f"🚀 Creating fresh devbox...")

        try:
            devbox_id = self.api.create_devbox(self.devbox_name)
            if devbox_id:
                log_progress(f"✓ Devbox created: {devbox_id}")
                return devbox_id
            else:
                log_progress(f"❌ Failed to create devbox")
                return None

        except Exception as e:
            log_progress(f"❌ Error creating devbox: {e}")
            return None

    def resume_devbox(self, devbox_id: str) -> bool:
        """Resume a suspended devbox"""
        log_progress(f"🔄 Resuming devbox {devbox_id}...")

        try:
            success = self.api.resume_devbox(devbox_id)
            if success:
                log_progress("✓ Devbox resumed")
                return True
            else:
                log_progress(f"❌ Failed to resume devbox")
                return False

        except Exception as e:
            log_progress(f"❌ Error resuming devbox: {e}")
            return False

    def wait_for_devbox_ready(self, devbox_id: str, max_wait: int = None) -> bool:
        """Wait for devbox to be ready"""
        if max_wait is None:
            max_wait = self.DEVOX_WAIT_TIMEOUT

        log_progress(f"⏳ Waiting for devbox {devbox_id} to be ready...")

        for i in range(max_wait // self.DEVOX_POLL_INTERVAL):
            try:
                devbox_data = self.api.get_devbox(devbox_id)

                if devbox_data:
                    status = devbox_data.get('status', '')

                    if status == 'running':
                        log_progress("✓ Devbox is ready!")
                        return True
                    else:
                        log_progress(f"  Status: {status} (waiting...)")
                else:
                    log_progress(f"  Error checking status: devbox not found")

                time.sleep(self.DEVOX_POLL_INTERVAL)
            except Exception as e:
                log_progress(f"  Error: {e}")
                time.sleep(self.DEVOX_POLL_INTERVAL)

        log_progress("⚠️  Devbox did not become ready in time")
        return False

    def save_devbox_url(self, devbox_id: str):
        """Save devbox URL to files"""
        devbox_url = f"https://{devbox_id}.runloop.dev:8000"

        # Save to .runloop_url
        with open('.runloop_url', 'w') as f:
            f.write(devbox_url)

        # Update .env
        env_path = '.env'
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                lines = f.readlines()

            # Update or add RUNLOOP_URL
            found = False
            for i, line in enumerate(lines):
                if line.startswith('RUNLOOP_URL='):
                    lines[i] = f'RUNLOOP_URL={devbox_url}\n'
                    found = True
                    break

            if not found:
                lines.append(f'RUNLOOP_URL={devbox_url}\n')

            with open(env_path, 'w') as f:
                f.writelines(lines)

        log_progress(f"✓ Devbox URL saved: {devbox_url}")

    def deploy_services_to_devbox(self, devbox_id: str) -> bool:
        """Deploy services to the devbox"""
        log_progress("📦 Deploying services to devbox...")

        # Import the deployment functions
        sys.path.append('scripts')
        from deploy_runloop import deploy_services, start_services

        try:
            # Deploy services
            deploy_services(devbox_id)

            # Start services
            start_services(devbox_id)

            log_progress("✓ Services deployed and started")
            return True

        except Exception as e:
            log_progress(f"❌ Error deploying services: {e}")
            return False

    def get_or_create_devbox(self) -> Optional[str]:
        """Get existing suspended devbox or create new one"""
        log_progress("🔍 Looking for existing suspended devbox...")

        # Check for suspended devbox
        suspended_devbox = self.find_suspended_devbox()

        if suspended_devbox:
            devbox_id = suspended_devbox.get('id')
            log_progress(f"✓ Found suspended devbox: {devbox_id}")

            # Resume it
            if self.resume_devbox(devbox_id):
                if self.wait_for_devbox_ready(devbox_id):
                    self.save_devbox_url(devbox_id)
                    return devbox_id
                else:
                    log_progress("⚠️  Devbox did not become ready")
            else:
                log_progress("⚠️  Failed to resume devbox")

        # Create new fresh devbox
        log_progress("Creating new fresh devbox...")
        devbox_id = self.create_fresh_devbox()
        if not devbox_id:
            log_progress("❌ Failed to create devbox")
            return None

        # Wait for devbox to be ready
        if self.wait_for_devbox_ready(devbox_id):
            # Deploy services
            if self.deploy_services_to_devbox(devbox_id):
                self.save_devbox_url(devbox_id)
                return devbox_id
            else:
                log_progress("❌ Failed to deploy services")
                return None
        else:
            log_progress("❌ Devbox did not become ready")
            return None

    def cleanup_old_devboxes(self):
        """Clean up old devboxes, keep only one suspended"""
        log_progress("🧹 Cleaning up old devboxes...")

        devboxes = self.list_devboxes()
        our_devboxes = []

        # Find our devboxes
        for devbox in devboxes:
            if isinstance(devbox, dict):
                name = devbox.get('name', '')
                if name == self.devbox_name:
                    our_devboxes.append(devbox)

        log_progress(f"Found {len(our_devboxes)} devboxes of our type")

        # Keep only one suspended devbox
        suspended_count = 0
        for devbox in our_devboxes:
            devbox_id = devbox.get('id')
            status = devbox.get('status', '')

            if status == 'suspended':
                if suspended_count == 0:
                    log_progress(f"  Keeping suspended devbox: {devbox_id}")
                    suspended_count += 1
                else:
                    log_progress(f"  Deleting extra suspended devbox: {devbox_id}")
                    # Delete extra suspended devboxes
                    if self.api.delete_devbox(devbox_id):
                        log_progress(f"    ✓ Deleted {devbox_id}")
                    else:
                        log_progress(f"    ✗ Failed to delete {devbox_id}")
            elif status in ['running', 'provisioning']:
                log_progress(f"  Keeping active devbox: {devbox_id} (status: {status})")
            else:
                log_progress(f"  Deleting old devbox: {devbox_id} (status: {status})")
                # Delete old devboxes
                if self.api.delete_devbox(devbox_id):
                    log_progress(f"    ✓ Deleted {devbox_id}")
                else:
                    log_progress(f"    ✗ Failed to delete {devbox_id}")

def main():
    """Main function"""
    log_progress("🚀 BLUEPRINT MANAGER")
    log_progress("=" * 50)

    try:
        manager = BlueprintManager()

        # Clean up old devboxes first
        manager.cleanup_old_devboxes()

        # Get or create healthy devbox using lifecycle manager
        devbox_id = manager.lifecycle.get_or_create_healthy_devbox()

        if devbox_id:
            # Run health checks before considering deployment successful
            log_progress("🏥 Running health checks before finalizing deployment...")

            # Import and run health checker
            sys.path.append('utils')
            from health_checker import HealthChecker

            health_checker = HealthChecker()
            health_checker.devbox_id = devbox_id  # Set the devbox ID for health checks

            if health_checker.run_all_health_checks():
                log_progress("✅ DEPLOYMENT COMPLETE AND HEALTHY")
                log_progress("=" * 50)
                log_progress(f"📍 Devbox ID: {devbox_id}")
                log_progress(f"🌐 URL: https://{devbox_id}.runloop.dev:8000")
                log_progress("")
                log_progress("💡 Available endpoints:")
                log_progress("   • /health - Service health check")
                log_progress("   • /execute - Command execution")
                log_progress("   • /browse - Web browsing")
                log_progress("   • /read_file, /write_file, /list_files - File operations")
                log_progress("   • /stt/whisper - Speech to text")
                log_progress("   • /tts/piper - Text to speech")
                log_progress("")
                log_progress("🎯 Deployment is healthy and ready for blueprint creation!")
            else:
                log_progress("❌ DEPLOYMENT FAILED HEALTH CHECKS")
                log_progress("=" * 50)
                log_progress("Health check failures:")
                for failure in health_checker.failed_checks:
                    log_progress(f"  - {failure}")
                log_progress("")
                log_progress("🔄 Consider rolling back this deployment")
                sys.exit(1)
        else:
            log_progress("❌ DEPLOYMENT FAILED")
            sys.exit(1)

    except Exception as e:
        log_progress(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
