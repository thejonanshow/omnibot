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
  
  it('should have minimum size', () => {
    expect(workerCode.length).to.be.at.least(5000, 
      `Code too short (${workerCode.length} chars)`);
  });
  
  it('should include HTML UI', () => {
    expect(workerCode).to.include('const HTML =', 'Missing HTML UI');
    expect(workerCode).to.match(/<html[\s>]/, 'Missing HTML content');
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
