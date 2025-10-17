#!/usr/bin/env python3
"""
Simple Health Check Script for Qwen System
Quick health check for monitoring and alerting
"""

import requests
import time
import sys
from datetime import datetime

def check_endpoint(url: str, timeout: int = 10) -> dict:
    """Check if an endpoint is healthy"""
    try:
        start_time = time.time()
        response = requests.get(url, timeout=timeout)
        response_time = (time.time() - start_time) * 1000

        return {
            "url": url,
            "status_code": response.status_code,
            "response_time_ms": response_time,
            "healthy": response.status_code == 200,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "url": url,
            "error": str(e),
            "healthy": False,
            "timestamp": datetime.now().isoformat()
        }

def main():
    """Main health check function"""
    print("🏥 QWEN SYSTEM HEALTH CHECK")
    print("=" * 40)

    # Check endpoints
    endpoints = [
        "https://omnibot-router.jonanscheffler.workers.dev/health",
        "https://omnibot-router.jonanscheffler.workers.dev/status",
        "https://omnibot-router.jonanscheffler.workers.dev/challenge"
    ]

    results = []
    for endpoint in endpoints:
        print(f"Checking {endpoint}...")
        result = check_endpoint(endpoint)
        results.append(result)

        if result["healthy"]:
            print(f"✅ {result['status_code']} - {result['response_time_ms']:.0f}ms")
        else:
            print(f"❌ {result.get('error', result.get('status_code', 'Unknown error'))}")

    # Overall health
    all_healthy = all(r["healthy"] for r in results)

    print("\n" + "=" * 40)
    if all_healthy:
        print("🎉 ALL SYSTEMS HEALTHY")
        sys.exit(0)
    else:
        print("⚠️  SOME SYSTEMS UNHEALTHY")
        sys.exit(1)

if __name__ == '__main__':
    main()
