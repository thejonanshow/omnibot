#!/bin/bash
set -e

echo "🚀 SETTING UP QWEN DEVOX"
echo "========================"
echo ""

# Update system packages
echo "📦 Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Install Python and pip
echo "🐍 Installing Python and pip..."
apt-get install -y python3 python3-pip python3-venv

# Install Node.js (for the main application)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Ollama
echo "🤖 Installing Ollama..."
curl -fsSL https://ollama.ai/install.sh | sh

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install flask flask-cors requests

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Start Ollama service
echo "🚀 Starting Ollama service..."
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is ready!"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

# Pull Qwen model
echo "📥 Pulling Qwen model..."
ollama pull qwen2.5:7b

# Start the Qwen server
echo "🚀 Starting Qwen server..."
cd /workspace
python3 scripts/qwen_ollama_server.py &
QWEN_PID=$!

# Wait for Qwen server to be ready
echo "⏳ Waiting for Qwen server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Qwen server is ready!"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

echo ""
echo "✅ QWEN DEVOX SETUP COMPLETE!"
echo "============================="
echo ""
echo "Services running:"
echo "  - Ollama: http://localhost:11434"
echo "  - Qwen Server: http://localhost:8000"
echo ""
echo "Health check:"
curl -s http://localhost:8000/health || echo "Health check failed"
echo ""

# Keep the script running
echo "🔄 Keeping services running..."
wait
