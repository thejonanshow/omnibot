/**
 * Unit tests for OAuth flow with state parameter validation
 * Tests the Google OAuth integration including state management and redirect loop prevention
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

// Load the worker code
const workerCode = readFileSync('./cloudflare-worker/src/index.js', 'utf8');

// Extract the worker module
const workerModule = await import('../cloudflare-worker/src/index.js');
const router = workerModule.default;

describe('OAuth Flow', () => {
  describe('State Parameter Management', () => {
    it('should include state parameter functions', () => {
      assert.ok(workerCode.includes('generateOAuthState'), 'Should have generateOAuthState function');
      assert.ok(workerCode.includes('validateOAuthState'), 'Should have validateOAuthState function');
    });

    it('should generate OAuth state and store in KV', () => {
      assert.ok(workerCode.includes('oauth_state_'), 'Should use oauth_state_ prefix for KV keys');
      assert.ok(workerCode.includes('expirationTtl: 300'), 'Should have 5-minute TTL for state');
    });

    it('should include state in auth URL', () => {
      assert.ok(workerCode.includes('state: state'), 'Should include state parameter in auth URL');
    });

    it('should validate state in callback', () => {
      // Find the callback route handler (not in HTML)
      const routeHandlerStart = workerCode.lastIndexOf("if (url.pathname === '/auth/callback')");
      const callbackSection = workerCode.substring(
        routeHandlerStart,
        routeHandlerStart + 1000
      );
      assert.ok(callbackSection.includes('validateOAuthState'), 'Should validate state in callback');
      assert.ok(callbackSection.includes('Invalid state parameter'), 'Should have error message for invalid state');
    });
  });

  describe('OAuth Endpoints', () => {
    it('should have /auth/google endpoint with state generation', async () => {
      const mockEnv = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-secret',
        SESSION_SECRET: 'test-session-secret',
        CONTEXT: {
          data: {},
          async put(key, value, options) {
            this.data[key] = { value, options };
          },
          async get(key) {
            return this.data[key]?.value;
          },
          async delete(key) {
            delete this.data[key];
          }
        }
      };

      const request = new Request('https://test.workers.dev/auth/google', {
        method: 'GET'
      });

      const response = await router.fetch(request, mockEnv);
      
      assert.equal(response.status, 302, 'Should redirect');
      const location = response.headers.get('Location');
      assert.ok(location, 'Should have Location header');
<<<<<<< HEAD
      const parsedUrl = new URL(location);
      assert.equal(parsedUrl.hostname, 'accounts.google.com', 'Should redirect to Google');
=======
      assert.ok(location.includes('accounts.google.com'), 'Should redirect to Google');
>>>>>>> aabdce7 (Add OAuth state parameter validation and redirect loop prevention)
      assert.ok(location.includes('state='), 'Should include state parameter');
    });

    it('should reject callback without state parameter', async () => {
      const mockEnv = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-secret',
        SESSION_SECRET: 'test-session-secret',
        CONTEXT: {
          data: {},
          async get() { return null; },
          async delete() {}
        }
      };

      const request = new Request('https://test.workers.dev/auth/callback?code=test-code', {
        method: 'GET'
      });

      const response = await router.fetch(request, mockEnv);
      
      assert.equal(response.status, 400, 'Should reject with 400');
      const text = await response.text();
      assert.ok(text.includes('Invalid state parameter'), 'Should have error message');
    });

    it('should reject callback with invalid state', async () => {
      const mockEnv = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-secret',
        SESSION_SECRET: 'test-session-secret',
        CONTEXT: {
          data: {},
          async get() { return null; }, // State not found in KV
          async delete() {}
        }
      };

      const request = new Request('https://test.workers.dev/auth/callback?code=test-code&state=invalid-state', {
        method: 'GET'
      });

      const response = await router.fetch(request, mockEnv);
      
      assert.equal(response.status, 400, 'Should reject with 400');
      const text = await response.text();
      assert.ok(text.includes('Invalid state parameter'), 'Should have error message');
    });
<<<<<<< HEAD

    it('should reject callback when KV is unavailable (no CSRF protection)', async () => {
      const mockEnv = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-secret',
        SESSION_SECRET: 'test-session-secret',
        CONTEXT: null // KV unavailable - degraded mode
      };

      const request = new Request('https://test.workers.dev/auth/callback?code=test-code&state=some-state', {
        method: 'GET'
      });

      const response = await router.fetch(request, mockEnv);
      
      assert.equal(response.status, 400, 'Should reject when KV unavailable');
      const text = await response.text();
      assert.ok(text.includes('Invalid state parameter'), 'Should reject without CSRF protection');
    });
=======
>>>>>>> aabdce7 (Add OAuth state parameter validation and redirect loop prevention)
  });

  describe('Session Validation', () => {
    it('should have enhanced session validation with logging', () => {
      const validateSection = workerCode.substring(
        workerCode.indexOf('async function validateSession'),
        workerCode.indexOf('async function validateSession') + 2000
      );
      
      assert.ok(validateSection.includes('console.warn'), 'Should have logging');
      assert.ok(validateSection.includes('reason:'), 'Should return reason for failure');
      assert.ok(validateSection.includes('malformed'), 'Should detect malformed tokens');
      assert.ok(validateSection.includes('expired'), 'Should detect expired tokens');
    });

    it('should prevent redirect loops with error page', () => {
      const mainRouteSection = workerCode.substring(
        workerCode.indexOf("if (url.pathname === '/' || url.pathname === '/chat')"),
        workerCode.indexOf("if (url.pathname === '/api/health')")
      );
      
      assert.ok(mainRouteSection.includes('Authentication Error'), 'Should have error page');
      assert.ok(mainRouteSection.includes('Try again'), 'Should have retry link');
      assert.ok(mainRouteSection.includes('result.reason'), 'Should show error reason');
    });
  });

  describe('Redirect Loop Prevention', () => {
    it('should show error page instead of redirecting on invalid session', async () => {
      const mockEnv = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        SESSION_SECRET: 'test-session-secret',
        CONTEXT: null
      };

      // Create invalid session token
      const invalidSession = 'invalid.token.here';

      const request = new Request(`https://test.workers.dev/?session=${encodeURIComponent(invalidSession)}`, {
        method: 'GET'
      });

      const response = await router.fetch(request, mockEnv);
      
      assert.equal(response.status, 401, 'Should return 401 instead of redirect');
      const text = await response.text();
      assert.ok(text.includes('Authentication Error'), 'Should show error page');
      assert.ok(text.includes('Try again'), 'Should have retry option');
    });

<<<<<<< HEAD
    it('should serve HTML for unauthenticated GET requests', async () => {
=======
    it('should redirect to OAuth when no session exists', async () => {
>>>>>>> aabdce7 (Add OAuth state parameter validation and redirect loop prevention)
      const mockEnv = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        SESSION_SECRET: 'test-session-secret',
        CONTEXT: null
      };

      const request = new Request('https://test.workers.dev/', {
        method: 'GET',
        headers: {}
      });

      const response = await router.fetch(request, mockEnv);
      
<<<<<<< HEAD
      assert.equal(response.status, 200, 'Should return HTML');
      const text = await response.text();
      assert.ok(text.includes('<!DOCTYPE html>'), 'Should include HTML doctype');
      assert.ok(text.toLowerCase().includes('omnibot'), 'Should include app name');
=======
      assert.equal(response.status, 302, 'Should redirect');
      const location = response.headers.get('Location');
      assert.ok(location.includes('/auth/google'), 'Should redirect to OAuth');
>>>>>>> aabdce7 (Add OAuth state parameter validation and redirect loop prevention)
    });
  });

  describe('Session Cookie Handling', () => {
    it('should set secure session cookie with proper attributes', () => {
      const cookieSection = workerCode.substring(
        workerCode.indexOf("'Set-Cookie': `session="),
        workerCode.indexOf("'Set-Cookie': `session=") + 200
      );
      
      assert.ok(cookieSection.includes('HttpOnly'), 'Should be HttpOnly');
      assert.ok(cookieSection.includes('Secure'), 'Should be Secure');
      assert.ok(cookieSection.includes('SameSite=Strict'), 'Should have SameSite=Strict');
      assert.ok(cookieSection.includes('Max-Age'), 'Should have Max-Age');
    });

    it('should read session from cookie or Authorization header', () => {
      assert.ok(workerCode.includes('getSessionFromRequest'), 'Should have getSessionFromRequest function');
      assert.ok(workerCode.includes("authHeader.startsWith('Bearer ')"), 'Should check Authorization header');
      assert.ok(workerCode.includes("cookie.startsWith('session=')"), 'Should check Cookie header');
    });
  });

  describe('Security', () => {
    it('should delete state after validation (one-time use)', () => {
      const validateStateSection = workerCode.substring(
        workerCode.indexOf('async function validateOAuthState'),
        workerCode.indexOf('async function validateOAuthState') + 1000
      );
      
      assert.ok(validateStateSection.includes('delete'), 'Should delete state after use');
    });

    it('should have state expiration', () => {
      const generateStateSection = workerCode.substring(
        workerCode.indexOf('async function generateOAuthState'),
        workerCode.indexOf('async function generateOAuthState') + 500
      );
      
      assert.ok(generateStateSection.includes('expirationTtl'), 'Should have TTL for state');
    });

    it('should log OAuth errors for debugging', () => {
      const callbackSection = workerCode.substring(
        workerCode.indexOf("if (url.pathname === '/auth/callback')"),
        workerCode.indexOf("if (url.pathname === '/api/verify-session')")
      );
      
      assert.ok(callbackSection.includes('console.error'), 'Should log errors');
    });
  });

  describe('Error Messages', () => {
    it('should provide user-friendly error messages', () => {
      assert.ok(workerCode.includes('Invalid state parameter'), 'Should have invalid state message');
      assert.ok(workerCode.includes('Authentication Error'), 'Should have auth error page');
      assert.ok(workerCode.includes('Try again'), 'Should provide retry option');
    });

    it('should include reason in session validation failures', () => {
      const validateSection = workerCode.substring(
        workerCode.indexOf('async function validateSession'),
        workerCode.indexOf('async function validateSession') + 2000
      );
      
      assert.ok(validateSection.includes("reason: 'malformed'"), 'Should return malformed reason');
      assert.ok(validateSection.includes("reason: 'expired'"), 'Should return expired reason');
      assert.ok(validateSection.includes("reason: 'invalid_signature'"), 'Should return invalid signature reason');
    });
  });
});
