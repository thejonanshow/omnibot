#!/usr/bin/env python3
"""
Deploy Qwen MCP Swarm to Runloop
Sets up Qwen with MCP servers for the coding swarm
"""

import os
import sys
import time
import requests
import base64
from utils.runloop_api import RunloopAPI

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

def deploy_qwen_swarm():
    """Deploy Qwen MCP swarm to Runloop"""
    log_progress("🚀 DEPLOYING QWEN MCP SWARM")
    log_progress("=" * 50)

    api = RunloopAPI()

    # Get Qwen MCP blueprint ID
    blueprint_id = os.getenv('QWEN_MCP_BLUEPRINT_ID')
    if not blueprint_id:
        log_progress("❌ QWEN_MCP_BLUEPRINT_ID not found in .env")
        log_progress("Please create the Qwen MCP blueprint first")
        return False

    log_progress(f"Using Qwen MCP blueprint: {blueprint_id}")

    # Check if blueprint is ready
    blueprint_data = api.get_blueprint(blueprint_id)
    if not blueprint_data:
        log_progress("❌ Could not get blueprint data")
        return False

    if blueprint_data.get('status') != 'build_complete':
        log_progress(f"⚠️  Blueprint not ready (status: {blueprint_data.get('status')})")
        log_progress("Waiting for blueprint to be ready...")

        # Wait for blueprint to be ready
        max_wait = 300  # 5 minutes
        poll_interval = 10  # 10 seconds

        for i in range(max_wait // poll_interval):
            blueprint_data = api.get_blueprint(blueprint_id)
            if blueprint_data and blueprint_data.get('status') == 'build_complete':
                log_progress("✅ Blueprint is ready!")
                break
            log_progress(f"  Status: {blueprint_data.get('status') if blueprint_data else 'unknown'} (waiting...)")
            time.sleep(poll_interval)
        else:
            log_progress("❌ Blueprint did not become ready within timeout")
            return False

    # Create devbox from blueprint
    log_progress("Creating Qwen MCP devbox from blueprint...")
    devbox_id = api.create_devbox('qwen-mcp-swarm', blueprint_id)

    if not devbox_id:
        log_progress("❌ Failed to create devbox from blueprint")
        return False

    log_progress(f"✅ Devbox created: {devbox_id}")

    # Wait for devbox to be ready
    log_progress("⏳ Waiting for devbox to be ready...")
    max_wait = 180  # 3 minutes
    poll_interval = 5  # 5 seconds

    for i in range(max_wait // poll_interval):
        devbox_data = api.get_devbox(devbox_id)
        if devbox_data:
            status = devbox_data.get('status')
            log_progress(f"  Status: {status}")

            if status == 'running':
                log_progress("✅ Devbox is ready!")
                break
            elif status == 'failed':
                log_progress("❌ Devbox failed to start")
                return False
        else:
            log_progress("  Error checking devbox status")

        time.sleep(poll_interval)
    else:
        log_progress("⚠️  Devbox did not become ready within timeout")
        return False

    # Deploy MCP server and swarm components
    log_progress("📦 Deploying MCP server and swarm components...")

    # Copy MCP server to devbox
    with open('scripts/qwen_mcp_server.py', 'r') as f:
        mcp_content = f.read()

    encoded_content = base64.b64encode(mcp_content.encode()).decode()
    result = api.execute_command(devbox_id, f'echo "{encoded_content}" | base64 -d > qwen_mcp_server.py', show_output=True)

    if result.get('exit_status') != 0:
        log_progress("❌ Failed to copy MCP server")
        return False

    # Copy swarm orchestrator to devbox
    with open('scripts/swarm_orchestrator.py', 'r') as f:
        swarm_content = f.read()

    encoded_content = base64.b64encode(swarm_content.encode()).decode()
    result = api.execute_command(devbox_id, f'echo "{encoded_content}" | base64 -d > swarm_orchestrator.py', show_output=True)

    if result.get('exit_status') != 0:
        log_progress("❌ Failed to copy swarm orchestrator")
        return False

    # Install additional dependencies
    log_progress("Installing additional dependencies...")
    dependencies = [
        "pip install --user mcp-server-stdio",
        "pip install --user qwen-agent",
        "pip install --user transformers[torch]",
        "pip install --user accelerate"
    ]

    for dep in dependencies:
        log_progress(f"Installing: {dep}")
        result = api.execute_command(devbox_id, dep, show_output=True)
        if result.get('exit_status') != 0:
            log_progress(f"⚠️  Warning: {dep} failed")

    # Create startup script
    startup_script = """#!/bin/bash
# Qwen MCP Swarm Startup Script

echo "Starting Qwen MCP Swarm..."

# Start MCP server in background
nohup python3 qwen_mcp_server.py > mcp_server.log 2>&1 &
MCP_PID=$!

# Start swarm orchestrator in background
nohup python3 swarm_orchestrator.py > swarm_orchestrator.log 2>&1 &
SWARM_PID=$!

echo "MCP Server PID: $MCP_PID"
echo "Swarm Orchestrator PID: $SWARM_PID"

# Save PIDs for later
echo $MCP_PID > mcp_server.pid
echo $SWARM_PID > swarm_orchestrator.pid

echo "Qwen MCP Swarm started successfully!"
echo "MCP Server running on stdio"
echo "Swarm Orchestrator ready for projects"
"""

    encoded_script = base64.b64encode(startup_script.encode()).decode()
    result = api.execute_command(devbox_id, f'echo "{encoded_script}" | base64 -d > start_qwen_swarm.sh', show_output=True)

    if result.get('exit_status') == 0:
        result = api.execute_command(devbox_id, 'chmod +x start_qwen_swarm.sh', show_output=True)

    # Test the setup
    log_progress("🧪 Testing Qwen MCP setup...")

    test_commands = [
        ("Python availability", "python3 --version"),
        ("MCP server file", "ls -la qwen_mcp_server.py"),
        ("Swarm orchestrator file", "ls -la swarm_orchestrator.py"),
        ("Qwen agent availability", "python3 -c 'import qwen_agent; print(\"Qwen agent available\")'"),
        ("MCP availability", "python3 -c 'import mcp; print(\"MCP available\")'")
    ]

    passed_tests = 0
    for test_name, command in test_commands:
        log_progress(f"  Testing {test_name}...")
        result = api.execute_command(devbox_id, command, show_output=True)
        if result.get('exit_status') == 0:
            log_progress(f"  ✅ {test_name} passed")
            passed_tests += 1
        else:
            log_progress(f"  ❌ {test_name} failed")

    log_progress(f"Test results: {passed_tests}/{len(test_commands)} passed")

    # Save devbox info
    devbox_url = f"https://{devbox_id}.runloop.dev:8000"

    # Update .env with Qwen devbox info
    env_path = '.env'
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            lines = f.readlines()

        # Update or add Qwen devbox info
        found_devbox_id = False
        found_devbox_url = False

        for i, line in enumerate(lines):
            if line.startswith('QWEN_DEVOX_ID='):
                lines[i] = f'QWEN_DEVOX_ID={devbox_id}\n'
                found_devbox_id = True
            elif line.startswith('QWEN_DEVOX_URL='):
                lines[i] = f'QWEN_DEVOX_URL={devbox_url}\n'
                found_devbox_url = True

        if not found_devbox_id:
            lines.append(f'QWEN_DEVOX_ID={devbox_id}\n')
        if not found_devbox_url:
            lines.append(f'QWEN_DEVOX_URL={devbox_url}\n')

        with open(env_path, 'w') as f:
            f.writelines(lines)

    # Print deployment info
    log_progress("")
    log_progress("✅ QWEN MCP SWARM DEPLOYMENT COMPLETE!")
    log_progress("=" * 50)
    log_progress(f"📍 Devbox ID: {devbox_id}")
    log_progress(f"📍 Devbox URL: {devbox_url}")
    log_progress("")
    log_progress("🎯 Available Components:")
    log_progress("  • Qwen MCP Server (stdio)")
    log_progress("  • Swarm Orchestrator")
    log_progress("  • Multi-agent collaboration system")
    log_progress("  • Enhanced function capabilities")
    log_progress("")
    log_progress("🚀 To start the swarm:")
    log_progress(f"  ssh into devbox and run: ./start_qwen_swarm.sh")
    log_progress("")
    log_progress("📋 Next steps:")
    log_progress("  1. Update Cloudflare Worker to include Qwen in provider rotation")
    log_progress("  2. Test the swarm with a sample project")
    log_progress("  3. Integrate with existing function calling system")

    return True

def main():
    """Main deployment function"""
    try:
        success = deploy_qwen_swarm()
        if success:
            log_progress("🎉 Qwen MCP Swarm deployment successful!")
            sys.exit(0)
        else:
            log_progress("❌ Qwen MCP Swarm deployment failed!")
            sys.exit(1)
    except Exception as e:
        log_progress(f"❌ Deployment error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
