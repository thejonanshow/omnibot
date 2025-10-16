#!/usr/bin/env python3
"""
Simple Qwen Ollama deployment script
"""

import os
import sys
import time
import requests
import json

# Load environment variables
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

def log_progress(message: str):
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")
    sys.stdout.flush()

class SimpleRunloopAPI:
    def __init__(self):
        self.api_key = os.getenv('RUNLOOP_API_KEY')
        self.base_url = 'https://api.runloop.ai/v1'

    def make_request(self, method, endpoint, data=None):
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

        url = f"{self.base_url}{endpoint}"

        if method == 'GET':
            response = requests.get(url, headers=headers)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")

        return response

    def list_devboxes(self):
        response = self.make_request('GET', '/devboxes')
        if response.status_code == 200:
            return response.json()
        return []

    def get_devbox(self, devbox_id):
        response = self.make_request('GET', f'/devboxes/{devbox_id}')
        if response.status_code == 200:
            return response.json()
        return None

    def create_devbox(self, name, blueprint_id=None):
        data = {'name': name}
        if blueprint_id:
            data['blueprint_id'] = blueprint_id

        response = self.make_request('POST', '/devboxes', data)
        if response.status_code in [200, 201]:
            return response.json().get('id')
        return None

    def execute_command(self, devbox_id, command, show_output=False):
        data = {'command': command}
        response = self.make_request('POST', f'/devboxes/{devbox_id}/execute_sync', data)

        if response.status_code == 200:
            result = response.json()
            if show_output:
                print(f"Command: {command}")
                print(f"STDOUT: {result.get('stdout', '')}")
                print(f"STDERR: {result.get('stderr', '')}")
                print(f"EXIT STATUS: {result.get('exit_status', '')}")
            return result
        return None

def main():
    log_progress("🚀 DEPLOYING QWEN OLLAMA MCP SERVER (SIMPLE)")
    log_progress("=" * 60)

    api = SimpleRunloopAPI()

    qwen_blueprint_id = os.getenv('QWEN_OLLAMA_BLUEPRINT_ID')
    if not qwen_blueprint_id:
        log_progress("❌ QWEN_OLLAMA_BLUEPRINT_ID not found in .env")
        sys.exit(1)

    log_progress(f"Using Qwen Ollama Blueprint: {qwen_blueprint_id}")

    # Create a new devbox from the blueprint
    devbox_name = f'omni-agent-qwen-ollama-{int(time.time())}'
    log_progress(f"Creating devbox: {devbox_name}")

    devbox_id = api.create_devbox(devbox_name, qwen_blueprint_id)
    if not devbox_id:
        log_progress("❌ Failed to create devbox")
        sys.exit(1)

    log_progress(f"✅ Devbox created: {devbox_id}")

    # Wait for devbox to be ready
    log_progress("⏳ Waiting for devbox to be ready...")
    max_wait = 300  # 5 minutes
    wait_time = 0

    while wait_time < max_wait:
        devbox_data = api.get_devbox(devbox_id)
        if devbox_data and devbox_data.get('status') == 'running':
            log_progress("✅ Devbox is running!")
            break

        time.sleep(10)
        wait_time += 10
        log_progress(f"Still waiting... ({wait_time}s)")

    if wait_time >= max_wait:
        log_progress("❌ Devbox failed to become ready")
        sys.exit(1)

    # Copy the Qwen Ollama server to the devbox
    log_progress("📁 Copying Qwen Ollama server to devbox...")

    with open('scripts/qwen_ollama_server.py', 'r') as f:
        server_content = f.read()

    # Write to devbox
    api.execute_command(devbox_id, f'cat > qwen_ollama_server.py << "EOF"\n{server_content}\nEOF', show_output=True)

    # Install additional Python dependencies
    log_progress("📦 Installing additional Python dependencies...")
    api.execute_command(devbox_id, 'pip install --user flask flask-cors requests', show_output=True)

    # Start the Qwen Ollama server
    log_progress("🚀 Starting Qwen Ollama MCP server...")
    api.execute_command(devbox_id, 'nohup python3 qwen_ollama_server.py > qwen_ollama.log 2>&1 &', show_output=True)
    time.sleep(15)  # Give it time to start

    # Test the server
    log_progress("🧪 Testing Qwen Ollama server...")
    test_result = api.execute_command(devbox_id, 'curl -s http://localhost:8000/health', show_output=True)
    if test_result and 'ok' in test_result.get('stdout', ''):
        log_progress("✅ Qwen Ollama server is running!")
    else:
        log_progress("⚠️  Qwen Ollama server may not be ready yet")
        # Check the logs
        api.execute_command(devbox_id, 'tail -20 qwen_ollama.log', show_output=True)

    # Save the devbox ID and URL to .env
    qwen_devbox_url = f"https://{devbox_id}.runloop.dev:8000"
    env_path = '.env'

    with open(env_path, 'r') as f:
        lines = f.readlines()

    # Update or add the new devbox info
    updated = False
    for i, line in enumerate(lines):
        if line.startswith('QWEN_OLLAMA_DEVOX_ID='):
            lines[i] = f'QWEN_OLLAMA_DEVOX_ID="{devbox_id}"\n'
            updated = True
        elif line.startswith('QWEN_OLLAMA_URL='):
            lines[i] = f'QWEN_OLLAMA_URL="{qwen_devbox_url}"\n'

    if not updated:
        lines.append(f'QWEN_OLLAMA_DEVOX_ID="{devbox_id}"\n')
        lines.append(f'QWEN_OLLAMA_URL="{qwen_devbox_url}"\n')

    with open(env_path, 'w') as f:
        f.writelines(lines)

    log_progress(f"✅ Qwen Ollama Devbox ID and URL saved to .env")
    log_progress(f"Devbox ID: {devbox_id}")
    log_progress(f"Server URL: {qwen_devbox_url}")
    log_progress("🎉 Qwen Ollama MCP Server deployment complete!")

if __name__ == '__main__':
    main()
