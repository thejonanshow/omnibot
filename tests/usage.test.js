/**
 * Unit tests for usage tracking using Node's native test runner
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDateKey, getUsage, incrementUsage } from '../cloudflare-worker/src/lib/usage.js';

describe('Usage Tracking', () => {
  describe('getDateKey', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const key = getDateKey();
      assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
    });

    it('should pad single digit months and days', () => {
      const key = getDateKey();
      const [year, month, day] = key.split('-');
      
      assert.equal(year.length, 4);
      assert.equal(month.length, 2);
      assert.equal(day.length, 2);
    });

    it('should return consistent key for same day', () => {
      const key1 = getDateKey();
      const key2 = getDateKey();
      assert.equal(key1, key2);
    });
  });

  describe('getUsage', () => {
    it('should return 0 for new provider', async () => {
      const mockStore = {
        async get() { return null; }
      };

      const usage = await getUsage(mockStore, 'groq');
      assert.equal(usage, 0);
    });

    it('should return stored usage count', async () => {
      const dateKey = getDateKey();
      const mockStore = {
        data: { [`usage:groq:${dateKey}`]: '5' },
        async get(key) {
          return this.data[key];
        }
      };
      
      const usage = await getUsage(mockStore, 'groq');
      assert.equal(usage, 5);
    });

    it('should parse usage as integer', async () => {
      const dateKey = getDateKey();
      const mockStore = {
        data: { [`usage:groq:${dateKey}`]: '42' },
        async get(key) {
          return this.data[key];
        }
      };
      
      const usage = await getUsage(mockStore, 'groq');
      assert.equal(typeof usage, 'number');
      assert.equal(usage, 42);
    });
  });

  describe('incrementUsage', () => {
    it('should increment from 0 to 1', async () => {
      const mockStore = {
        data: {},
        async get(key) {
          return this.data[key];
        },
        async put(key, value, options) {
          this.data[key] = value;
        }
      };

      const newUsage = await incrementUsage(mockStore, 'groq');
      assert.equal(newUsage, 1);
      
      const dateKey = getDateKey();
      const stored = mockStore.data[`usage:groq:${dateKey}`];
      assert.equal(stored, '1');
    });

    it('should increment existing usage', async () => {
      const dateKey = getDateKey();
      const mockStore = {
        data: { [`usage:groq:${dateKey}`]: '5' },
        async get(key) {
          return this.data[key];
        },
        async put(key, value, options) {
          this.data[key] = value;
        }
      };
      
      const newUsage = await incrementUsage(mockStore, 'groq');
      assert.equal(newUsage, 6);
    });

    it('should handle multiple providers independently', async () => {
      const mockStore = {
        data: {},
        async get(key) {
          return this.data[key];
        },
        async put(key, value, options) {
          this.data[key] = value;
        }
      };

      await incrementUsage(mockStore, 'groq');
      await incrementUsage(mockStore, 'groq');
      await incrementUsage(mockStore, 'gemini');
      
      const dateKey = getDateKey();
      const groqUsage = parseInt(mockStore.data[`usage:groq:${dateKey}`]);
      const geminiUsage = parseInt(mockStore.data[`usage:gemini:${dateKey}`]);
      
      assert.equal(groqUsage, 2);
      assert.equal(geminiUsage, 1);
    });
  });
});
