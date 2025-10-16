/**
 * Unit tests for LLM provider functions
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { callQwen } from '../cloudflare-worker/src/llm-providers.js';

describe('LLM Providers', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      GROQ_API_KEY: 'mock-groq-key',
      GEMINI_API_KEY: 'mock-gemini-key',
      ANTHROPIC_API_KEY: 'mock-claude-key',
      CONTEXT: {
        async get() { return null; }
      }
    };
  });

  describe('callQwen', () => {
    it('should return code template response', async () => {
      const response = await callQwen(
        'Write a function to sort an array',
        [],
        mockEnv,
        'test-session'
      );

      assert.ok(response.choices);
      assert.equal(response.choices.length, 1);
      assert.equal(response.choices[0].message.role, 'assistant');
      assert.ok(response.choices[0].message.content.includes('python'));
      assert.ok(response.choices[0].message.content.includes('def solve_problem'));
    });

    it('should include user message in response', async () => {
      const userMessage = 'Create a REST API endpoint';
      const response = await callQwen(userMessage, [], mockEnv, 'test-session');

      assert.ok(response.choices[0].message.content.includes(userMessage));
    });

    it('should return consistent structure', async () => {
      const response = await callQwen('Test message', [], mockEnv, 'test-session');

      assert.ok(response.choices[0].message);
      assert.ok(response.choices[0].message.content);
      assert.equal(response.choices[0].message.role, 'assistant');
    });
  });

  // Note: callGroq, callGemini, callClaude require actual API mocking
  // which we'll do in integration tests. These are covered by the
  // mock implementation in the worker.
});
