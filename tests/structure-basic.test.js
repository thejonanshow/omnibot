/**
 * OmniBot Test Suite
 * 
 * Basic structure tests to ensure code is valid.
 */

import { expect } from 'chai';
import fs from 'fs';

describe('OmniBot Structure Tests', () => {
  let workerCode;
  
  before(async () => {
    try {
      workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      console.log(`✓ Loaded worker code: ${workerCode.length} characters`);
    } catch (error) {
      console.error('✗ Failed to load worker code:', error.message);
      console.error('  Current directory:', process.cwd());
      console.error('  Stack:', error.stack);
      throw error;
    }
  });
  
  it('should have all required functions', () => {
    const requiredFunctions = [
      'async function selfEdit',
      'async function callGroq',
      'async function githubGet',
      'async function githubPut',
      'function validateCodeStructure',
      'export default'
    ];
    
    for (const func of requiredFunctions) {
      expect(workerCode).to.include(func, `Missing critical function: ${func}`);
    }
  });
  
  it('should have minimum size', () => {
    const actualLength = workerCode.length;
    const minLength = 5000;
    if (actualLength < minLength) {
      console.error(`✗ Code size check failed:`);
      console.error(`  Expected: >= ${minLength} chars`);
      console.error(`  Actual: ${actualLength} chars`);
      console.error(`  First 200 chars:`, workerCode.substring(0, 200));
    }
    expect(actualLength).to.be.at.least(minLength, 
      `Code too short (${actualLength} chars, expected >= ${minLength})`);
  });
  
  it('should include HTML UI', () => {
    // Check for HTML constant
    if (!workerCode.includes('const HTML =')) {
      console.error('✗ Missing HTML UI constant');
      console.error('  Searching for: const HTML =');
      console.error('  File size:', workerCode.length);
    }
    expect(workerCode).to.include('const HTML =', 'Missing HTML UI constant declaration');
    
    // Check for actual HTML content
    const htmlMatch = workerCode.match(/<html[\s>]/);
    if (!htmlMatch) {
      console.error('✗ Missing HTML content');
      console.error('  Searching for: <html tag');
      const htmlIndex = workerCode.indexOf('const HTML =');
      if (htmlIndex >= 0) {
        console.error('  Found HTML constant at position:', htmlIndex);
        console.error('  Content after HTML constant (first 500 chars):');
        console.error('  ', workerCode.substring(htmlIndex, htmlIndex + 500));
      }
    }
    expect(workerCode).to.match(/<html[\s>]/, 'Missing HTML content - <html> tag not found in code');
  });
  
  it('should not use browser-only APIs in worker code', () => {
    const htmlStart = workerCode.indexOf('const HTML =');
    const workerCodeOnly = htmlStart > 0 ? workerCode.slice(0, htmlStart) : workerCode;
    
    const browserAPIs = ['DOMParser', 'localStorage', 'sessionStorage'];
    
    for (const api of browserAPIs) {
      expect(workerCodeOnly).to.not.include(api, 
        `Worker code uses browser API: ${api}`);
    }
  });
  
  it('should have API endpoints', () => {
    expect(workerCode).to.include("pathname === '/'");
    expect(workerCode).to.include("pathname === '/api/health'");
    expect(workerCode).to.include("pathname === '/api/chat'");
    expect(workerCode).to.include("pathname === '/api/self-edit'");
  });
  
  it('should have CORS headers', () => {
    expect(workerCode).to.include('Access-Control-Allow-Origin');
  });
});

describe('OmniBot Config Tests', () => {
  let workerCode;
  
  before(() => {
    workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
  });
  
  it('should have GitHub repo', () => {
    expect(workerCode).to.include("const GITHUB_REPO = 'thejonanshow/omnibot'");
  });
  
  it('should use Groq', () => {
    expect(workerCode).to.include('env.GROQ_API_KEY');
  });
});
