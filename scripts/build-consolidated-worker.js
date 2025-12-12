#!/usr/bin/env node
/**
 * Build script to create a consolidated worker with embedded HTML
 * This ensures the worker and UI are always deployed together as a single unit
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_SRC = path.join(__dirname, '../cloudflare-worker/src/index.js');
const FRONTEND_HTML = path.join(__dirname, '../frontend/index.html');
const OUTPUT_FILE = path.join(__dirname, '../cloudflare-worker/src/index.js');

console.log('🔨 Building consolidated worker...');

// Read the files
const workerCode = fs.readFileSync(WORKER_SRC, 'utf8');
const frontendHTML = fs.readFileSync(FRONTEND_HTML, 'utf8');

// Find the HTML constant in the worker
const htmlStartMarker = 'const HTML = `';
const htmlEndMarker = '`;';

const htmlStartIndex = workerCode.indexOf(htmlStartMarker);
if (htmlStartIndex === -1) {
  console.error('❌ Could not find HTML constant in worker code');
  process.exit(1);
}

// Find the end of the HTML constant by looking for the closing backtick and semicolon
let htmlEndIndex = htmlStartIndex + htmlStartMarker.length;

for (let i = htmlEndIndex; i < workerCode.length; i++) {
  if (workerCode[i] === '`' && workerCode[i - 1] !== '\\') {
    // Check if this is the end of the template literal
    if (workerCode.slice(i, i + 2) === '`;') {
      htmlEndIndex = i;
      break;
    }
  }
}

if (htmlEndIndex === htmlStartIndex + htmlStartMarker.length) {
  console.error('❌ Could not find end of HTML constant');
  process.exit(1);
}

// Remove DOCTYPE from frontend HTML as we'll add it in the template literal
let cleanHTML = frontendHTML.trim();
if (cleanHTML.startsWith('<!DOCTYPE html>')) {
  cleanHTML = cleanHTML.replace('<!DOCTYPE html>\n', '');
}

// Escape template literal syntax for embedding in a template literal
// We need to escape backticks and ${ to prevent them from being interpreted
// as template literal syntax when embedded in the worker's template literal
cleanHTML = cleanHTML
  .replace(/\\/g, '\\\\')     // Escape backslashes first (must be first!)
  .replace(/`/g, '\\`')        // Escape backticks  
  .replace(/\$\{/g, '\\$\\{');  // Escape template literal interpolations (both $ and {)

// Build the new worker code
// First, find the comment line before the HTML constant
const beforeHTMLRaw = workerCode.substring(0, htmlStartIndex);
const commentLineMatch = beforeHTMLRaw.match(/\/\/ ={10,} HTML UI ={10,}\n$/);
const beforeHTML = commentLineMatch 
  ? beforeHTMLRaw.substring(0, beforeHTMLRaw.length - commentLineMatch[0].length)
  : beforeHTMLRaw;

const afterHTML = workerCode.substring(htmlEndIndex + htmlEndMarker.length);

const newWorkerCode = beforeHTML +
  '// ============== HTML UI ==============\n' +
  'const HTML = `<!DOCTYPE html>\n' +
  cleanHTML +
  '`;\n' +
  afterHTML;

// Write the output
fs.writeFileSync(OUTPUT_FILE, newWorkerCode, 'utf8');

console.log('✅ Consolidated worker built successfully');
console.log(`   Worker size: ${newWorkerCode.length} bytes`);
console.log(`   HTML size: ${cleanHTML.length} bytes`);
console.log(`   Output: ${OUTPUT_FILE}`);
