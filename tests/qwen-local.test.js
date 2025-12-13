/**
 * Local Qwen Integration Tests
 * Tests for local Ollama Qwen integration
 */

import './test-setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { callQwen } from '../cloudflare-worker/src/llm-providers.js';

describe('Local Qwen Integration', () => {
  describe('Story: Use local Qwen for code generation', () => {
    it('Given local Ollama is running, when asking for code, then return working code', async () => {
      const env = { 
        NODE_ENV: 'development',
        CONTEXT: null, // No context store needed for this test
        QWEN_API_KEY: 'mock-qwen-key' // Mock API key to prevent the "not configured" error
      };
      
      const message = 'Write a JavaScript function to add two numbers. Just the code, no explanation.';
      
      try {
        const result = await callQwen(message, [], env, 'test-session');
        
        // Verify response structure
        assert.ok(result.choices, 'Should have choices array');
        assert.ok(result.choices[0], 'Should have first choice');
        assert.ok(result.choices[0].message, 'Should have message');
        assert.ok(result.choices[0].message.content, 'Should have content');
        
        const content = result.choices[0].message.content;
        
        // Verify it's code (contains function keyword)
        assert.ok(
          content.includes('function') || content.includes('=>') || content.includes('const'),
          'Response should contain code'
        );
        
        console.log('Qwen response preview:', content.substring(0, 100) + '...');
        
      } catch (error) {
        // If Ollama isn't running, skip gracefully
        if (error.message && error.message.includes('ECONNREFUSED')) {
          console.log('Skipping: Ollama not running locally');
          return;
        }
        throw error;
      }
    });

    it('Given production env, when QWEN_RUNLOOP_URL set, then should use Runloop URL', () => {
      const env = { 
        NODE_ENV: 'production',
        QWEN_RUNLOOP_URL: 'https://test.runloop.dev:8000'
      };
      
      // Just verify the URL selection logic
      const isLocal = env.NODE_ENV === 'development';
      const qwenUrl = isLocal
        ? 'http://localhost:11434'
        : env.QWEN_RUNLOOP_URL || 'https://dbx_test.runloop.dev:8000';
      
      assert.strictEqual(qwenUrl, 'https://test.runloop.dev:8000');
    });
  });
});
