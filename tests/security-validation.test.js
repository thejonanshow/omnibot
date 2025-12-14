/**
 * Security Validation Tests
 * 
 * Validates that security features are properly implemented
 * and protect against common vulnerabilities.
 */

import { expect } from 'chai';
import fs from 'fs';

describe('Security Validation Tests', () => {
  let consolidatedWorker;
  let routerCode;
  let securityCode;
  
  before(() => {
    try {
      consolidatedWorker = fs.readFileSync('./cloudflare-worker/dist/consolidated-worker.js', 'utf-8');
      routerCode = fs.readFileSync('./cloudflare-worker/src/router.js', 'utf-8');
      securityCode = fs.readFileSync('./cloudflare-worker/src/security.js', 'utf-8');
      console.log('✓ Loaded security modules for validation');
    } catch (error) {
      console.error('✗ Failed to load security modules:', error.message);
      throw error;
    }
  });
  
  it('should have comprehensive security headers', () => {
    // Check router for security headers
    expect(routerCode).to.include('X-Content-Type-Options');
    expect(routerCode).to.include('X-Frame-Options');
    expect(routerCode).to.include('X-XSS-Protection');
    expect(routerCode).to.include('Referrer-Policy');
    expect(routerCode).to.include('Strict-Transport-Security');
    
    // Check consolidated worker
    expect(consolidatedWorker).to.include('X-Content-Type-Options');
    expect(consolidatedWorker).to.include('X-Frame-Options');
    expect(consolidatedWorker).to.include('Strict-Transport-Security');
  });
  
  it('should have HSTS with proper configuration', () => {
    expect(routerCode).to.include('max-age=31536000');
    expect(routerCode).to.include('includeSubDomains');
    expect(consolidatedWorker).to.include('max-age=31536000');
    expect(consolidatedWorker).to.include('includeSubDomains');
  });
  
  it('should have Content Security Policy', () => {
    expect(consolidatedWorker).to.include('Content-Security-Policy');
    expect(consolidatedWorker).to.include("default-src 'self'");
    expect(consolidatedWorker).to.include("script-src");
    expect(consolidatedWorker).to.include("style-src");
  });
  
  it('should protect against clickjacking', () => {
    expect(consolidatedWorker).to.include("'X-Frame-Options': 'DENY'");
    expect(consolidatedWorker).to.include('X-Frame-Options: DENY');
  });
  
  it('should prevent MIME type sniffing', () => {
    expect(consolidatedWorker).to.include("'X-Content-Type-Options': 'nosniff'");
    expect(consolidatedWorker).to.include('X-Content-Type-Options: nosniff');
  });
  
  it('should have XSS protection headers', () => {
    expect(consolidatedWorker).to.include("'X-XSS-Protection': '1; mode=block'");
    expect(consolidatedWorker).to.include('X-XSS-Protection: 1; mode=block');
  });
  
  it('should have referrer policy', () => {
    expect(consolidatedWorker).to.include("'Referrer-Policy': 'strict-origin-when-cross-origin'");
  });
  
  it('should validate input for malicious patterns', () => {
    expect(securityCode).to.include('MALICIOUS_PATTERNS');
    expect(securityCode).to.include('eval');
    expect(securityCode).to.include('Function');
    expect(securityCode).to.include('require');
  });
  
  it('should detect dangerous code patterns', () => {
    expect(securityCode).to.include('DANGEROUS_PATTERNS');
    expect(securityCode).to.include('process\\.exit');
    expect(securityCode).to.include('fs\\.unlink');
    expect(securityCode).to.include('fs\\.rmdir');
  });
  
  it('should prevent infinite loops', () => {
    expect(securityCode).to.include('INFINITE_LOOP_PATTERNS');
    expect(securityCode).to.include('while\\s*\\(\\s*true\\s*\\)');
    expect(securityCode).to.include('for\\s*\\(\\s*;\\s*;\\s*\\)');
  });
  
  it('should detect leaked secrets', () => {
    expect(securityCode).to.include('SECRET_PATTERNS');
    expect(securityCode).to.include('sk-'); // OpenAI API key pattern
    expect(securityCode).to.include('AIza'); // Google API key pattern
  });
  
  it('should have CORS protection', () => {
    expect(routerCode).to.include('Access-Control-Allow-Origin');
    expect(routerCode).to.include('Access-Control-Allow-Methods');
    expect(routerCode).to.include('Access-Control-Allow-Headers');
  });
  
  it('should handle OPTIONS requests properly', () => {
    expect(routerCode).to.include("request.method === 'OPTIONS'");
    expect(consolidatedWorker).to.include("request.method === 'OPTIONS'");
  });
  
  it('should have error handling for security failures', () => {
    expect(securityCode).to.include('try');
    expect(securityCode).to.include('catch');
    expect(routerCode).to.include('try');
    expect(routerCode).to.include('catch');
  });
  
  it('should sanitize error messages', () => {
    // Check that error messages don't leak sensitive information
    expect(securityCode).to.not.include('env.GITHUB_TOKEN');
    expect(securityCode).to.not.include('env.SESSION_SECRET');
  });
});