#!/bin/bash
set -e

echo "🚀 STARTING QWEN SERVER"
echo "======================="

# Install Python if not available
if ! command -v python3 &> /dev/null; then
    echo "Installing Python..."
    apt-get update -y
    apt-get install -y python3 python3-pip
fi

# Start the server
echo "Starting Qwen server on port 8000..."
cd /workspace
python3 scripts/simple_qwen_server.py
