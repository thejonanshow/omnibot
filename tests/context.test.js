/**
 * Unit tests for context management
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getSharedContext, saveContext } from '../cloudflare-worker/src/lib/context.js';

describe('Context Management', () => {
  let mockContextStore;

  beforeEach(() => {
    mockContextStore = {
      data: {},
      async put(key, value) {
        this.data[key] = value;
      },
      async get(key) {
        return this.data[key];
      }
    };
  });

  describe('getSharedContext', () => {
    it('should return empty object when no context exists', async () => {
      const context = await getSharedContext(mockContextStore, 'session1');
      assert.deepEqual(context, {});
    });

    it('should return empty object when store is null', async () => {
      const context = await getSharedContext(null, 'session1');
      assert.deepEqual(context, {});
    });

    it('should return stored context', async () => {
      const testContext = { user: 'John', preferences: { theme: 'dark' } };
      await mockContextStore.put('context:session1', JSON.stringify(testContext));
      
      const context = await getSharedContext(mockContextStore, 'session1');
      assert.deepEqual(context, testContext);
    });

    it('should handle different session IDs', async () => {
      await mockContextStore.put('context:session1', JSON.stringify({ foo: 'bar' }));
      await mockContextStore.put('context:session2', JSON.stringify({ baz: 'qux' }));
      
      const context1 = await getSharedContext(mockContextStore, 'session1');
      const context2 = await getSharedContext(mockContextStore, 'session2');
      
      assert.deepEqual(context1, { foo: 'bar' });
      assert.deepEqual(context2, { baz: 'qux' });
    });
  });

  describe('saveContext', () => {
    it('should save new key-value pair', async () => {
      const result = await saveContext('name', 'Alice', mockContextStore, 'session1');
      
      assert.equal(result.success, true);
      assert.equal(result.message, 'Saved name to context');
      
      const context = await getSharedContext(mockContextStore, 'session1');
      assert.equal(context.name, 'Alice');
    });

    it('should merge with existing context', async () => {
      await mockContextStore.put('context:session1', JSON.stringify({ existing: 'value' }));
      
      await saveContext('new', 'data', mockContextStore, 'session1');
      
      const context = await getSharedContext(mockContextStore, 'session1');
      assert.deepEqual(context, { existing: 'value', new: 'data' });
    });

    it('should overwrite existing keys', async () => {
      await mockContextStore.put('context:session1', JSON.stringify({ key: 'old' }));
      
      await saveContext('key', 'new', mockContextStore, 'session1');
      
      const context = await getSharedContext(mockContextStore, 'session1');
      assert.equal(context.key, 'new');
    });

    it('should return error when store is null', async () => {
      const result = await saveContext('key', 'value', null, 'session1');
      
      assert.equal(result.error, 'Context storage not available');
      assert.equal(result.success, undefined);
    });

    it('should handle complex values', async () => {
      const complexValue = {
        nested: { deep: { value: [1, 2, 3] } },
        array: ['a', 'b', 'c']
      };
      
      await saveContext('complex', complexValue, mockContextStore, 'session1');
      
      const context = await getSharedContext(mockContextStore, 'session1');
      assert.deepEqual(context.complex, complexValue);
    });

    it('should isolate sessions', async () => {
      await saveContext('key', 'session1-value', mockContextStore, 'session1');
      await saveContext('key', 'session2-value', mockContextStore, 'session2');
      
      const context1 = await getSharedContext(mockContextStore, 'session1');
      const context2 = await getSharedContext(mockContextStore, 'session2');
      
      assert.equal(context1.key, 'session1-value');
      assert.equal(context2.key, 'session2-value');
    });
  });
});
