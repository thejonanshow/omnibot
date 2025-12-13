/**
 * OmniBot Functional Tests
 * Updated for Electric Eel (OAuth)
 */

import { expect } from 'chai';
import fs from 'fs';

describe('OmniBot Functional Tests', () => {
  let workerCode;
  
  before(() => {
    try {
      workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      console.log(`✓ Loaded worker code for functional tests: ${workerCode.length} characters`);
    } catch (error) {
      console.error('✗ Failed to load worker code:', error.message);
      console.error('  Stack:', error.stack);
      throw error;
    }
  });
  
  describe('API Endpoints', () => {
    it('should have health endpoint returning JSON', () => {
      expect(workerCode).to.include("pathname === '/api/health'");
      expect(workerCode).to.include('ok: true');
      expect(workerCode).to.include('version:');
    });
    
    it('should have chat endpoint accepting POST', () => {
      expect(workerCode).to.include("pathname === '/api/chat'");
      expect(workerCode).to.include("request.method === 'POST'");
      expect(workerCode).to.include('messages');
    });
    
    it('should have self-edit endpoint with validation', () => {
      expect(workerCode).to.include("pathname === '/api/self-edit'");
      expect(workerCode).to.include('instruction.length < 5');
      expect(workerCode).to.include('Instruction too short');
    });
    
    it('should have test endpoint', () => {
      expect(workerCode).to.include("pathname === '/api/test'");
    });
  });
  
  describe('UI', () => {
    it('should have LCARS CSS variables', () => {
      expect(workerCode).to.include('--lcars-orange');
      expect(workerCode).to.include('--lcars-blue');
    });
    
    it('should have edit mode styling', () => {
      expect(workerCode).to.include('edit-mode');
    });
    
    it('should have LCARS structure', () => {
      expect(workerCode).to.include('lcars-frame');
      expect(workerCode).to.include('lcars-sidebar');
    });
    
    it('should have LCARS buttons', () => {
      expect(workerCode).to.include('lcars-btn');
      expect(workerCode).to.include('data-mode="chat"');
    });
    
    it('should have LCARS header', () => {
      expect(workerCode).to.include('lcars-header');
      expect(workerCode).to.include('lcars-title');
    });
  });
  
  describe('OAuth', () => {
    it('should have Google OAuth endpoints', () => {
      expect(workerCode).to.include("/auth/google");
      expect(workerCode).to.include("/auth/callback");
    });
    
    it('should have session management', () => {
      expect(workerCode).to.include('createSessionToken');
      expect(workerCode).to.include('validateSession');
    });
    
    it('should restrict to allowed email', () => {
      expect(workerCode).to.include('ALLOWED_EMAIL');
    });
  });
  
  describe('Error Handling', () => {
    it('should have try-catch in API handlers', () => {
      const checks = [
        { pattern: 'try {', desc: 'try block' },
        { pattern: 'catch (e)', desc: 'catch clause' },
        { pattern: 'error: e.message', desc: 'error message handling' }
      ];
      
      for (const check of checks) {
        if (!workerCode.includes(check.pattern)) {
          console.error(`✗ Missing error handling component: ${check.desc}`);
          console.error(`  Expected pattern: ${check.pattern}`);
        }
        expect(workerCode).to.include(check.pattern, `Missing ${check.desc} in error handling`);
      }
    });
    
    it('should return proper error responses', () => {
      if (!workerCode.includes('status: 500')) {
        console.error('✗ Missing HTTP 500 error response handling');
        console.error('  Expected: status: 500');
      }
      expect(workerCode).to.include('status: 500', 'Missing HTTP 500 error status in responses');
    });
  });
  
  describe('CORS', () => {
    it('should have CORS headers', () => {
      expect(workerCode).to.include('Access-Control-Allow-Origin');
      expect(workerCode).to.include('Access-Control-Allow-Methods');
      expect(workerCode).to.include('Access-Control-Allow-Headers');
    });
    
    it('should handle OPTIONS preflight', () => {
      expect(workerCode).to.include("request.method === 'OPTIONS'");
    });
  });
});

describe('OmniBot Safety Tests', () => {
  let workerCode;
  
  before(() => {
    try {
      workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      console.log(`✓ Loaded worker code for safety tests: ${workerCode.length} characters`);
    } catch (error) {
      console.error('✗ Failed to load worker code:', error.message);
      throw error;
    }
  });
  
  it('should validate code structure before commit', () => {
    const validationChecks = [
      { pattern: 'validateCodeStructure', desc: 'code structure validation function' },
      { pattern: 'REQUIRED_FUNCTIONS', desc: 'required functions list' }
    ];
    
    for (const check of validationChecks) {
      if (!workerCode.includes(check.pattern)) {
        console.error(`✗ Missing safety check: ${check.desc}`);
        console.error(`  Expected pattern: ${check.pattern}`);
      }
      expect(workerCode).to.include(check.pattern, `Missing ${check.desc}`);
    }
  });
  
  it('should have minimum size check', () => {
    const sizeChecks = [
      { pattern: 'code.length < 5000', desc: 'minimum size validation' },
      { pattern: 'Code seems short', desc: 'size warning message' }
    ];
    
    for (const check of sizeChecks) {
      if (!workerCode.includes(check.pattern)) {
        console.error(`✗ Missing code size validation: ${check.desc}`);
        console.error(`  Expected pattern: ${check.pattern}`);
      }
      expect(workerCode).to.include(check.pattern, `Missing ${check.desc} in validation`);
    }
  });
  
  it('should require HTML UI', () => {
    if (!workerCode.includes("const HTML =")) {
      console.error('✗ Missing HTML UI constant in safety validation');
      console.error('  This is critical for preventing broken deployments');
    }
    expect(workerCode).to.include("const HTML =", 'HTML UI constant is required for safety validation');
  });
  
  it('should not use browser APIs in worker runtime', () => {
    const htmlStart = workerCode.indexOf('const HTML =');
    const workerRuntime = workerCode.slice(0, htmlStart);
    
    expect(workerRuntime).to.not.include('DOMParser');
    expect(workerRuntime).to.not.include('window.');
    expect(workerRuntime).to.not.include('document.');
  });
});

describe('OmniBot Version Tests', () => {
  let workerCode;
  
  before(() => {
    workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
  });
  
  it('should have sea creature versioning', () => {
    expect(workerCode).to.match(/Axolotl|Blobfish|Cuttlefish|Dumbo Octopus|Electric Eel/);
  });
  
  it('should have version in health endpoint', () => {
    expect(workerCode).to.include("version:");
  });
});

describe('OmniBot KV Context Tests', () => {
  let workerCode;
  
  before(() => {
    workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
  });
  
  it('should have context functions', () => {
    expect(workerCode).to.include('getContext');
    expect(workerCode).to.include('setContext');
  });
  
  it('should have telemetry logging', () => {
    expect(workerCode).to.include('logTelemetry');
  });
  
  it('should have master prompt support', () => {
    expect(workerCode).to.include('master_prompt');
    expect(workerCode).to.include('DEFAULT_MASTER_PROMPT');
  });
});
