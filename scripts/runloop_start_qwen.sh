#!/bin/bash
set -e

echo "🚀 STARTING QWEN ON RUNLOOP"
echo "==========================="

# Install Ollama if not already installed
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    echo "✓ Ollama installed"
else
    echo "✓ Ollama already installed"
fi

# Start Ollama server in background
echo "🔄 Starting Ollama server..."
nohup ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!
echo "✓ Ollama server started (PID: $OLLAMA_PID)"

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✓ Ollama is ready"
        break
    fi
    echo "   Waiting... ($i/30)"
    sleep 2
done

# Pull Qwen model (use smaller 7b for Runloop)
echo "📥 Pulling Qwen model..."
ollama pull qwen2.5:7b
echo "✓ Qwen model ready"

# Create and start the HTTP server
echo "🌐 Starting HTTP server on port 8000..."

cat > /tmp/qwen_server.py << 'PYEOF'
#!/usr/bin/env python3
"""
Qwen HTTP Server - Proxies to local Ollama
"""
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import sys

class QwenHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "qwen-runloop",
                "model": "qwen2.5:7b"
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/qwen/chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                message = data.get('message', '')
                
                # Call Ollama CLI
                result = subprocess.run(
                    ['ollama', 'run', 'qwen2.5:7b', message],
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                if result.returncode == 0:
                    response = {
                        "response": result.stdout.strip(),
                        "model": "qwen2.5:7b",
                        "status": "success"
                    }
                    self.send_response(200)
                else:
                    response = {
                        "error": result.stderr,
                        "status": "error"
                    }
                    self.send_response(500)
                
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = {
                    "error": str(e),
                    "status": "error"
                }
                self.wfile.write(json.dumps(error_response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        sys.stdout.write(f"{self.address_string()} - {format % args}\n")

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8000), QwenHandler)
    print("✅ Qwen server ready on port 8000")
    print("   Health: http://0.0.0.0:8000/health")
    print("   Chat: http://0.0.0.0:8000/qwen/chat")
    server.serve_forever()
PYEOF

python3 /tmp/qwen_server.py
