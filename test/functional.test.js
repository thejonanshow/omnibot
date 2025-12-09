/**
 * OmniBot Functional Tests
 * 
 * These tests focus on API functionality, not DOM manipulation.
 * Fast, reliable, and not fragile.
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
    
    it('should have logging API', () => {
      expect(workerCode).to.include("pathname === '/api/log'");
      expect(workerCode).to.include("pathname === '/api/logs'");
    });
    
    it('should have test endpoint', () => {
      expect(workerCode).to.include("pathname === '/api/test'");
    });
  });
  
  describe('Themes', () => {
    const themes = ['modern', 'matrix', 'cyberpunk', 'hal', 'tron', 'neuromancer', 'borg', 'dune'];
    
    for (const theme of themes) {
      it('should have ' + theme + ' theme defined', () => {
        expect(workerCode).to.include('body.theme-' + theme);
        expect(workerCode).to.include('data-theme="' + theme + '"');
      });
    }
    
    it('should have theme CSS variables', () => {
      expect(workerCode).to.include('--bg:');
      expect(workerCode).to.include('--text:');
      expect(workerCode).to.include('--accent:');
      expect(workerCode).to.include('--glow:');
    });
    
    it('should save theme to localStorage', () => {
      expect(workerCode).to.include("localStorage.setItem('omnibot-theme'");
      expect(workerCode).to.include("localStorage.getItem('omnibot-theme'");
    });
  });
  
  describe('Edit Mode', () => {
    it('should have inline edit mode (no dialog for mode switch)', () => {
      const htmlPart = workerCode.slice(workerCode.indexOf('const HTML ='));
      // Mode switching should not trigger confirm/prompt dialogs
      expect(htmlPart).to.not.include('window.confirm(');
      expect(htmlPart).to.not.include('window.prompt(');
    });
    
    it('should have edit mode indicator', () => {
      expect(workerCode).to.include('mode-indicator');
      expect(workerCode).to.include('EDIT MODE');
    });
    
    it('should style input differently in edit mode', () => {
      expect(workerCode).to.include('.input-field.edit-mode');
    });
    
    it('should switch modes via tabs', () => {
      expect(workerCode).to.include('data-mode="edit"');
      expect(workerCode).to.include('data-mode="chat"');
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
      expect(workerCode).to.include('status: 400');
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
    expect(workerCode).to.match(/Axolotl|Blobfish|Cuttlefish/);
    expect(workerCode).to.include('Semantic versioning via exotic sea creatures');
  });
  
  it('should have version in health endpoint', () => {
    expect(workerCode).to.include("version:");
    expect(workerCode).to.include("creature:");
  });
});
