#!/usr/bin/env python3
"""
Deploy Qwen Ollama MCP Server to Runloop devbox
"""

import os
import sys
import time
import requests

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.runloop_api import RunloopAPI
from utils.devbox_lifecycle import DevboxLifecycleManager

def log_progress(message: str):
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")
    sys.stdout.flush()

def main():
    log_progress("🚀 DEPLOYING QWEN OLLAMA MCP SERVER")
    log_progress("=" * 50)

    # Load environment variables
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value

    api = RunloopAPI()
    manager = DevboxLifecycleManager()

    qwen_blueprint_id = os.getenv('QWEN_OLLAMA_BLUEPRINT_ID')
    if not qwen_blueprint_id:
        log_progress("❌ QWEN_OLLAMA_BLUEPRINT_ID not found in .env. Please create the blueprint first.")
        sys.exit(1)

    log_progress(f"Using Qwen Ollama Blueprint: {qwen_blueprint_id}")

    # Get or create a healthy devbox for Qwen from the blueprint
    manager.devbox_name = 'omni-agent-qwen-ollama'
    manager.current_devbox_id = os.getenv('QWEN_OLLAMA_DEVOX_ID')

    devbox_id = manager.get_or_create_healthy_devbox()

    if not devbox_id:
        log_progress("❌ Failed to obtain a healthy devbox for Qwen Ollama.")
        sys.exit(1)

    log_progress(f"✅ Healthy Qwen Ollama devbox ready: {devbox_id}")

    # Save the Qwen devbox ID and URL to .env
    qwen_devbox_url = f"https://{devbox_id}.runloop.dev:8000"
    env_path = '.env'
    with open(env_path, 'r') as f:
        lines = f.readlines()

    updated_devbox_id = False
    updated_devbox_url = False
    for i, line in enumerate(lines):
        if line.startswith('QWEN_OLLAMA_DEVOX_ID='):
            lines[i] = f'QWEN_OLLAMA_DEVOX_ID="{devbox_id}"\n'
            updated_devbox_id = True
        if line.startswith('QWEN_OLLAMA_URL='):
            lines[i] = f'QWEN_OLLAMA_URL="{qwen_devbox_url}"\n'
            updated_devbox_url = True

    if not updated_devbox_id:
        lines.append(f'QWEN_OLLAMA_DEVOX_ID="{devbox_id}"\n')
    if not updated_devbox_url:
        lines.append(f'QWEN_OLLAMA_URL="{qwen_devbox_url}"\n')

    with open(env_path, 'w') as f:
        f.writelines(lines)
    log_progress(f"✓ Qwen Ollama Devbox ID and URL saved to .env: {devbox_id}, {qwen_devbox_url}")

    # Copy the Qwen Ollama server to the devbox
    log_progress("📁 Copying Qwen Ollama server to devbox...")

    # Read the server file
    with open('scripts/qwen_ollama_server.py', 'r') as f:
        server_content = f.read()

    # Write to devbox
    api.execute_command(devbox_id, f'cat > qwen_ollama_server.py << "EOF"\n{server_content}\nEOF', show_output=True)

    # Install additional Python dependencies
    log_progress("📦 Installing additional Python dependencies...")
    api.execute_command(devbox_id, 'pip install --user flask flask-cors requests', show_output=True)

    # Start the Qwen Ollama server on the devbox
    log_progress("🚀 Starting Qwen Ollama MCP server on devbox...")
    api.execute_command(devbox_id, 'nohup python3 qwen_ollama_server.py > qwen_ollama.log 2>&1 &', show_output=True)
    time.sleep(10)  # Give it time to start

    # Test the server
    log_progress("🧪 Testing Qwen Ollama server...")
    test_result = api.execute_command(devbox_id, 'curl -s http://localhost:8000/health', show_output=True)
    if 'ok' in test_result.get('stdout', ''):
        log_progress("✅ Qwen Ollama server is running!")
    else:
        log_progress("⚠️  Qwen Ollama server may not be ready yet")

    log_progress("✓ Qwen Ollama MCP server started!")
    log_progress(f"Qwen Ollama Server URL: {qwen_devbox_url}")

    # Finalize the devbox (suspend to preserve state)
    manager.finalize_devbox(devbox_id, suspend=True)
    log_progress("✅ Qwen Ollama MCP Server deployment complete!")

if __name__ == '__main__':
    main()
