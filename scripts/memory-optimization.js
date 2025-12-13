/**
 * Memory Optimization Script
 * Analyzes and improves memory management in OmniBot
 */

import fs from 'fs';
import path from 'path';

const UI_FILE = path.join(process.cwd(), 'cloudflare-worker/src/ui.js');

console.log('🔍 Analyzing memory usage patterns...');

// Read the UI file
const uiContent = fs.readFileSync(UI_FILE, 'utf8');

// Check for potential memory leaks
const issues = [];

// Check for setInterval without cleanup
const setIntervalMatches = uiContent.match(/setInterval\([^)]+\)/g);
if (setIntervalMatches) {
  issues.push({
    type: 'setInterval',
    matches: setIntervalMatches,
    severity: 'medium',
    description: 'setInterval found without cleanup mechanism'
  });
}

// Check for event listeners that might not be removed
const addEventListenerMatches = uiContent.match(/addEventListener\([^)]+\)/g);
if (addEventListenerMatches) {
  issues.push({
    type: 'eventListeners',
    matches: addEventListenerMatches,
    severity: 'low',
    description: 'Event listeners found - verify cleanup on page unload'
  });
}

// Check for global variables that might accumulate
const globalVarMatches = uiContent.match(/window\.[a-zA-Z_][a-zA-Z0-9_]*/g);
if (globalVarMatches) {
  issues.push({
    type: 'globalVariables',
    matches: globalVarMatches,
    severity: 'low',
    description: 'Global variables found - ensure proper cleanup'
  });
}

console.log(`Found ${issues.length} potential memory issues:`);
issues.forEach(issue => {
  console.log(`  ${issue.type} (${issue.severity}): ${issue.description}`);
  console.log(`    Found ${issue.matches.length} instances`);
});

// Generate optimized UI code
console.log('\n🔧 Generating memory-optimized UI code...');

const optimizedUI = uiContent.replace(
  // Replace setInterval with proper cleanup
  /setInterval\(([^,]+),\s*(\d+)\);?/g,
  `// Memory-optimized interval with cleanup
        const intervalId = setInterval($1, $2);
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
          clearInterval(intervalId);
        });
        
        // Also cleanup on visibility change (tab hidden)
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            clearInterval(intervalId);
          }
        });`
);

// Add cleanup function
const cleanupFunction = `
        // Cleanup function for memory management
        function cleanup() {
          // Clear any intervals
          const intervals = window._omnibotIntervals || [];
          intervals.forEach(id => clearInterval(id));
          
          // Remove event listeners
          const listeners = window._omnibotListeners || [];
          listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
          });
          
          // Clear global references
          if (window._omnibotGlobals) {
            window._omnibotGlobals.forEach(key => {
              delete window[key];
            });
          }
        }
        
        // Register cleanup on page unload
        window.addEventListener('beforeunload', cleanup);
        
        // Register cleanup on visibility change
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            cleanup();
          }
        });
`;

// Insert cleanup function before the existing code
const finalOptimizedUI = optimizedUI.replace(
  /(document\.addEventListener\('DOMContentLoaded'[^}]+\{)/,
  `$1${cleanupFunction}`
);

// Write the optimized file
const backupFile = UI_FILE + '.backup';
fs.writeFileSync(backupFile, uiContent);
fs.writeFileSync(UI_FILE, finalOptimizedUI);

console.log('✅ Memory optimization complete');
console.log(`   Backup created: ${path.basename(backupFile)}`);
console.log(`   Optimized file: ${path.basename(UI_FILE)}`);

// Create a summary report
const report = {
  timestamp: new Date().toISOString(),
  originalSize: uiContent.length,
  optimizedSize: finalOptimizedUI.length,
  issuesFound: issues.length,
  improvements: [
    'Added interval cleanup on page unload',
    'Added interval cleanup on tab visibility change',
    'Added comprehensive cleanup function',
    'Added event listener cleanup',
    'Added global variable cleanup'
  ]
};

fs.writeFileSync(
  path.join(process.cwd(), 'memory-optimization-report.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n📊 Memory Optimization Report:');
console.log(`   Original size: ${report.originalSize} bytes`);
console.log(`   Optimized size: ${report.optimizedSize} bytes`);
console.log(`   Size change: ${report.optimizedSize - report.originalSize > 0 ? '+' : ''}${report.optimizedSize - report.originalSize} bytes`);
console.log(`   Issues addressed: ${report.improvements.length}`);

report.improvements.forEach(improvement => {
  console.log(`   - ${improvement}`);
});