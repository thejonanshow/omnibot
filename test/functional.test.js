/**
 * OmniBot Functional Tests
 * Updated for Dumbo Octopus (LCARS UI)
 */

import { expect } from 'chai';
import fs from 'fs';

describe('OmniBot Functional Tests', () => {
  let workerCode;
  
  before(() => {
    workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
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
    it('should have themed CSS variables', () => {
      expect(workerCode).to.include('--lcars-');
    });
    
    it('should have environment indicator', () => {
      expect(workerCode).to.include('staging');
      expect(workerCode).to.include('production');
    });
    
    it('should have edit mode styling', () => {
      expect(workerCode).to.include('edit-mode');
    });
  });
  
  describe('Error Handling', () => {
    it('should have try-catch in API handlers', () => {
      expect(workerCode).to.include('try {');
      expect(workerCode).to.include('catch (e)');
      expect(workerCode).to.include('error: e.message');
    });
    
    it('should return proper error responses', () => {
      expect(workerCode).to.include('status: 500');
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
    workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
  });
  
  it('should validate code structure before commit', () => {
    expect(workerCode).to.include('validateCodeStructure');
    expect(workerCode).to.include('REQUIRED_FUNCTIONS');
  });
  
  it('should have minimum size check', () => {
    expect(workerCode).to.include('code.length < 5000');
    expect(workerCode).to.include('Code too short');
  });
  
  it('should require HTML UI', () => {
    expect(workerCode).to.include("Missing HTML UI");
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
    expect(workerCode).to.match(/Axolotl|Blobfish|Cuttlefish|Dumbo Octopus/);
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
