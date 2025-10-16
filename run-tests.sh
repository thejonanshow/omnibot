#!/bin/bash

set -e

echo "🧪 Running Omnibot Test Suite"
echo "=============================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Run tests with coverage
echo "Running unit tests with coverage..."
echo ""

npm run test:coverage

echo ""
echo "=============================="
echo "✅ Test suite complete!"
echo ""
echo "📊 Coverage report generated in ./coverage/"
echo "   Open coverage/index.html to view detailed report"
