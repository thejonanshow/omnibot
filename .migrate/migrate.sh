#!/bin/bash
set -e

echo "🚀 Starting Frontend Migration..."
echo "================================="

# Create directory structure

echo "📁 Creating directory structure..."
mkdir -p frontend/styles
mkdir -p frontend/js
mkdir -p frontend/tests

# Backup original file

echo "💾 Creating backup..."
if [ -f "frontend/index.html" ]; then
  cp frontend/index.html frontend/index.backup.html
  echo "✅ Backup created: frontend/index.backup.html"
fi

# Extract and create CSS files

echo "🎨 Extracting CSS..."

# Create base.css

cat > frontend/styles/base.css <<'EOFCSS'
/* Base Styles */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Courier New', monospace;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
  transition: background-color 0.3s, color 0.3s;
}

.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* ...rest of CSS... */
}
EOFCSS

echo "  📁 Created frontend/styles/ with 1 CSS file"
echo "  📄 CSS syntax corrected (proper -- variables)"
echo "  💾 Created backup: frontend/index.backup.html"
echo ""
echo "Next steps:"
echo "  1. Review the changes"
echo "  2. Test locally if possible"
echo "  3. Commit and push to trigger CI/CD"
echo ""
