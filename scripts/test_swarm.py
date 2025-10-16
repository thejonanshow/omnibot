#!/usr/bin/env python3
"""
Test the Qwen MCP Swarm functionality
"""

import asyncio
import json
import os
import sys
from swarm_orchestrator import SwarmOrchestrator

# Load environment variables
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

async def test_swarm():
    """Test the swarm orchestrator with a simple project"""
    print("🧪 TESTING QWEN MCP SWARM")
    print("=" * 50)

    # Initialize orchestrator
    orchestrator = SwarmOrchestrator(
        cloudflare_worker_url="https://omni-agent-router.jonanscheffler.workers.dev",
        shared_secret="4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2"
    )

    # Create a simple test project
    print("📋 Creating test project...")
    project_id = await orchestrator.create_project(
        name="Simple Calculator",
        description="A basic calculator web application",
        requirements=[
            "Create a simple calculator with basic operations (+, -, *, /)",
            "Add a clean web interface",
            "Include input validation",
            "Add basic styling with CSS"
        ]
    )

    print(f"✅ Project created: {project_id}")

    # Get initial project status
    status = orchestrator.get_project_status(project_id)
    print(f"📊 Initial status: {json.dumps(status, indent=2)}")

    # Execute the project
    print("\n🚀 Executing project with swarm...")
    result = await orchestrator.execute_project(project_id)

    print(f"\n📈 Execution result:")
    print(json.dumps(result, indent=2))

    # Get final status
    final_status = orchestrator.get_project_status(project_id)
    print(f"\n📊 Final status:")
    print(json.dumps(final_status, indent=2))

    return result

async def test_individual_agents():
    """Test individual agent communication"""
    print("\n🤖 TESTING INDIVIDUAL AGENTS")
    print("=" * 50)

    orchestrator = SwarmOrchestrator(
        cloudflare_worker_url="https://omni-agent-router.jonanscheffler.workers.dev",
        shared_secret="4c87cc9dee7fa8d8f4af8cae53b1116c3dfc070dddeb39ddb12c6274b07db7b2"
    )

    # Test each agent type
    agents_to_test = [
        ("agent_architect", "Design a simple todo app architecture"),
        ("agent_developer_1", "Write a Python function to calculate fibonacci numbers"),
        ("agent_reviewer", "Review this code: def add(a, b): return a + b"),
        ("agent_researcher", "Research best practices for Python error handling")
    ]

    for agent_id, prompt in agents_to_test:
        print(f"\n🧪 Testing {agent_id}...")
        try:
            response = await orchestrator._call_agent(agent_id, prompt)
            print(f"✅ {agent_id} response: {response[:200]}...")
        except Exception as e:
            print(f"❌ {agent_id} failed: {e}")

async def main():
    """Main test function"""
    try:
        # Test individual agents first
        await test_individual_agents()

        # Test full swarm
        result = await test_swarm()

        if result and result.get("status") == "completed":
            print("\n🎉 SWARM TEST SUCCESSFUL!")
            print("The Qwen MCP Swarm is working correctly!")
        else:
            print("\n⚠️  SWARM TEST HAD ISSUES")
            print("Check the logs above for details")

    except Exception as e:
        print(f"\n❌ SWARM TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
