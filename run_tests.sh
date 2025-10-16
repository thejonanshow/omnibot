#!/bin/bash
set -e

echo "🧪 OMNI-AGENT TEST SUITE"
echo "========================"
echo ""

# Source environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is required but not installed"
    exit 1
fi

# Check if requests module is available
if ! python3 -c "import requests" 2>/dev/null; then
    echo "📦 Installing requests module..."
    pip3 install --break-system-packages requests
fi

echo "🔍 Running Blueprint Tests..."
echo "============================="
python3 test_blueprints.py

echo ""
echo "🔍 Running Omni-Agent System Tests..."
echo "====================================="
python3 test_omni_agent.py

echo ""
echo "✅ All test suites completed!"
echo ""
echo "💡 To run individual test suites:"
echo "   python3 test_blueprints.py    # Test blueprint functionality"
echo "   python3 test_omni_agent.py    # Test full system functionality"
