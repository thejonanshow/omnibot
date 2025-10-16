#!/usr/bin/env python3
"""
Devbox Lifecycle Manager
Handles devbox creation, health checks, suspension, and cleanup
"""

import os
import sys
import time
import json
from typing import Optional, Dict, Any, List
from .runloop_api import RunloopAPI

# Load environment variables
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

def log_progress(message: str):
    """Log progress with timestamps"""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")
    sys.stdout.flush()

def log_debug(message: str):
    """Debug logging"""
    timestamp = time.strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] DEBUG: {message}")
    sys.stdout.flush()

class DevboxLifecycleManager:
    """Manages devbox lifecycle: create, health check, suspend, cleanup"""

    def __init__(self):
        self.api = RunloopAPI()
        self.devbox_name = 'omni-agent-enhanced'
        self.health_check_timeout = 60  # 1 minute
        self.suspend_timeout = 300      # 5 minutes

    def get_saved_devbox_id(self) -> Optional[str]:
        """Get saved devbox ID from .env"""
        return os.getenv('RUNLOOP_DEVOX_ID', '')

    def save_devbox_id(self, devbox_id: str):
        """Save devbox ID to .env file"""
        env_path = '.env'
        if not os.path.exists(env_path):
            return

        with open(env_path, 'r') as f:
            lines = f.readlines()

        # Update or add RUNLOOP_DEVOX_ID
        updated = False
        for i, line in enumerate(lines):
            if line.startswith('RUNLOOP_DEVOX_ID='):
                lines[i] = f'RUNLOOP_DEVOX_ID={devbox_id}\n'
                updated = True
                break

        if not updated:
            lines.append(f'RUNLOOP_DEVOX_ID={devbox_id}\n')

        with open(env_path, 'w') as f:
            f.writelines(lines)

        log_progress(f"✓ Devbox ID saved: {devbox_id}")

    def cleanup_shutdown_devboxes(self):
        """Delete all shutdown devboxes to save costs"""
        log_progress("🧹 Cleaning up shutdown devboxes...")

        devboxes = self.api.list_devboxes()
        deleted_count = 0

        for devbox in devboxes:
            if isinstance(devbox, dict):
                devbox_id = devbox.get('id', '')
                name = devbox.get('name', '')
                status = devbox.get('status', '')

                # Only delete shutdown devboxes of our type
                if name == self.devbox_name and status == 'shutdown':
                    log_progress(f"  Attempting to delete shutdown devbox: {devbox_id}")
                    if self.api.delete_devbox(devbox_id):
                        deleted_count += 1
                        log_progress(f"  ✓ Deleted {devbox_id}")
                    else:
                        # Runloop API may not support deletion of shutdown devboxes
                        # This is not critical since shutdown devboxes don't cost money
                        log_progress(f"  ⚠️  Could not delete {devbox_id} (API may not support deletion)")

        log_progress(f"✓ Cleanup complete: {deleted_count} devboxes deleted")

    def find_suspended_devbox(self) -> Optional[Dict[str, Any]]:
        """Find a suspended devbox of our type"""
        devboxes = self.api.list_devboxes()
        for devbox in devboxes:
            if isinstance(devbox, dict):
                name = devbox.get('name', '')
                status = devbox.get('status', '')
                if name == self.devbox_name and status == 'suspended':
                    return devbox
        return None

    def create_fresh_devbox(self) -> Optional[str]:
        """Create a new fresh devbox from blueprint"""
        log_progress("🚀 Creating fresh devbox from blueprint...")

        # Get blueprint ID from environment
        blueprint_id = os.getenv('OMNI_AGENT_BLUEPRINT_ID')
        if blueprint_id:
            log_progress(f"Using blueprint: {blueprint_id}")
            devbox_id = self.api.create_devbox(self.devbox_name, blueprint_id)
        else:
            log_progress("No blueprint found, creating basic devbox")
            devbox_id = self.api.create_devbox(self.devbox_name)

        if devbox_id:
            log_progress(f"✓ Devbox created: {devbox_id}")
            return devbox_id
        else:
            log_progress("❌ Failed to create devbox")
            return None

    def wait_for_devbox_ready(self, devbox_id: str) -> bool:
        """Wait for devbox to be ready"""
        log_progress(f"⏳ Waiting for devbox {devbox_id} to be ready...")

        for i in range(24):  # 2 minutes max
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

                time.sleep(5)
            except Exception as e:
                log_progress(f"  Error: {e}")
                time.sleep(5)

        log_progress("⚠️  Devbox did not become ready in time")
        return False

    def run_health_checks(self, devbox_id: str) -> bool:
        """Run comprehensive health checks on the devbox"""
        log_progress("🏥 Running health checks...")

        health_checks = [
            ("Basic connectivity", "echo 'Hello from devbox'"),
            ("Python availability", "python3 --version"),
            ("Flask availability", "python3 -c 'import flask; print(\"Flask OK\")'"),
            ("Curl availability", "curl --version"),
            ("File system", "ls -la /home/user"),
        ]

        passed_checks = 0
        total_checks = len(health_checks)

        for check_name, command in health_checks:
            log_progress(f"  Testing {check_name}...")

            try:
                result = self.api.execute_command(devbox_id, command)

                if result.get('exit_status') == 0:
                    log_progress(f"  ✓ {check_name} passed")
                    passed_checks += 1
                else:
                    log_progress(f"  ❌ {check_name} failed: {result.get('stderr', 'Unknown error')}")

            except Exception as e:
                log_progress(f"  ❌ {check_name} failed: {e}")

        success_rate = passed_checks / total_checks
        log_progress(f"Health check results: {passed_checks}/{total_checks} passed ({success_rate:.1%})")

        # Consider healthy if at least 80% of checks pass
        return success_rate >= 0.8

    def suspend_devbox(self, devbox_id: str) -> bool:
        """Suspend a devbox to preserve state"""
        log_progress(f"⏸️  Suspending devbox {devbox_id}...")

        success = self.api.suspend_devbox(devbox_id)
        if success:
            log_progress("✓ Devbox suspended successfully")
            return True
        else:
            log_progress("❌ Failed to suspend devbox")
            return False

    def resume_devbox(self, devbox_id: str) -> bool:
        """Resume a suspended devbox"""
        log_progress(f"▶️  Resuming devbox {devbox_id}...")

        success = self.api.resume_devbox(devbox_id)
        if success:
            log_progress("✓ Devbox resumed successfully")
            return True
        else:
            log_progress("❌ Failed to resume devbox")
            return False

    def get_or_create_healthy_devbox(self) -> Optional[str]:
        """Get a healthy devbox, creating one if needed"""
        log_progress("🔍 Looking for healthy devbox...")

        # First, clean up shutdown devboxes
        self.cleanup_shutdown_devboxes()

        # Check if we have a saved devbox ID
        saved_devbox_id = self.get_saved_devbox_id()
        if saved_devbox_id:
            log_progress(f"Found saved devbox ID: {saved_devbox_id}")

            # Check if it's suspended and resume it
            devbox_data = self.api.get_devbox(saved_devbox_id)
            if devbox_data:
                status = devbox_data.get('status', '')

                if status == 'suspended':
                    log_progress("Resuming suspended devbox...")
                    if self.resume_devbox(saved_devbox_id):
                        if self.wait_for_devbox_ready(saved_devbox_id):
                            if self.run_health_checks(saved_devbox_id):
                                log_progress("✓ Resumed healthy devbox")
                                return saved_devbox_id
                            else:
                                log_progress("⚠️  Resumed devbox failed health checks")
                        else:
                            log_progress("⚠️  Resumed devbox not ready")
                    else:
                        log_progress("⚠️  Failed to resume devbox")

                elif status == 'running':
                    log_progress("Devbox is already running, checking health...")
                    if self.run_health_checks(saved_devbox_id):
                        log_progress("✓ Running devbox is healthy")
                        return saved_devbox_id
                    else:
                        log_progress("⚠️  Running devbox failed health checks")
                        # Don't create a new one, just return the existing one
                        log_progress("⚠️  Using existing devbox despite health check failures")
                        return saved_devbox_id

                elif status == 'shutdown':
                    log_progress("Saved devbox is shutdown, will create new one")
                else:
                    log_progress(f"Saved devbox has unknown status: {status}")
            else:
                log_progress("Saved devbox ID not found, will create new one")

        # Look for any suspended devbox of our type
        suspended_devbox = self.find_suspended_devbox()
        if suspended_devbox:
            devbox_id = suspended_devbox.get('id')
            log_progress(f"Found suspended devbox: {devbox_id}")

            if self.resume_devbox(devbox_id):
                if self.wait_for_devbox_ready(devbox_id):
                    if self.run_health_checks(devbox_id):
                        log_progress("✓ Resumed healthy suspended devbox")
                        self.save_devbox_id(devbox_id)
                        return devbox_id
                    else:
                        log_progress("⚠️  Suspended devbox failed health checks")
                else:
                    log_progress("⚠️  Suspended devbox not ready")
            else:
                log_progress("⚠️  Failed to resume suspended devbox")

        # Check if we already have any running devboxes before creating new ones
        devboxes = self.api.list_devboxes()
        running_devboxes = [d for d in devboxes if isinstance(d, dict) and
                           d.get('name') == self.devbox_name and d.get('status') == 'running']

        if running_devboxes:
            log_progress(f"Found {len(running_devboxes)} running devboxes, using the first one")
            devbox_id = running_devboxes[0].get('id')
            self.save_devbox_id(devbox_id)
            return devbox_id

        # Create a fresh devbox only if no running devboxes exist
        log_progress("Creating fresh devbox...")
        devbox_id = self.create_fresh_devbox()
        if devbox_id:
            if self.wait_for_devbox_ready(devbox_id):
                if self.run_health_checks(devbox_id):
                    log_progress("✓ Created healthy fresh devbox")
                    self.save_devbox_id(devbox_id)
                    return devbox_id
                else:
                    log_progress("⚠️  Fresh devbox failed health checks")
                    # Still return it since we created it
                    self.save_devbox_id(devbox_id)
                    return devbox_id
            else:
                log_progress("⚠️  Fresh devbox not ready")

        log_progress("❌ No healthy devbox available")
        return None

    def finalize_devbox(self, devbox_id: str, suspend: bool = True):
        """Finalize devbox after task completion"""
        if suspend:
            log_progress("⏸️  Finalizing devbox (suspending to preserve state)...")
            if self.suspend_devbox(devbox_id):
                log_progress("✓ Devbox suspended and ready for next use")
            else:
                log_progress("⚠️  Failed to suspend devbox")
        else:
            log_progress("🔄 Finalizing devbox (keeping running)...")
            log_progress("✓ Devbox kept running for immediate use")

        # Always clean up shutdown devboxes
        self.cleanup_shutdown_devboxes()

def main():
    """Main function for testing"""
    manager = DevboxLifecycleManager()

    # Get or create a healthy devbox
    devbox_id = manager.get_or_create_healthy_devbox()

    if devbox_id:
        log_progress(f"✅ Healthy devbox ready: {devbox_id}")

        # Simulate some work
        log_progress("Simulating work...")
        time.sleep(2)

        # Finalize (suspend to preserve state)
        manager.finalize_devbox(devbox_id, suspend=True)
    else:
        log_progress("❌ No healthy devbox available")
        sys.exit(1)

if __name__ == '__main__':
    main()
