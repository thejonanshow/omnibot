/**
 * Unit tests for authentication utilities using Node's native test runner
 */

import './test-setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateChallenge, verifyRequest } from '../cloudflare-worker/src/lib/auth.js';

describe('Authentication', () => {
  describe('generateChallenge', () => {
    it('should generate valid challenge object', async () => {
      const mockStore = {
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
      };

      const result = await generateChallenge(mockStore);
      
      assert.ok(result.challenge);
      assert.ok(result.timestamp);
      assert.equal(result.expires_in, 60);
      assert.equal(typeof result.challenge, 'string');
      assert.equal(typeof result.timestamp, 'number');
    });

    it('should store challenge in KV with expiration', async () => {
      const mockStore = {
        data: {},
        async put(key, value, options) {
          this.data[key] = { value, options };
        },
        async get(key) {
          return this.data[key]?.value;
        }
      };

      const result = await generateChallenge(mockStore);
      
      const stored = mockStore.data[result.challenge];
      assert.ok(stored);
      assert.equal(stored.options.expirationTtl, 60);
    });

    it('should generate unique challenges', async () => {
      const mockStore = {
        data: {},
        async put(key, value, options) {
          this.data[key] = { value, options };
        }
      };

      const result1 = await generateChallenge(mockStore);
      const result2 = await generateChallenge(mockStore);
      
      assert.notEqual(result1.challenge, result2.challenge);
    });
  });

  describe('verifyRequest', () => {
    it('should reject request without headers', async () => {
      const mockStore = { data: {} };
      const mockRequest = {
        headers: {
          get: () => null
        }
      };

      await assert.rejects(
        async () => verifyRequest(mockRequest, mockStore, 'secret'),
        { message: 'Missing auth headers' }
      );
    });

    it('should reject expired request', async () => {
      const mockStore = {
        data: {},
        async put(key, value, options) {
          this.data[key] = { value, options };
        },
        async get(key) {
          return this.data[key]?.value;
        }
      };

      const challenge = await generateChallenge(mockStore);
      const oldTimestamp = Date.now() - 70000;

      const mockRequest = {
        headers: {
          get: (name) => {
            if (name === 'X-Challenge') return challenge.challenge;
            if (name === 'X-Signature') return 'sig';
            if (name === 'X-Timestamp') return oldTimestamp.toString();
          }
        }
      };

      await assert.rejects(
        async () => verifyRequest(mockRequest, mockStore, 'secret'),
        { message: 'Request expired' }
      );
    });

    it('should reject invalid challenge', async () => {
      const mockStore = {
        data: {},
        async get() { return null; }
      };

      const mockRequest = {
        headers: {
          get: (name) => {
            if (name === 'X-Challenge') return 'invalid-challenge';
            if (name === 'X-Signature') return 'sig';
            if (name === 'X-Timestamp') return Date.now().toString();
          }
        }
      };

      await assert.rejects(
        async () => verifyRequest(mockRequest, mockStore, 'secret'),
        { message: 'Invalid challenge' }
      );
    });

    it('should accept valid request and delete challenge', async () => {
      const mockStore = {
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
      };

      const challenge = await generateChallenge(mockStore);

      const mockRequest = {
        headers: {
          get: (name) => {
            if (name === 'X-Challenge') return challenge.challenge;
            if (name === 'X-Signature') return 'sig';
            if (name === 'X-Timestamp') return Date.now().toString();
          }
        }
      };

      await verifyRequest(mockRequest, mockStore, 'secret');
      
      const stored = await mockStore.get(challenge.challenge);
      assert.equal(stored, undefined);
    });
  });
});
