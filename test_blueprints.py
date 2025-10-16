#!/usr/bin/env python3
"""
Test suite for Runloop blueprint functionality
"""

import os
import sys
import time
import requests
import json
from typing import Optional, Dict, Any

# Add the scripts directory to the path
sys.path.append('scripts')

# Import the blueprint functions
from deploy_runloop import (
    check_blueprint_status,
    create_blueprint,
    deploy_from_blueprint,
    get_blueprint_id
)

class BlueprintTester:
    def __init__(self):
        # Load environment variables from .env file
        if os.path.exists('.env'):
            with open('.env', 'r') as f:
                for line in f:
                    if line.strip() and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        os.environ[key] = value

        self.api_key = os.getenv('RUNLOOP_API_KEY')
        self.base_url = 'https://api.runloop.ai/v1'
        self.test_results = []

        if not self.api_key:
            raise ValueError("RUNLOOP_API_KEY environment variable not set")

    def log_test(self, test_name: str, success: bool, message: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message
        })

    def test_blueprint_creation(self) -> Optional[str]:
        """Test creating a new blueprint"""
        print("\n🧪 Testing blueprint creation...")

        try:
            blueprint_id = create_blueprint()

            if blueprint_id:
                self.log_test("Blueprint Creation", True, f"Created blueprint: {blueprint_id}")
                return blueprint_id
            else:
                self.log_test("Blueprint Creation", False, "Failed to create blueprint")
                return None

        except Exception as e:
            self.log_test("Blueprint Creation", False, f"Exception: {str(e)}")
            return None

    def test_blueprint_status_check(self, blueprint_id: str) -> bool:
        """Test checking blueprint status"""
        print(f"\n🧪 Testing blueprint status check for {blueprint_id}...")

        try:
            is_ready, blueprint_data = check_blueprint_status(blueprint_id)

            if blueprint_data:
                status = blueprint_data.get('status', 'unknown')
                self.log_test("Blueprint Status Check", True, f"Status: {status}, Ready: {is_ready}")
                return True
            else:
                self.log_test("Blueprint Status Check", False, "No blueprint data returned")
                return False

        except Exception as e:
            self.log_test("Blueprint Status Check", False, f"Exception: {str(e)}")
            return False

    def test_blueprint_deployment(self, blueprint_id: str) -> Optional[str]:
        """Test deploying from a blueprint"""
        print(f"\n🧪 Testing deployment from blueprint {blueprint_id}...")

        try:
            devbox_id = deploy_from_blueprint(blueprint_id)

            if devbox_id:
                self.log_test("Blueprint Deployment", True, f"Deployed devbox: {devbox_id}")
                return devbox_id
            else:
                self.log_test("Blueprint Deployment", False, "Failed to deploy from blueprint")
                return None

        except Exception as e:
            self.log_test("Blueprint Deployment", False, f"Exception: {str(e)}")
            return None

    def test_blueprint_environment_persistence(self) -> bool:
        """Test that blueprint ID is properly saved to .env"""
        print("\n🧪 Testing blueprint environment persistence...")

        try:
            blueprint_id = get_blueprint_id()

            if blueprint_id:
                self.log_test("Environment Persistence", True, f"Blueprint ID found in .env: {blueprint_id}")
                return True
            else:
                self.log_test("Environment Persistence", False, "No blueprint ID found in .env")
                return False

        except Exception as e:
            self.log_test("Environment Persistence", False, f"Exception: {str(e)}")
            return False

    def test_blueprint_api_endpoints(self) -> bool:
        """Test direct API calls to blueprint endpoints"""
        print("\n🧪 Testing blueprint API endpoints...")

        try:
            # Test listing blueprints
            response = requests.get(
                f'{self.base_url}/blueprints',
                headers={'Authorization': f'Bearer {self.api_key}'}
            )

            if response.status_code == 200:
                blueprints = response.json()
                self.log_test("Blueprint API - List", True, f"Found {len(blueprints)} blueprints")

                # Test getting a specific blueprint if any exist
                if blueprints:
                    blueprint_id = blueprints[0].get('id')
                    if blueprint_id:
                        detail_response = requests.get(
                            f'{self.base_url}/blueprints/{blueprint_id}',
                            headers={'Authorization': f'Bearer {self.api_key}'}
                        )

                        if detail_response.status_code == 200:
                            self.log_test("Blueprint API - Detail", True, f"Retrieved blueprint details")
                            return True
                        else:
                            self.log_test("Blueprint API - Detail", False, f"Status: {detail_response.status_code}")
                            return False

                return True
            else:
                self.log_test("Blueprint API - List", False, f"Status: {response.status_code}")
                return False

        except Exception as e:
            self.log_test("Blueprint API Endpoints", False, f"Exception: {str(e)}")
            return False

    def cleanup_test_blueprint(self, blueprint_id: str):
        """Clean up test blueprint (if API supports deletion)"""
        print(f"\n🧹 Cleaning up test blueprint {blueprint_id}...")

        try:
            # Note: Runloop API may not support blueprint deletion
            # This is just a placeholder for future cleanup if needed
            print(f"Note: Blueprint {blueprint_id} will remain in your account")
            self.log_test("Blueprint Cleanup", True, "Cleanup noted (deletion not supported)")

        except Exception as e:
            self.log_test("Blueprint Cleanup", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all blueprint tests"""
        print("🚀 Starting Blueprint Test Suite")
        print("=" * 50)

        # Test 1: Environment persistence
        env_test = self.test_blueprint_environment_persistence()

        # Test 2: API endpoints
        api_test = self.test_blueprint_api_endpoints()

        # Test 3: Create new blueprint
        blueprint_id = self.test_blueprint_creation()

        if blueprint_id:
            # Test 4: Check blueprint status
            status_test = self.test_blueprint_status_check(blueprint_id)

            # Test 5: Deploy from blueprint (only if ready)
            is_ready, _ = check_blueprint_status(blueprint_id)
            if is_ready:
                devbox_id = self.test_blueprint_deployment(blueprint_id)
                if devbox_id:
                    print(f"✓ Test devbox created: {devbox_id}")
            else:
                print("⚠️  Skipping deployment test - blueprint not ready")

            # Test 6: Cleanup
            self.cleanup_test_blueprint(blueprint_id)

        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("📊 BLUEPRINT TEST SUMMARY")
        print("=" * 50)

        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)

        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}: {result['message']}")

        print(f"\n📈 Results: {passed}/{total} tests passed")

        if passed == total:
            print("🎉 All blueprint tests passed!")
        else:
            print("⚠️  Some tests failed - check the output above")

def main():
    """Main test runner"""
    try:
        tester = BlueprintTester()
        tester.run_all_tests()
    except Exception as e:
        print(f"❌ Test suite failed to initialize: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
