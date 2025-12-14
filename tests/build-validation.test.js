/**
 * Build Validation Test
 * 
 * Validates that the consolidated worker is built correctly
 * and contains all required components.
 */

import { expect } from 'chai';
import fs from 'fs';

describe('Build Validation Tests', () => {
  let consolidatedWorker;
  
  before(() => {
    try {
      consolidatedWorker = fs.readFileSync('./cloudflare-worker/dist/consolidated-worker.js', 'utf-8');
      console.log(`✓ Loaded consolidated worker: ${consolidatedWorker.length} characters`);
    } catch (error) {
      console.error('✗ Failed to load consolidated worker:', error.message);
      throw error;
    }
  });
  
  it('should have minimum size requirement', () => {
    const minSize = 10000; // 10KB minimum
    expect(consolidatedWorker.length).to.be.at.least(minSize, 
      `Consolidated worker should be at least ${minSize} characters`);
  });
  
  it('should contain HTML template', () => {
    expect(consolidatedWorker).to.include('const HTML_TEMPLATE');
    expect(consolidatedWorker).to.include('<!DOCTYPE html>');
    expect(consolidatedWorker).to.include('<html lang="en">');
  });
  
  it('should have proper export structure', () => {
    expect(consolidatedWorker).to.include('export default');
    expect(consolidatedWorker).to.match(/export\s+default\s*\{\s*async\s+fetch/);
  });
  
  it('should have security headers', () => {
    expect(consolidatedWorker).to.include('Content-Security-Policy');
    expect(consolidatedWorker).to.include('X-Content-Type-Options');
    expect(consolidatedWorker).to.include('X-Frame-Options');
    expect(consolidatedWorker).to.include('Strict-Transport-Security');
  });
  
  it('should have API endpoints', () => {
    expect(consolidatedWorker).to.include("pathname === '/health'");
    expect(consolidatedWorker).to.include("pathname === '/api/health'");
    expect(consolidatedWorker).to.include("pathname === '/api/chat'");
    expect(consolidatedWorker).to.include("pathname === '/'");
  });
  
  it('should have CORS support', () => {
    expect(consolidatedWorker).to.include('Access-Control-Allow-Origin');
    expect(consolidatedWorker).to.include('Access-Control-Allow-Methods');
    expect(consolidatedWorker).to.include('Access-Control-Allow-Headers');
  });
  
  it('should handle different HTTP methods', () => {
    expect(consolidatedWorker).to.include("request.method === 'OPTIONS'");
    expect(consolidatedWorker).to.include("request.method === 'POST'");
  });
  
  it('should have error handling', () => {
    expect(consolidatedWorker).to.include('try');
    expect(consolidatedWorker).to.include('catch');
  });
  
  it('should include version information', () => {
    expect(consolidatedWorker).to.include('VERSION_FULL');
    expect(consolidatedWorker).to.include('Electric Eel');
  });
});