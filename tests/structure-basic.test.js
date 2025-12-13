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
      // Load all modular components for the new architecture
      const indexCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const routerCode = fs.readFileSync('./cloudflare-worker/src/router.js', 'utf-8');
      const uiCode = fs.readFileSync('./cloudflare-worker/src/ui.js', 'utf-8');
      const authCode = fs.readFileSync('./cloudflare-worker/src/auth.js', 'utf-8');
      const aiCode = fs.readFileSync('./cloudflare-worker/src/ai.js', 'utf-8');
      const editorCode = fs.readFileSync('./cloudflare-worker/src/editor.js', 'utf-8');
      const githubCode = fs.readFileSync('./cloudflare-worker/src/github.js', 'utf-8');
      
      workerCode = indexCode + routerCode + uiCode + authCode + aiCode + editorCode + githubCode;
      console.log(`✓ Loaded modular worker code: ${workerCode.length} characters`);
    } catch (error) {
      console.error('✗ Failed to load worker code:', error.message);
      console.error('  Current directory:', process.cwd());
      console.error('  Stack:', error.stack);
      throw error;
    }
  });
  
  it('should have all required functions', () => {
    const requiredFunctions = [
      'export async function selfEdit',
      'export async function callAI',
      'async function callGroq',
      'async function githubGet',
      'async function githubPut',
      'export default',
      'handleRequest'
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
    // Check for UI rendering function (new modular approach)
    if (!workerCode.includes('renderUI')) {
      console.error('✗ Missing UI rendering function');
      console.error('  Searching for: renderUI');
      console.error('  File size:', workerCode.length);
    }
    expect(workerCode).to.include('renderUI', 'Missing UI rendering function');
    
    // Check for actual HTML content
    const htmlMatch = workerCode.includes('<html');
    if (!htmlMatch) {
      console.error('✗ Missing HTML content');
      console.error('  Searching for: <html tag');
    }
    expect(workerCode).to.include('<html', 'Missing HTML content - <html> tag not found in code');
  });
  
  it('should not use browser-only APIs in worker code', () => {
    // Check the entire worker code for browser APIs (no need to exclude UI code)
    const browserAPIs = ['DOMParser', 'localStorage', 'sessionStorage'];
    
    for (const api of browserAPIs) {
      expect(workerCode).to.not.include(api, 
        `Worker code uses browser API: ${api}`);
    }
  });
  
  it('should have API endpoints', () => {
    expect(workerCode).to.include("pathname === '/'");
    expect(workerCode).to.include("pathname === '/health'");
    expect(workerCode).to.include("pathname === '/chat'");
    expect(workerCode).to.include("pathname === '/edit'");
    expect(workerCode).to.include("pathname === '/api/context'");
    expect(workerCode).to.include("pathname === '/api/prompt'");
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
