#!/usr/bin/env python3
"""
Create a fresh devbox and manually set up Qwen - the right way
"""
import os
import sys
import requests
import time
import json

# Load .env
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                try:
                    key, value = line.strip().split('=', 1)
                    if value:
                        os.environ[key] = value
                except:
                    pass

API_KEY = os.getenv('RUNLOOP_API_KEY')
BASE_URL = 'https://api.runloop.ai/v1'

def run_command(devbox_id, command, description="Running command"):
    """Execute command on devbox"""
    print(f"  {description}...")
    response = requests.post(
        f'{BASE_URL}/devboxes/{devbox_id}/execute_sync',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={'command': command},
        timeout=300
    )
    
    if response.ok:
        result = response.json()
        exit_code = result.get('exit_status', result.get('exit_code', 0))
        if exit_code == 0:
            print(f"    ✓ Success")
            if result.get('stdout'):
                print(f"    Output: {result['stdout'][:100]}")
            return True
        else:
            print(f"    ✗ Failed (exit {exit_code})")
            if result.get('stderr'):
                print(f"    Error: {result['stderr'][:200]}")
            return False
    else:
        print(f"    ✗ API Error: {response.status_code}")
        return False

print("=" * 60)
print("MANUAL QWEN SETUP ON RUNLOOP")
print("=" * 60)

# Step 1: Create fresh devbox
print("\n1. Creating fresh devbox...")
response = requests.post(
    f'{BASE_URL}/devboxes',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={'name': 'qwen-manual-setup'}
)

if not response.ok:
    print(f"Failed: {response.text}")
    sys.exit(1)

devbox_id = response.json().get('id')
print(f"✓ Devbox: {devbox_id}")

# Step 2: Wait for running
print("\n2. Waiting for devbox to start...")
for i in range(30):
    response = requests.get(
        f'{BASE_URL}/devboxes/{devbox_id}',
        headers={'Authorization': f'Bearer {API_KEY}'}
    )
    if response.ok:
        status = response.json().get('status')
        if status == 'running':
            print("✓ Running")
            break
        print(f"  Status: {status}")
    time.sleep(2)

# Step 3: Install Ollama
print("\n3. Installing Ollama...")
if not run_command(devbox_id, 
    "curl -fsSL https://ollama.com/install.sh | sh",
    "Installing Ollama"):
    print("Failed to install Ollama")
    sys.exit(1)

# Step 4: Start Ollama in background
print("\n4. Starting Ollama server...")
run_command(devbox_id,
    "nohup ollama serve > /tmp/ollama.log 2>&1 &",
    "Starting Ollama")
time.sleep(5)

# Step 5: Verify Ollama is running
print("\n5. Verifying Ollama...")
if run_command(devbox_id,
    "curl -s http://localhost:11434/api/tags",
    "Checking Ollama"):
    print("✓ Ollama is responding")
else:
    print("⚠️  Ollama might not be ready yet")

# Step 6: Pull Qwen model
print("\n6. Pulling Qwen model (this takes a few minutes)...")
if run_command(devbox_id,
    "ollama pull qwen2.5:7b",
    "Downloading Qwen"):
    print("✓ Qwen model ready")

# Step 7: Create HTTP server
print("\n7. Creating HTTP server...")
server_script = '''cat > /tmp/qwen_server.py << 'EOF'
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok","model":"qwen2.5:7b"}')
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        if self.path == '/qwen/chat':
            length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(length))
            msg = data.get('message', '')
            result = subprocess.run(['ollama', 'run', 'qwen2.5:7b', msg],
                                    capture_output=True, text=True, timeout=60)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            resp = json.dumps({"response": result.stdout.strip()})
            self.wfile.write(resp.encode())
        else:
            self.send_response(404)
            self.end_headers()

HTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
EOF
'''
run_command(devbox_id, server_script, "Creating server script")

# Step 8: Start server in background
print("\n8. Starting HTTP server on port 8000...")
run_command(devbox_id,
    "nohup python3 /tmp/qwen_server.py > /tmp/server.log 2>&1 &",
    "Starting server")

time.sleep(3)

devbox_url = f"https://{devbox_id}.runloop.dev:8000"
print("\n" + "=" * 60)
print(f"✅ Manual setup complete!")
print(f"📍 URL: {devbox_url}")
print(f"\nTest with:")
print(f"  curl {devbox_url}/health")
print(f"\nDevbox ID: {devbox_id}")
print("=" * 60)

# Save URL
with open('.runloop_url', 'w') as f:
    f.write(devbox_url)
print("\n✓ URL saved to .runloop_url")
