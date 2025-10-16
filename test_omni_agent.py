#!/usr/bin/env python3
"""
Comprehensive test suite for Omni-Agent system
"""

import os
import sys
import time
import requests
import json
import subprocess
from typing import Optional, Dict, Any, List

class OmniAgentTester:
    def __init__(self):
        # Load environment variables from .env file
        if os.path.exists('.env'):
            with open('.env', 'r') as f:
                for line in f:
                    if line.strip() and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        os.environ[key] = value

        self.worker_url = os.getenv('WORKER_URL', 'https://omni-agent-router.jonanscheffler.workers.dev')
        self.runloop_url = os.getenv('RUNLOOP_URL', '')
        self.shared_secret = os.getenv('SHARED_SECRET', '')
        self.test_results = []

        # Load URLs from files if not in environment
        if not self.runloop_url and os.path.exists('.runloop_url'):
            with open('.runloop_url', 'r') as f:
                self.runloop_url = f.read().strip()

    def log_test(self, test_name: str, success: bool, message: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message
        })

    def get_auth_headers(self):
        """Get authentication headers for worker requests"""
        import hmac
        import hashlib

        # Get challenge
        challenge_response = requests.get(f"{self.worker_url}/challenge", timeout=10)
        if challenge_response.status_code != 200:
            raise Exception(f"Challenge failed: {challenge_response.status_code}")

        challenge_data = challenge_response.json()
        challenge = challenge_data.get('challenge')
        timestamp = challenge_data.get('timestamp')

        if not challenge or not timestamp:
            raise Exception("Invalid challenge response")

        # Generate signature
        signature = hmac.new(
            self.shared_secret.encode(),
            f"{timestamp}{challenge}".encode(),
            hashlib.sha256
        ).hexdigest()

        return {
            'Content-Type': 'application/json',
            'X-Timestamp': str(timestamp),
            'X-Challenge': challenge,
            'X-Signature': signature
        }

    def test_worker_health(self) -> bool:
        """Test Cloudflare Worker health endpoint"""
        print("\n🧪 Testing Cloudflare Worker health...")

        try:
            response = requests.get(f"{self.worker_url}/health", timeout=10)

            if response.status_code == 200:
                data = response.json()
                self.log_test("Worker Health", True, f"Status: {data.get('status', 'unknown')}")
                return True
            else:
                self.log_test("Worker Health", False, f"Status code: {response.status_code}")
                return False

        except Exception as e:
            self.log_test("Worker Health", False, f"Exception: {str(e)}")
            return False

    def test_runloop_health(self) -> bool:
        """Test Runloop services health via API"""
        print("\n🧪 Testing Runloop services health...")

        try:
            # Test Runloop health through the Runloop API
            from utils.runloop_api import RunloopAPI
            api = RunloopAPI()

            # Get current devbox
            devbox_id = os.getenv('RUNLOOP_DEVOX_ID')
            if not devbox_id:
                self.log_test("Runloop Health", False, "No RUNLOOP_DEVOX_ID configured")
                return False

            # Test basic connectivity
            result = api.execute_command(devbox_id, 'echo "Health check"')

            if result.get('exit_status') == 0:
                self.log_test("Runloop Health", True, f"Devbox {devbox_id} is healthy")
                return True
            else:
                self.log_test("Runloop Health", False, f"Devbox health check failed: {result}")
                return False

        except Exception as e:
            self.log_test("Runloop Health", False, f"Exception: {str(e)}")
            return False

    def test_function_calling_setup(self) -> bool:
        """Test that function calling is properly configured"""
        print("\n🧪 Testing function calling setup...")

        try:
            # Test with a simple message that should trigger function calling
            test_message = "What functions are available to you?"

            response = requests.post(
                f"{self.worker_url}/chat",
                headers=self.get_auth_headers(),
                json={
                    'message': test_message,
                    'sessionId': 'test-session'
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                response_text = data.get('response', '').lower()

                # Check if the response mentions function calling capabilities
                function_indicators = ['function', 'execute', 'browse', 'file', 'command']
                has_functions = any(indicator in response_text for indicator in function_indicators)

                if has_functions:
                    self.log_test("Function Calling Setup", True, "Functions are available")
                    return True
                else:
                    self.log_test("Function Calling Setup", False, "No function indicators in response")
                    return False
            else:
                self.log_test("Function Calling Setup", False, f"Status code: {response.status_code}")
                return False

        except Exception as e:
            self.log_test("Function Calling Setup", False, f"Exception: {str(e)}")
            return False

    def test_command_execution(self) -> bool:
        """Test command execution via function calling"""
        print("\n🧪 Testing command execution...")

        try:
            # Test command execution through function calling
            test_message = "Execute this command: echo 'Hello from Omni-Agent test'"

            response = requests.post(
                f"{self.worker_url}/chat",
                headers=self.get_auth_headers(),
                json={
                    'message': test_message,
                    'sessionId': 'test-command-execution'
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                response_text = data.get('response', '')

                # Check if the response contains the expected output
                if 'Hello from Omni-Agent test' in response_text:
                    self.log_test("Command Execution", True, "Command executed successfully")
                    return True
                else:
                    self.log_test("Command Execution", False, f"Unexpected output: {response_text[:200]}")
                    return False
            else:
                self.log_test("Command Execution", False, f"Status code: {response.status_code}")
                return False

        except Exception as e:
            self.log_test("Command Execution", False, f"Exception: {str(e)}")
            return False

    def test_web_browsing(self) -> bool:
        """Test web browsing capability via function calling"""
        print("\n🧪 Testing web browsing...")

        try:
            # Test web browsing through function calling
            test_message = "Browse to https://httpbin.org/json and tell me what you find"

            response = requests.post(
                f"{self.worker_url}/chat",
                headers=self.get_auth_headers(),
                json={
                    'message': test_message,
                    'sessionId': 'test-web-browsing'
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                response_text = data.get('response', '')

                # Check if the response contains web browsing results
                if 'httpbin' in response_text.lower() or 'json' in response_text.lower():
                    self.log_test("Web Browsing", True, "Successfully browsed to test URL")
                    return True
                else:
                    self.log_test("Web Browsing", False, f"No browsing results: {response_text[:200]}")
                    return False
            else:
                self.log_test("Web Browsing", False, f"Status code: {response.status_code}")
                return False

        except Exception as e:
            self.log_test("Web Browsing", False, f"Exception: {str(e)}")
            return False

    def test_file_operations(self) -> bool:
        """Test file operations via function calling"""
        print("\n🧪 Testing file operations...")

        try:
            # Test file operations through function calling
            test_content = "This is a test file created by Omni-Agent test suite"
            test_message = f"Write this content to a file called test_file.txt: {test_content}"

            write_response = requests.post(
                f"{self.worker_url}/chat",
                headers=self.get_auth_headers(),
                json={
                    'message': test_message,
                    'sessionId': 'test-file-operations'
                },
                timeout=30
            )

            if write_response.status_code != 200:
                self.log_test("File Operations", False, f"Write failed: {write_response.status_code}")
                return False

            # Test read file
            read_message = "Read the content of test_file.txt and tell me what it contains"

            read_response = requests.post(
                f"{self.worker_url}/chat",
                headers=self.get_auth_headers(),
                json={
                    'message': read_message,
                    'sessionId': 'test-file-operations'
                },
                timeout=30
            )

            if read_response.status_code == 200:
                data = read_response.json()
                response_text = data.get('response', '')

                if test_content in response_text:
                    self.log_test("File Operations", True, "Write and read successful")
                    return True
                else:
                    self.log_test("File Operations", False, f"Content mismatch: {response_text[:200]}")
                    return False
            else:
                self.log_test("File Operations", False, f"Read failed: {read_response.status_code}")
                return False

        except Exception as e:
            self.log_test("File Operations", False, f"Exception: {str(e)}")
            return False

    def test_shared_context(self) -> bool:
        """Test shared context storage and retrieval"""
        print("\n🧪 Testing shared context...")

        try:
            # Test saving context
            test_key = f"test_context_{int(time.time())}"
            test_value = "This is test context data"

            save_response = requests.post(
                f"{self.worker_url}/chat",
                headers=self.get_auth_headers(),
                json={
                    'message': f"Save this context: key={test_key}, value={test_value}",
                    'sessionId': 'test-context-session'
                },
                timeout=30
            )

            if save_response.status_code == 200:
                # Test retrieving context
                retrieve_response = requests.post(
                    f"{self.worker_url}/chat",
                    headers=self.get_auth_headers(),
                    json={
                        'message': f"What is the value for key {test_key}?",
                        'sessionId': 'test-context-session'
                    },
                    timeout=30
                )

                if retrieve_response.status_code == 200:
                    data = retrieve_response.json()
                    response_text = data.get('response', '')

                    if test_value in response_text:
                        self.log_test("Shared Context", True, "Context saved and retrieved successfully")
                        return True
                    else:
                        self.log_test("Shared Context", False, "Context not retrieved correctly")
                        return False
                else:
                    self.log_test("Shared Context", False, f"Retrieve failed: {retrieve_response.status_code}")
                    return False
            else:
                self.log_test("Shared Context", False, f"Save failed: {save_response.status_code}")
                return False

        except Exception as e:
            self.log_test("Shared Context", False, f"Exception: {str(e)}")
            return False

    def test_voice_services(self) -> bool:
        """Test voice services (STT/TTS) via function calling"""
        print("\n🧪 Testing voice services...")

        try:
            # Test TTS through function calling
            test_message = "Convert this text to speech: 'Hello, this is a test of the text to speech service.'"

            response = requests.post(
                f"{self.worker_url}/chat",
                headers=self.get_auth_headers(),
                json={
                    'message': test_message,
                    'sessionId': 'test-voice-services'
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                response_text = data.get('response', '')

                # Check if the response indicates TTS was used
                if 'speech' in response_text.lower() or 'audio' in response_text.lower() or 'tts' in response_text.lower():
                    self.log_test("Voice Services", True, "TTS service accessible")
                    return True
                else:
                    self.log_test("Voice Services", False, f"No TTS indication: {response_text[:200]}")
                    return False
            else:
                self.log_test("Voice Services", False, f"TTS failed: {response.status_code}")
                return False

        except Exception as e:
            self.log_test("Voice Services", False, f"Exception: {str(e)}")
            return False

    def test_deployment_scripts(self) -> bool:
        """Test deployment scripts are executable"""
        print("\n🧪 Testing deployment scripts...")

        scripts_to_test = [
            'deploy.sh',
            'rollback.sh',
            'setup.sh'
        ]

        all_passed = True

        for script in scripts_to_test:
            if os.path.exists(script):
                # Check if script is executable
                if os.access(script, os.X_OK):
                    self.log_test(f"Script {script}", True, "Executable")
                else:
                    self.log_test(f"Script {script}", False, "Not executable")
                    all_passed = False
            else:
                self.log_test(f"Script {script}", False, "File not found")
                all_passed = False

        return all_passed

    def run_all_tests(self):
        """Run all Omni-Agent tests"""
        print("🚀 Starting Omni-Agent Test Suite")
        print("=" * 60)

        # Core infrastructure tests
        self.test_worker_health()
        self.test_runloop_health()
        self.test_deployment_scripts()

        # Function calling tests
        self.test_function_calling_setup()

        # Runloop service tests
        self.test_command_execution()
        self.test_web_browsing()
        self.test_file_operations()
        self.test_voice_services()

        # Advanced features
        self.test_shared_context()

        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 OMNI-AGENT TEST SUMMARY")
        print("=" * 60)

        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)

        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}: {result['message']}")

        print(f"\n📈 Results: {passed}/{total} tests passed")

        if passed == total:
            print("🎉 All tests passed! Omni-Agent is fully functional!")
        else:
            print("⚠️  Some tests failed - check the output above")
            print("\n💡 Common issues:")
            print("   - Ensure all services are deployed and running")
            print("   - Check that environment variables are set correctly")
            print("   - Verify Runloop services are accessible")

def main():
    """Main test runner"""
    try:
        tester = OmniAgentTester()
        tester.run_all_tests()
    except Exception as e:
        print(f"❌ Test suite failed to initialize: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
