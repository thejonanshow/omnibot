/**
 * Unit tests for CLI authentication utilities using Node's native test runner
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authenticateCliRequest, hasScope } from '../cloudflare-worker/src/lib/cli-auth.js';

describe('CLI Authentication', () => {
  describe('authenticateCliRequest', () => {
    it('should return null if CLI_TOKENS namespace is missing', async () => {
      const mockRequest = new Request('http://localhost/api/cli/whoami', {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      const mockEnv = {};

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.equal(result, null);
    });

    it('should return null if Authorization header is missing', async () => {
      const mockRequest = new Request('http://localhost/api/cli/whoami');
      const mockEnv = {
        CLI_TOKENS: {
          async get() { return null; }
        }
      };

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.equal(result, null);
    });

    it('should return null if Authorization header does not start with Bearer', async () => {
      const mockRequest = new Request('http://localhost/api/cli/whoami', {
        headers: { 'Authorization': 'Basic test-token' }
      });
      const mockEnv = {
        CLI_TOKENS: {
          async get() { return null; }
        }
      };

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.equal(result, null);
    });

    it('should return null if token is too short', async () => {
      const mockRequest = new Request('http://localhost/api/cli/whoami', {
        headers: { 'Authorization': 'Bearer abc' }
      });
      const mockEnv = {
        CLI_TOKENS: {
          async get() { return null; }
        }
      };

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.equal(result, null);
    });

    it('should return null if token is not found in KV', async () => {
      const mockRequest = new Request('http://localhost/api/cli/whoami', {
        headers: { 'Authorization': 'Bearer valid-token-123' }
      });
      const mockEnv = {
        CLI_TOKENS: {
          async get() { return null; }
        }
      };

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.equal(result, null);
    });

    it('should return null and delete token if expired', async () => {
      const expiredTime = Date.now() - 1000; // 1 second ago
      const mockRequest = new Request('http://localhost/api/cli/whoami', {
        headers: { 'Authorization': 'Bearer valid-token-123' }
      });
      
      let deletedToken = null;
      const mockEnv = {
        CLI_TOKENS: {
          async get() {
            return JSON.stringify({
              id: 'user123',
              email: 'test@example.com',
              expires_at: expiredTime
            });
          },
          async delete(token) {
            deletedToken = token;
          }
        }
      };

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.equal(result, null);
      assert.equal(deletedToken, 'valid-token-123');
    });

    it('should return user object for valid token', async () => {
      const mockRequest = new Request('http://localhost/api/cli/whoami', {
        headers: { 'Authorization': 'Bearer valid-token-123' }
      });
      const mockEnv = {
        CLI_TOKENS: {
          async get() {
            return JSON.stringify({
              id: 'user123',
              email: 'test@example.com',
              scopes: ['chat', 'whoami']
            });
          }
        }
      };

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.ok(result);
      assert.equal(result.id, 'user123');
      assert.equal(result.email, 'test@example.com');
      assert.equal(result.source, 'cli');
      assert.deepEqual(result.scopes, ['chat', 'whoami']);
    });

    it('should handle token without expiry', async () => {
      const mockRequest = new Request('http://localhost/api/cli/whoami', {
        headers: { 'Authorization': 'Bearer valid-token-123' }
      });
      const mockEnv = {
        CLI_TOKENS: {
          async get() {
            return JSON.stringify({
              id: 'user123',
              email: 'test@example.com'
            });
          }
        }
      };

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.ok(result);
      assert.equal(result.id, 'user123');
      assert.equal(result.source, 'cli');
    });

    it('should use email as id if id is missing', async () => {
      const mockRequest = new Request('http://localhost/api/cli/whoami', {
        headers: { 'Authorization': 'Bearer valid-token-123' }
      });
      const mockEnv = {
        CLI_TOKENS: {
          async get() {
            return JSON.stringify({
              email: 'test@example.com'
            });
          }
        }
      };

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.ok(result);
      assert.equal(result.id, 'test@example.com');
    });

    it('should default to cli-user if both id and email are missing', async () => {
      const mockRequest = new Request('http://localhost/api/cli/whoami', {
        headers: { 'Authorization': 'Bearer valid-token-123' }
      });
      const mockEnv = {
        CLI_TOKENS: {
          async get() {
            return JSON.stringify({});
          }
        }
      };

      const result = await authenticateCliRequest(mockRequest, mockEnv);
      assert.ok(result);
      assert.equal(result.id, 'cli-user');
    });
  });

  describe('hasScope', () => {
    it('should return false if user is null', () => {
      assert.equal(hasScope(null, 'chat'), false);
    });

    it('should return false if user has no scopes', () => {
      const user = { id: 'user123' };
      assert.equal(hasScope(user, 'chat'), false);
    });

    it('should return true if user has the specific scope', () => {
      const user = { id: 'user123', scopes: ['chat', 'whoami'] };
      assert.equal(hasScope(user, 'chat'), true);
    });

    it('should return false if user does not have the specific scope', () => {
      const user = { id: 'user123', scopes: ['whoami'] };
      assert.equal(hasScope(user, 'chat'), false);
    });

    it('should return true if user has wildcard scope', () => {
      const user = { id: 'user123', scopes: ['*'] };
      assert.equal(hasScope(user, 'chat'), true);
      assert.equal(hasScope(user, 'edit'), true);
      assert.equal(hasScope(user, 'anything'), true);
    });
  });
});
