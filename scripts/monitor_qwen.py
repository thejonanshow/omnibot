#!/usr/bin/env python3
"""
Qwen Monitoring and Observability Script
Monitors Qwen performance, usage, and health in production
"""

import os
import sys
import time
import json
import requests
import hmac
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

class QwenMonitor:
    """Monitors Qwen performance and health"""

    def __init__(self, worker_url: str, shared_secret: str):
        self.worker_url = worker_url
        self.shared_secret = shared_secret
        self.metrics = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "qwen_requests": 0,
            "fallback_requests": 0,
            "response_times": [],
            "error_types": {},
            "provider_usage": {},
            "start_time": datetime.now()
        }

    def log(self, message: str, level: str = "INFO"):
        """Log with timestamp and level"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def get_challenge(self) -> Optional[str]:
        """Get authentication challenge"""
        try:
            response = requests.get(f"{self.worker_url}/challenge", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get('challenge')
            else:
                self.log(f"Failed to get challenge: {response.status_code}", "ERROR")
                return None
        except Exception as e:
            self.log(f"Error getting challenge: {e}", "ERROR")
            return None

    def send_test_request(self, message: str, is_code_request: bool = True) -> Dict[str, Any]:
        """Send a test request to the worker"""
        challenge = self.get_challenge()
        if not challenge:
            return {"error": "Failed to get challenge"}

        # Generate signature
        payload = {
            "message": message,
            "conversation": [],
            "sessionId": f"monitor-{int(time.time())}"
        }
        payload_str = json.dumps(payload)
        signature = hmac.new(
            self.shared_secret.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-Challenge": challenge,
            "X-Signature": signature,
            "X-Timestamp": str(int(time.time() * 1000))
        }

        start_time = time.time()
        try:
            response = requests.post(f"{self.worker_url}/chat", headers=headers, json=payload, timeout=30)
            response_time = (time.time() - start_time) * 1000  # Convert to milliseconds

            result = {
                "status_code": response.status_code,
                "response_time_ms": response_time,
                "timestamp": datetime.now().isoformat(),
                "is_code_request": is_code_request
            }

            if response.status_code == 200:
                data = response.json()
                result.update({
                    "success": True,
                    "used_providers": data.get("usedProviders", []),
                    "is_code_request": data.get("isCodeRequest", False),
                    "response_length": len(data.get("response", "")),
                    "error": data.get("error", False)
                })
            else:
                result.update({
                    "success": False,
                    "error": response.text
                })

            return result

        except Exception as e:
            return {
                "error": str(e),
                "response_time_ms": (time.time() - start_time) * 1000,
                "success": False
            }

    def test_qwen_routing(self) -> Dict[str, Any]:
        """Test Qwen routing with coding requests"""
        self.log("Testing Qwen routing...")

        test_cases = [
            "Write a Python function to calculate fibonacci numbers",
            "Create a JavaScript class for handling API requests",
            "Implement a sorting algorithm in C++",
            "Build a React component for user authentication"
        ]

        results = []
        for test_case in test_cases:
            self.log(f"Testing: {test_case[:50]}...")
            result = self.send_test_request(test_case, is_code_request=True)
            results.append(result)
            time.sleep(1)  # Rate limiting

        return {
            "test_type": "qwen_routing",
            "test_cases": len(test_cases),
            "results": results,
            "summary": self._analyze_results(results)
        }

    def test_fallback_routing(self) -> Dict[str, Any]:
        """Test fallback routing with general requests"""
        self.log("Testing fallback routing...")

        test_cases = [
            "What is the weather like today?",
            "Explain quantum computing in simple terms",
            "Tell me a joke",
            "What are the benefits of exercise?"
        ]

        results = []
        for test_case in test_cases:
            self.log(f"Testing: {test_case[:50]}...")
            result = self.send_test_request(test_case, is_code_request=False)
            results.append(result)
            time.sleep(1)  # Rate limiting

        return {
            "test_type": "fallback_routing",
            "test_cases": len(test_cases),
            "results": results,
            "summary": self._analyze_results(results)
        }

    def _analyze_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze test results"""
        total = len(results)
        successful = sum(1 for r in results if r.get("success", False))
        failed = total - successful

        response_times = [r.get("response_time_ms", 0) for r in results if r.get("response_time_ms")]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0

        provider_usage = {}
        for result in results:
            providers = result.get("used_providers", [])
            for provider in providers:
                provider_usage[provider] = provider_usage.get(provider, 0) + 1

        return {
            "total_requests": total,
            "successful_requests": successful,
            "failed_requests": failed,
            "success_rate": (successful / total * 100) if total > 0 else 0,
            "average_response_time_ms": avg_response_time,
            "provider_usage": provider_usage
        }

    def check_worker_health(self) -> Dict[str, Any]:
        """Check worker health endpoints"""
        self.log("Checking worker health...")

        health_checks = {
            "health": f"{self.worker_url}/health",
            "status": f"{self.worker_url}/status",
            "challenge": f"{self.worker_url}/challenge"
        }

        results = {}
        for name, url in health_checks.items():
            try:
                start_time = time.time()
                response = requests.get(url, timeout=10)
                response_time = (time.time() - start_time) * 1000

                results[name] = {
                    "status_code": response.status_code,
                    "response_time_ms": response_time,
                    "healthy": response.status_code == 200,
                    "timestamp": datetime.now().isoformat()
                }

                if response.status_code == 200:
                    try:
                        data = response.json()
                        results[name]["data"] = data
                    except:
                        results[name]["data"] = response.text

            except Exception as e:
                results[name] = {
                    "error": str(e),
                    "healthy": False,
                    "timestamp": datetime.now().isoformat()
                }

        return {
            "test_type": "health_check",
            "results": results,
            "overall_health": all(r.get("healthy", False) for r in results.values())
        }

    def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive monitoring test"""
        self.log("🚀 Starting comprehensive Qwen monitoring test")
        self.log("=" * 60)

        start_time = datetime.now()

        # Health checks
        health_results = self.check_worker_health()

        # Qwen routing tests
        qwen_results = self.test_qwen_routing()

        # Fallback routing tests
        fallback_results = self.test_fallback_routing()

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        # Compile comprehensive report
        report = {
            "test_run": {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration_seconds": duration
            },
            "health_check": health_results,
            "qwen_routing": qwen_results,
            "fallback_routing": fallback_results,
            "overall_summary": {
                "worker_healthy": health_results["overall_health"],
                "qwen_routing_working": qwen_results["summary"]["success_rate"] > 0,
                "fallback_routing_working": fallback_results["summary"]["success_rate"] > 0,
                "total_tests": qwen_results["test_cases"] + fallback_results["test_cases"],
                "total_successful": qwen_results["summary"]["successful_requests"] + fallback_results["summary"]["successful_requests"]
            }
        }

        return report

    def save_report(self, report: Dict[str, Any], filename: str = None):
        """Save monitoring report to file"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"qwen_monitoring_report_{timestamp}.json"

        try:
            with open(filename, "w") as f:
                json.dump(report, f, indent=2)
            self.log(f"Report saved to {filename}")
        except Exception as e:
            self.log(f"Failed to save report: {e}", "ERROR")

    def print_summary(self, report: Dict[str, Any]):
        """Print monitoring summary"""
        summary = report["overall_summary"]

        self.log("📊 MONITORING SUMMARY")
        self.log("=" * 40)
        self.log(f"Worker Health: {'✅ Healthy' if summary['worker_healthy'] else '❌ Unhealthy'}")
        self.log(f"Qwen Routing: {'✅ Working' if summary['qwen_routing_working'] else '❌ Not Working'}")
        self.log(f"Fallback Routing: {'✅ Working' if summary['fallback_routing_working'] else '❌ Not Working'}")
        self.log(f"Total Tests: {summary['total_tests']}")
        self.log(f"Successful: {summary['total_successful']}")

        # Qwen routing details
        qwen_summary = report["qwen_routing"]["summary"]
        self.log(f"Qwen Success Rate: {qwen_summary['success_rate']:.1f}%")
        self.log(f"Avg Response Time: {qwen_summary['average_response_time_ms']:.0f}ms")

        # Provider usage
        if qwen_summary["provider_usage"]:
            self.log("Provider Usage:")
            for provider, count in qwen_summary["provider_usage"].items():
                self.log(f"  {provider}: {count} requests")

def main():
    """Main function"""
    print("🔍 QWEN MONITORING & OBSERVABILITY")
    print("=" * 50)

    # Configuration
    worker_url = "https://omnibot-router.jonanscheffler.workers.dev"
    shared_secret = "aUfueJNRAGEzKPUKIZidpGvO1KrPvZuccmHYPbdGfLXDXsTyudEytXqs90cfScnC"

    try:
        monitor = QwenMonitor(worker_url, shared_secret)
        report = monitor.run_comprehensive_test()

        monitor.print_summary(report)
        monitor.save_report(report)

        # Determine overall status
        if report["overall_summary"]["worker_healthy"] and report["overall_summary"]["qwen_routing_working"]:
            print("\n🎉 QWEN SYSTEM IS HEALTHY!")
            sys.exit(0)
        else:
            print("\n⚠️  QWEN SYSTEM HAS ISSUES")
            sys.exit(1)

    except Exception as e:
        print(f"\n💥 MONITORING FAILED: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
