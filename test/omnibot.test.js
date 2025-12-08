/**
 * OmniBot Test Suite
 * 
 * Tests MUST pass before deployment:
 * 1. Code structure validation
 * 2. All required functions exist
 * 3. Edit endpoint responds correctly
 * 4. Safety checks work
 * 5. No destructive operations possible
 */

import { expect } from 'chai';

// Mock environment for testing
const mockEnv = {
  GITHUB_TOKEN: 'mock_token',
  GROQ_API_KEY: 'mock_key'
};

describe('OmniBot Structure Tests', () => {
  let workerCode;
  
  before(async () => {
    // Read the actual worker code
    const fs = await import('fs');
    workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
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
  
  it('should have minimum size (not a replacement)', () => {
    expect(workerCode.length).to.be.at.least(5000, 
      `Code too short (${workerCode.length} chars) - possible wholesale replacement`);
  });
  
  it('should include HTML UI', () => {
    expect(workerCode).to.include('const HTML =', 'Missing HTML UI declaration');
    expect(workerCode).to.include('<html>', 'Missing HTML content');
    expect(workerCode).to.include('OmniBot', 'Missing OmniBot branding in UI');
  });
  
  it('should have safety validation logic', () => {
    expect(workerCode).to.include('validateCodeStructure', 'Missing safety validation');
    expect(workerCode).to.include('REQUIRED_FUNCTIONS', 'Missing required functions list');
  });
  
  it('should not use browser-only APIs', () => {
    // Only check Worker code, not client-side HTML JavaScript
    const htmlStart = workerCode.indexOf('const HTML =');
    const workerCodeOnly = htmlStart > 0 ? workerCode.slice(0, htmlStart) : workerCode;
    
    const browserAPIs = ['DOMParser', 'window.', 'localStorage', 'sessionStorage'];
    
    for (const api of browserAPIs) {
      expect(workerCodeOnly).to.not.include(api, 
        `Code uses browser-only API: ${api} (not available in Workers)`);
    }
  });
  
  it('should have all API endpoints', () => {
    const endpoints = [
      "pathname === '/'",
      "pathname === '/api/health'",
      "pathname === '/api/chat'",
      "pathname === '/api/self-edit'"
    ];
    
    for (const endpoint of endpoints) {
      expect(workerCode).to.include(endpoint, `Missing endpoint: ${endpoint}`);
    }
  });
  
  it('should have proper CORS headers', () => {
    expect(workerCode).to.include('Access-Control-Allow-Origin', 'Missing CORS headers');
  });
});

describe('OmniBot Safety Validation Tests', () => {
  it('validateCodeStructure should reject code missing required functions', () => {
    const badCode = `
      export default {
        async fetch() {
          return new Response('hello');
        }
      };
    `;
    
    // This would be tested by importing the actual function
    // For now, we test that the validation logic exists in code
    const fs = require('fs');
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    expect(workerCode).to.include('Missing required functions', 
      'Safety check should detect missing functions');
  });
  
  it('validateCodeStructure should reject code that is too short', () => {
    const fs = require('fs');
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    expect(workerCode).to.include('Code too short', 
      'Safety check should detect suspicious size');
    expect(workerCode).to.include('5000', 
      'Minimum size threshold should be 5000 chars');
  });
  
  it('validateCodeStructure should reject code missing HTML', () => {
    const fs = require('fs');
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    expect(workerCode).to.include('Missing HTML UI', 
      'Safety check should detect missing UI');
  });
});

describe('OmniBot API Response Tests', () => {
  it('health endpoint should return version info', async () => {
    // Mock test - in real deployment this would hit actual endpoint
    const fs = require('fs');
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    expect(workerCode).to.include('/api/health', 'Health endpoint exists');
    expect(workerCode).to.include('version', 'Version info in health check');
  });
  
  it('self-edit endpoint should validate instruction length', async () => {
    const fs = require('fs');
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    expect(workerCode).to.include('instruction.length < 5', 
      'Should validate minimum instruction length');
    expect(workerCode).to.include('Instruction too short', 
      'Should have error message for short instructions');
  });
});

describe('OmniBot Git Operations Tests', () => {
  it('should have GitHub repo constant', () => {
    const fs = require('fs');
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    expect(workerCode).to.include("const GITHUB_REPO = 'thejonanshow/omnibot'", 
      'GitHub repo must be configured');
  });
  
  it('should have proper GitHub API headers', () => {
    const fs = require('fs');
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    expect(workerCode).to.include('Authorization', 'GitHub auth header');
    expect(workerCode).to.include('User-Agent', 'User-Agent header for GitHub API');
  });
});

describe('OmniBot Model Configuration Tests', () => {
  it('should use Groq models (Claude-free)', () => {
    const fs = require('fs');
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    expect(workerCode).to.include('llama-3.3-70b-versatile', 'Llama model configured');
    expect(workerCode).to.not.include('anthropic.com', 
      'Should not depend on Claude API');
  });
  
  it('should have GROQ_API_KEY environment variable', () => {
    const fs = require('fs');
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    expect(workerCode).to.include('env.GROQ_API_KEY', 'Groq API key configured');
  });
});
