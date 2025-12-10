#!/usr/bin/env node
/**
 * Analyze code complexity and provide recommendations
 * 
 * This script analyzes JavaScript files for:
 * - Function length
 * - Cyclomatic complexity
 * - Nesting depth
 * - Number of parameters
 * 
 * Usage: node scripts/analyze-complexity.js [path]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Complexity thresholds
const THRESHOLDS = {
  functionLength: 150,
  cyclomaticComplexity: 20,
  nestingDepth: 4,
  parameters: 5
};

function analyzeFunctionComplexity(code) {
  const results = [];
  
  // Simple regex-based analysis (basic approach)
  // In production, you'd use a proper AST parser like esprima or acorn
  
  const functionRegex = /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
  let match;
  
  while ((match = functionRegex.exec(code)) !== null) {
    const funcName = match[1] || match[2];
    const startPos = match.index;
    
    // Find function body
    let braceCount = 0;
    let funcStart = code.indexOf('{', startPos);
    if (funcStart === -1) continue;
    
    let funcEnd = funcStart;
    for (let i = funcStart; i < code.length; i++) {
      if (code[i] === '{') braceCount++;
      if (code[i] === '}') braceCount--;
      if (braceCount === 0) {
        funcEnd = i;
        break;
      }
    }
    
    const funcBody = code.slice(funcStart, funcEnd + 1);
    const lines = funcBody.split('\n').filter(line => line.trim() && !line.trim().startsWith('//')).length;
    
    // Count complexity indicators
    const ifCount = (funcBody.match(/\bif\s*\(/g) || []).length;
    const forCount = (funcBody.match(/\bfor\s*\(/g) || []).length;
    const whileCount = (funcBody.match(/\bwhile\s*\(/g) || []).length;
    const switchCount = (funcBody.match(/\bswitch\s*\(/g) || []).length;
    const caseCount = (funcBody.match(/\bcase\s+/g) || []).length;
    const catchCount = (funcBody.match(/\bcatch\s*\(/g) || []).length;
    const ternaryCount = (funcBody.match(/\?[^:]+:/g) || []).length;
    const andOrCount = (funcBody.match(/\&\&|\|\|/g) || []).length;
    
    const complexity = 1 + ifCount + forCount + whileCount + switchCount + caseCount + catchCount + ternaryCount + andOrCount;
    
    // Estimate nesting depth
    let maxDepth = 0;
    let currentDepth = 0;
    for (const char of funcBody) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
      if (char === '}') currentDepth--;
    }
    
    results.push({
      name: funcName,
      lines,
      complexity,
      nestingDepth: maxDepth,
      issues: []
    });
    
    const func = results[results.length - 1];
    if (func.lines > THRESHOLDS.functionLength) {
      func.issues.push(`Function is ${func.lines} lines (threshold: ${THRESHOLDS.functionLength})`);
    }
    if (func.complexity > THRESHOLDS.cyclomaticComplexity) {
      func.issues.push(`Complexity is ${func.complexity} (threshold: ${THRESHOLDS.cyclomaticComplexity})`);
    }
    if (func.nestingDepth > THRESHOLDS.nestingDepth) {
      func.issues.push(`Nesting depth is ${func.nestingDepth} (threshold: ${THRESHOLDS.nestingDepth})`);
    }
  }
  
  return results;
}

function analyzeFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const results = analyzeFunctionComplexity(code);
  
  const issues = results.filter(r => r.issues.length > 0);
  
  if (issues.length > 0) {
    console.log(`\n📄 ${path.relative(process.cwd(), filePath)}`);
    issues.forEach(func => {
      console.log(`  ⚠️  ${func.name}`);
      func.issues.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    });
  }
  
  return { total: results.length, issues: issues.length };
}

function analyzeDirectory(dirPath, stats = { totalFunctions: 0, functionsWithIssues: 0, filesAnalyzed: 0 }) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'coverage', 'dist', '.wrangler'].includes(entry.name)) {
        analyzeDirectory(fullPath, stats);
      }
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const result = analyzeFile(fullPath);
      stats.totalFunctions += result.total;
      stats.functionsWithIssues += result.issues;
      stats.filesAnalyzed++;
    }
  }
  
  return stats;
}

// Main
const targetPath = process.argv[2] || 'cloudflare-worker/src';
const fullPath = path.resolve(process.cwd(), targetPath);

console.log('🔍 Analyzing code complexity...\n');
console.log(`Target: ${targetPath}`);
console.log('='.repeat(60));

if (fs.existsSync(fullPath)) {
  const stat = fs.statSync(fullPath);
  let stats;
  
  if (stat.isDirectory()) {
    stats = analyzeDirectory(fullPath);
  } else {
    stats = { filesAnalyzed: 1, totalFunctions: 0, functionsWithIssues: 0 };
    const result = analyzeFile(fullPath);
    stats.totalFunctions = result.total;
    stats.functionsWithIssues = result.issues;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`  Files analyzed: ${stats.filesAnalyzed}`);
  console.log(`  Total functions: ${stats.totalFunctions}`);
  console.log(`  Functions with issues: ${stats.functionsWithIssues}`);
  
  if (stats.functionsWithIssues > 0) {
    const percentage = ((stats.functionsWithIssues / stats.totalFunctions) * 100).toFixed(1);
    console.log(`  Issue rate: ${percentage}%`);
    console.log('\n💡 Recommendation: Consider refactoring functions with high complexity or length.');
  } else {
    console.log('\n✅ All functions are within acceptable complexity thresholds!');
  }
} else {
  console.error(`Error: Path not found: ${fullPath}`);
  process.exit(1);
}
