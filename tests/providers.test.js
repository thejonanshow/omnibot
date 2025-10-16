/**
 * Unit tests for provider selection
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, selectProvider, ProviderRotationError } from '../cloudflare-worker/src/lib/providers.js';

describe('Provider Management', () => {
  describe('PROVIDERS constant', () => {
    it('should have 4 providers', () => {
      assert.equal(PROVIDERS.length, 4);
    });

    it('should be sorted by priority', () => {
      for (let i = 0; i < PROVIDERS.length - 1; i++) {
        assert.ok(PROVIDERS[i].priority < PROVIDERS[i + 1].priority);
      }
    });

    it('should have required properties', () => {
      PROVIDERS.forEach(provider => {
        assert.ok(provider.name);
        assert.ok(typeof provider.limit === 'number');
        assert.ok(typeof provider.priority === 'number');
        assert.ok(typeof provider.fallback === 'boolean');
      });
    });

    it('should have correct provider names', () => {
      const names = PROVIDERS.map(p => p.name);
      assert.deepEqual(names, ['groq', 'gemini', 'qwen', 'claude']);
    });

    it('should have correct limits', () => {
      assert.equal(PROVIDERS.find(p => p.name === 'groq').limit, 30);
      assert.equal(PROVIDERS.find(p => p.name === 'gemini').limit, 15);
      assert.equal(PROVIDERS.find(p => p.name === 'qwen').limit, 1000);
      assert.equal(PROVIDERS.find(p => p.name === 'claude').limit, 50);
    });
  });

  describe('selectProvider', () => {
    it('should select first provider when all available', async () => {
      const mockGetUsage = async () => 0;
      
      const selected = await selectProvider(PROVIDERS, mockGetUsage);
      assert.equal(selected.name, 'groq');
    });

    it('should skip providers at limit', async () => {
      const mockGetUsage = async (provider) => {
        return provider === 'groq' ? 30 : 0;
      };
      
      const selected = await selectProvider(PROVIDERS, mockGetUsage);
      assert.equal(selected.name, 'gemini');
    });

    it('should skip multiple providers at limit', async () => {
      const mockGetUsage = async (provider) => {
        if (provider === 'groq') return 30;
        if (provider === 'gemini') return 15;
        return 0;
      };
      
      const selected = await selectProvider(PROVIDERS, mockGetUsage);
      assert.equal(selected.name, 'qwen');
    });

    it('should return null when all providers at limit', async () => {
      const mockGetUsage = async (provider) => {
        const limits = { groq: 30, gemini: 15, qwen: 1000, claude: 50 };
        return limits[provider];
      };
      
      const selected = await selectProvider(PROVIDERS, mockGetUsage);
      assert.equal(selected, null);
    });

    it('should select provider just under limit', async () => {
      const mockGetUsage = async (provider) => {
        if (provider === 'groq') return 29; // Just under limit
        return 0;
      };
      
      const selected = await selectProvider(PROVIDERS, mockGetUsage);
      assert.equal(selected.name, 'groq');
    });
  });

  describe('ProviderRotationError', () => {
    it('should create error with attempted providers', () => {
      const attempted = ['groq (limit reached)', 'gemini (error)'];
      const error = new ProviderRotationError('All failed', attempted);
      
      assert.equal(error.message, 'All failed');
      assert.equal(error.name, 'ProviderRotationError');
      assert.deepEqual(error.attemptedProviders, attempted);
    });

    it('should be instanceof Error', () => {
      const error = new ProviderRotationError('Test', []);
      assert.ok(error instanceof Error);
    });
  });
});
