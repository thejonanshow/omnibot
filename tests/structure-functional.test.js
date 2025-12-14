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
      // Load all the modular components for testing
      const indexCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const routerCode = fs.readFileSync('./cloudflare-worker/src/router.js', 'utf-8');
      const uiCode = fs.readFileSync('./cloudflare-worker/src/ui.js', 'utf-8');
      const authCode = fs.readFileSync('./cloudflare-worker/src/auth.js', 'utf-8');
      const aiCode = fs.readFileSync('./cloudflare-worker/src/ai.js', 'utf-8');
      const editorCode = fs.readFileSync('./cloudflare-worker/src/editor.js', 'utf-8');
      const githubCode = fs.readFileSync('./cloudflare-worker/src/github.js', 'utf-8');
      const securityCode = fs.readFileSync('./cloudflare-worker/src/security.js', 'utf-8');
      const configCode = fs.readFileSync('./cloudflare-worker/src/config.js', 'utf-8');
      
      workerCode = indexCode + routerCode + uiCode + authCode + aiCode + editorCode + githubCode + securityCode + configCode;
      console.log(`✓ Loaded modular worker code: ${workerCode.length} characters`);
    } catch (error) {
      console.error('✗ Failed to load worker code:', error.message);
      console.error('  Stack:', error.stack);
      throw error;
    }
  });
  
  describe('API Endpoints', () => {
    it('should have health endpoint returning JSON', () => {
      expect(workerCode).to.include("pathname === '/health'");
      expect(workerCode).to.include("status: 'ok'");
      expect(workerCode).to.include('version:');
    });
    
    it('should have chat endpoint accepting POST', () => {
      expect(workerCode).to.include("pathname === '/chat'");
      expect(workerCode).to.include("request.method === 'POST'");
      expect(workerCode).to.include('messages');
    });
    
    it('should have self-edit endpoint with validation', () => {
      expect(workerCode).to.include("pathname === '/edit'");
      expect(workerCode).to.include('validateEditInput');
      expect(workerCode).to.include('Instruction cannot be empty');
    });
    
    it('should have challenge endpoint', () => {
      expect(workerCode).to.include("pathname === '/challenge'");
    });
  });
  
  describe('UI', () => {
    it('should have LCARS CSS variables', () => {
      expect(workerCode).to.include('--lcars-orange');
      expect(workerCode).to.include('--lcars-blue');
    });
    
    it('should have LCARS structure', () => {
      expect(workerCode).to.include('--lcars-orange');
      expect(workerCode).to.include('container');
    });
    
    it('should have LCARS buttons', () => {
      expect(workerCode).to.include('auth-button');
      expect(workerCode).to.include('button');
    });
    
    it('should have LCARS header', () => {
      expect(workerCode).to.include('header');
      expect(workerCode).to.include('title');
    });
  });
  
  describe('OAuth', () => {
    it('should have Google OAuth endpoints', () => {
      expect(workerCode).to.include("/auth/google");
      expect(workerCode).to.include("/auth/callback");
    });
    
    it('should have session management', () => {
      expect(workerCode).to.include('createSessionToken');
      expect(workerCode).to.include('verifySessionToken');
    });
    
    it('should have OAuth state parameter management', () => {
      expect(workerCode).to.include('generateOAuthState');
      expect(workerCode).to.include('validateOAuthState');
      expect(workerCode).to.include('oauth_state:');
    });
    
    it('should restrict to allowed email', () => {
      expect(workerCode).to.include('ALLOWED_EMAIL');
    });
  });
  
  describe('Error Handling', () => {
    it('should have try-catch in API handlers', () => {
      const checks = [
        { pattern: 'try {', desc: 'try block' },
        { pattern: 'catch', desc: 'catch clause' },
        { pattern: 'error.message', desc: 'error message handling' }
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
      // Load modular components for safety tests
      const indexCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const routerCode = fs.readFileSync('./cloudflare-worker/src/router.js', 'utf-8');
      const aiCode = fs.readFileSync('./cloudflare-worker/src/ai.js', 'utf-8');
      const editorCode = fs.readFileSync('./cloudflare-worker/src/editor.js', 'utf-8');
      const githubCode = fs.readFileSync('./cloudflare-worker/src/github.js', 'utf-8');
      
      workerCode = indexCode + routerCode + aiCode + editorCode + githubCode;
      console.log(`✓ Loaded modular worker code for safety tests: ${workerCode.length} characters`);
    } catch (error) {
      console.error('✗ Failed to load worker code:', error.message);
      throw error;
    }
  });
  
  it('should validate code structure before commit', () => {
    const validationChecks = [
      { pattern: 'validateEditInput', desc: 'input validation function' },
      { pattern: 'validateGeneratedCode', desc: 'code generation validation' }
    ];
    
    for (const check of validationChecks) {
      if (!workerCode.includes(check.pattern)) {
        console.error(`✗ Missing safety check: ${check.desc}`);
        console.error(`  Expected pattern: ${check.pattern}`);
      }
      expect(workerCode).to.include(check.pattern, `Missing ${check.desc}`);
    }
  });
  
  it('should have security validation checks', () => {
    const securityChecks = [
      { pattern: 'validateOAuthState', desc: 'OAuth state validation' },
      { pattern: 'RateLimiter', desc: 'rate limiting functionality' }
    ];
    
    for (const check of securityChecks) {
      if (!workerCode.includes(check.pattern)) {
        console.error(`✗ Missing security check: ${check.desc}`);
        console.error(`  Expected pattern: ${check.pattern}`);
      }
      expect(workerCode).to.include(check.pattern, `Missing ${check.desc} in validation`);
    }
  });
  
  it('should require HTML UI', () => {
    if (!workerCode.includes("renderUI")) {
      console.error('✗ Missing HTML UI rendering function in safety validation');
      console.error('  This is critical for preventing broken deployments');
    }
    expect(workerCode).to.include("renderUI", 'HTML UI rendering function is required for safety validation');
  });
  
  it('should not use browser APIs in worker runtime', () => {
    // Extract worker code before HTML template to avoid false positives
    const htmlStart = workerCode.indexOf('const HTML =');
    const workerCodeOnly = htmlStart > -1 ? workerCode.substring(0, htmlStart) : workerCode;
    
    // Check worker code (excluding HTML template) for browser APIs
    expect(workerCodeOnly).to.not.include('DOMParser');
    expect(workerCodeOnly).to.not.include('window.');
    expect(workerCodeOnly).to.not.include('document.');
  });
});

describe('OmniBot Version Tests', () => {
  let workerCode;
  
  before(() => {
    // Load config and router for version info
    const configCode = fs.readFileSync('./cloudflare-worker/src/config.js', 'utf-8');
    const routerCode = fs.readFileSync('./cloudflare-worker/src/router.js', 'utf-8');
    workerCode = configCode + routerCode;
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
    // Load all relevant modules for context testing
    const contextCode = fs.readFileSync('./cloudflare-worker/src/context.js', 'utf-8');
    const telemetryCode = fs.readFileSync('./cloudflare-worker/src/telemetry.js', 'utf-8');
    const configCode = fs.readFileSync('./cloudflare-worker/src/config.js', 'utf-8');
    const aiCode = fs.readFileSync('./cloudflare-worker/src/ai.js', 'utf-8');
    workerCode = contextCode + telemetryCode + configCode + aiCode;
  });
  
  it('should have context functions', () => {
    expect(workerCode).to.include('getSharedContext');
    expect(workerCode).to.include('saveContext');
  });
  
  it('should have telemetry logging', () => {
    expect(workerCode).to.include('logTelemetry');
  });
  
  it('should have master prompt support', () => {
    expect(workerCode).to.include('DEFAULT_MASTER_PROMPT');
  });
});
