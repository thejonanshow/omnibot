/**
 * Unit tests for conversation storage utilities using Node's native test runner
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  generateConversationId, 
  getConversation, 
  saveConversation, 
  deleteConversation,
  indexConversation
} from '../cloudflare-worker/src/lib/conversations.js';

describe('Conversation Storage', () => {
  describe('generateConversationId', () => {
    it('should generate a valid conversation ID', () => {
      const id = generateConversationId();
      assert.ok(id);
      assert.ok(id.startsWith('conv_'));
      assert.ok(id.length > 10);
    });

    it('should generate unique conversation IDs', () => {
      const id1 = generateConversationId();
      const id2 = generateConversationId();
      assert.notEqual(id1, id2);
    });
  });

  describe('getConversation', () => {
    it('should return empty array if conversationId is missing', async () => {
      const mockEnv = {
        CONTEXT: {
          async get() { return null; }
        }
      };
      const result = await getConversation(null, mockEnv);
      assert.deepEqual(result, []);
    });

    it('should return empty array if CONTEXT is missing', async () => {
      const mockEnv = {};
      const result = await getConversation('conv_123', mockEnv);
      assert.deepEqual(result, []);
    });

    it('should return empty array if conversation not found', async () => {
      const mockEnv = {
        CONTEXT: {
          async get() { return null; }
        }
      };
      const result = await getConversation('conv_123', mockEnv);
      assert.deepEqual(result, []);
    });

    it('should return messages array for existing conversation', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      const mockEnv = {
        CONTEXT: {
          async get() {
            return JSON.stringify({ messages });
          }
        }
      };
      const result = await getConversation('conv_123', mockEnv);
      assert.deepEqual(result, messages);
    });

    it('should handle invalid JSON gracefully', async () => {
      const mockEnv = {
        CONTEXT: {
          async get() {
            return 'invalid json';
          }
        }
      };
      const result = await getConversation('conv_123', mockEnv);
      assert.deepEqual(result, []);
    });
  });

  describe('saveConversation', () => {
    it('should return false if conversationId is missing', async () => {
      const mockEnv = {
        CONTEXT: {
          async put() {}
        }
      };
      const result = await saveConversation(null, [], mockEnv);
      assert.equal(result, false);
    });

    it('should return false if CONTEXT is missing', async () => {
      const mockEnv = {};
      const result = await saveConversation('conv_123', [], mockEnv);
      assert.equal(result, false);
    });

    it('should save conversation with correct key and data', async () => {
      let savedKey = null;
      let savedValue = null;
      let savedOptions = null;

      const mockEnv = {
        CONTEXT: {
          async put(key, value, options) {
            savedKey = key;
            savedValue = value;
            savedOptions = options;
          }
        }
      };

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ];

      const result = await saveConversation('conv_123', messages, mockEnv, 3600);
      assert.equal(result, true);
      assert.equal(savedKey, 'conversation_conv_123');
      assert.equal(savedOptions.expirationTtl, 3600);

      const parsed = JSON.parse(savedValue);
      assert.deepEqual(parsed.messages, messages);
      assert.ok(parsed.updated_at);
    });

    it('should use default TTL of 24 hours', async () => {
      let savedOptions = null;

      const mockEnv = {
        CONTEXT: {
          async put(_key, _value, options) {
            savedOptions = options;
          }
        }
      };

      await saveConversation('conv_123', [], mockEnv);
      assert.equal(savedOptions.expirationTtl, 86400); // 24 hours
    });
  });

  describe('deleteConversation', () => {
    it('should return false if conversationId is missing', async () => {
      const mockEnv = {
        CONTEXT: {
          async delete() {}
        }
      };
      const result = await deleteConversation(null, mockEnv);
      assert.equal(result, false);
    });

    it('should return false if CONTEXT is missing', async () => {
      const mockEnv = {};
      const result = await deleteConversation('conv_123', mockEnv);
      assert.equal(result, false);
    });

    it('should delete conversation with correct key', async () => {
      let deletedKey = null;

      const mockEnv = {
        CONTEXT: {
          async delete(key) {
            deletedKey = key;
          }
        }
      };

      const result = await deleteConversation('conv_123', mockEnv);
      assert.equal(result, true);
      assert.equal(deletedKey, 'conversation_conv_123');
    });
  });

  describe('indexConversation', () => {
    it('should return false if userId is missing', async () => {
      const mockEnv = {
        CONTEXT: {
          async get() { return null; },
          async put() {}
        }
      };
      const result = await indexConversation(null, 'conv_123', {}, mockEnv);
      assert.equal(result, false);
    });

    it('should return false if conversationId is missing', async () => {
      const mockEnv = {
        CONTEXT: {
          async get() { return null; },
          async put() {}
        }
      };
      const result = await indexConversation('user123', null, {}, mockEnv);
      assert.equal(result, false);
    });

    it('should create new index if none exists', async () => {
      let savedValue = null;

      const mockEnv = {
        CONTEXT: {
          async get() { return null; },
          async put(_key, value) {
            savedValue = value;
          }
        }
      };

      const metadata = { title: 'Test conversation' };
      const result = await indexConversation('user123', 'conv_123', metadata, mockEnv);
      
      assert.equal(result, true);
      const parsed = JSON.parse(savedValue);
      assert.equal(parsed.conversations.length, 1);
      assert.equal(parsed.conversations[0].id, 'conv_123');
      assert.equal(parsed.conversations[0].title, 'Test conversation');
      assert.ok(parsed.conversations[0].updated_at);
    });

    it('should add new conversation to existing index', async () => {
      let savedValue = null;

      const existingIndex = {
        conversations: [
          { id: 'conv_100', title: 'Old conversation' }
        ]
      };

      const mockEnv = {
        CONTEXT: {
          async get() { 
            return JSON.stringify(existingIndex);
          },
          async put(_key, value) {
            savedValue = value;
          }
        }
      };

      const metadata = { title: 'New conversation' };
      await indexConversation('user123', 'conv_123', metadata, mockEnv);
      
      const parsed = JSON.parse(savedValue);
      assert.equal(parsed.conversations.length, 2);
      assert.equal(parsed.conversations[0].id, 'conv_123'); // New one first
      assert.equal(parsed.conversations[1].id, 'conv_100');
    });

    it('should update existing conversation in index', async () => {
      let savedValue = null;

      const existingIndex = {
        conversations: [
          { id: 'conv_123', title: 'Old title', updated_at: 1000 }
        ]
      };

      const mockEnv = {
        CONTEXT: {
          async get() { 
            return JSON.stringify(existingIndex);
          },
          async put(_key, value) {
            savedValue = value;
          }
        }
      };

      const metadata = { title: 'Updated title' };
      await indexConversation('user123', 'conv_123', metadata, mockEnv);
      
      const parsed = JSON.parse(savedValue);
      assert.equal(parsed.conversations.length, 1);
      assert.equal(parsed.conversations[0].title, 'Updated title');
      assert.ok(parsed.conversations[0].updated_at > 1000);
    });

    it('should limit index to 100 conversations', async () => {
      let savedValue = null;

      const conversations = [];
      for (let i = 0; i < 150; i++) {
        conversations.push({ id: `conv_${i}`, title: `Conv ${i}` });
      }

      const existingIndex = { conversations };

      const mockEnv = {
        CONTEXT: {
          async get() { 
            return JSON.stringify(existingIndex);
          },
          async put(_key, value) {
            savedValue = value;
          }
        }
      };

      const metadata = { title: 'New conversation' };
      await indexConversation('user123', 'conv_new', metadata, mockEnv);
      
      const parsed = JSON.parse(savedValue);
      assert.equal(parsed.conversations.length, 100);
      assert.equal(parsed.conversations[0].id, 'conv_new'); // New one first
    });
  });
});
