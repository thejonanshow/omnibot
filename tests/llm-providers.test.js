/**
 * BDD Tests for LLM Provider Integration
 *
 * Epic 1: LLM Provider Integration
 * Stories: Qwen API Integration
 */

import './test-setup.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { callQwen, callGroq, callGemini, callClaude } from '../cloudflare-worker/src/llm-providers.js';

describe('Epic 1: LLM Provider Integration', () => {
  let mockEnv;
  let originalFetch;

  beforeEach(() => {
    mockEnv = {
      GROQ_API_KEY: 'mock-groq-key',
      GEMINI_API_KEY: 'mock-gemini-key',
      ANTHROPIC_API_KEY: 'mock-claude-key',
      QWEN_API_KEY: 'mock-qwen-key',
      CONTEXT: {
        data: {},
        async get(key) {
          return this.data[key];
        }
      }
    };

    // Save original fetch
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Story: Qwen API Integration', () => {
    describe('Given valid API key, when calling Qwen, then response is returned', () => {
      it('should call Qwen API with correct parameters', async () => {
        let capturedRequest;
        global.fetch = async (url, options) => {
          capturedRequest = { url, options };
          return {
            ok: true,
            status: 200,
            json: async () => ({
              output: {
                choices: [{ message: { content: 'Mock Qwen response' } }]
              },
              usage: { total_tokens: 50 }
            })
          };
        };

        const result = await callQwen('Hello', [], mockEnv, 'session1');

        // Verify response structure
        assert.ok(result.choices, 'Should have choices array');
        assert.ok(result.choices[0], 'Should have first choice');
        assert.ok(result.choices[0].message, 'Should have message');
        assert.equal(result.choices[0].message.content, 'Mock Qwen response');
        assert.equal(result.provider, 'qwen');
        assert.ok(result.usage, 'Should have usage data');
      });

      it('should include system prompt for coding requests', async () => {
        global.fetch = async (url, options) => {
          const body = JSON.parse(options.body);
          
          // Verify system prompt is included for coding requests
          assert.ok(body.input?.messages?.[0]?.role === 'system', 'Should include system message');
          assert.ok(body.input?.messages?.[0]?.content.includes('code generation'), 'Should include coding context');
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              output: {
                choices: [{ message: { content: 'function example() { return true; }' } }]
              },
              usage: { total_tokens: 50 }
            })
          };
        };

        const result = await callQwen('Write a function', [], mockEnv, 'session1');
        
        assert.ok(result.choices[0].message.content.includes('function'), 'Should return code');
      });

      it('should include conversation history in messages', async () => {
        const conversation = [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' }
        ];

        global.fetch = async (url, options) => {
          const body = JSON.parse(options.body);
          
          // Verify conversation history is included
          const messages = body.input?.messages;
          assert.ok(messages.length >= 3, 'Should include conversation history');
          assert.equal(messages[1].content, 'First message');
          assert.equal(messages[2].content, 'First response');
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              output: {
                choices: [{ message: { content: 'Second response' } }]
              },
              usage: { total_tokens: 50 }
            })
          };
        };

        const result = await callQwen('Second message', conversation, mockEnv, 'session1');
        assert.equal(result.choices[0].message.content, 'Second response');
      });
    });

    describe('Given invalid API key, when calling Qwen, then error is thrown', () => {
      it('should throw error when API key is missing', async () => {
        const envWithoutKey = { ...mockEnv };
        delete envWithoutKey.QWEN_API_KEY;

        await assert.rejects(
          async () => callQwen('Hello', [], envWithoutKey, 'session1'),
          {
            message: 'Qwen API key not configured'
          }
        );
      });

      it('should handle API errors gracefully', async () => {
        global.fetch = async (url, options) => {
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: async () => 'Invalid API key'
          };
        };

        await assert.rejects(
          async () => callQwen('Hello', [], mockEnv, 'session1'),
          {
            message: 'Qwen API error: 401'
          }
        );
      });

      it('should handle network failures gracefully', async () => {
        global.fetch = async (url, options) => {
          throw new Error('Network error');
        };

        await assert.rejects(
          async () => callQwen('Hello', [], mockEnv, 'session1'),
          {
            message: 'Network error'
          }
        );
      });
    });
  });

  describe('Story 1.1: Groq API Integration', () => {
    describe('Given valid API key, when calling Groq, then response is returned', () => {
      it('should call Groq API with correct parameters', async () => {
        global.fetch = async (url, options) => {
          assert.ok(url.includes('api.groq.com'));
          assert.ok(options.headers['Authorization'].includes('mock-groq-key'));
          assert.ok(options.body.includes('llama-3.1-70b-versatile'));
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{
                message: {
                  content: 'Hello from Groq!',
                  role: 'assistant'
                }
              }],
              usage: { total_tokens: 100 }
            })
          };
        };

        const result = await callGroq('Hello', [], mockEnv, 'session1');
        assert.ok(result.choices[0].message.content.includes('Hello from Groq!'));
        assert.equal(result.usage.total_tokens, 100);
      });

      it('should include conversation context in system prompt', async () => {
        global.fetch = async (url, options) => {
          const body = JSON.parse(options.body);
          assert.ok(body.messages[0].content.includes('session1'));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: 'Response', role: 'assistant' } }]
            })
          };
        };

        await callGroq('Hello', [], mockEnv, 'session1');
      });

      it('should include conversation history in messages', async () => {
        global.fetch = async (url, options) => {
          const body = JSON.parse(options.body);
          assert.equal(body.messages.length, 4); // system + 2 history + user
          assert.equal(body.messages[1].content, 'Previous user message');
          assert.equal(body.messages[2].content, 'Previous assistant message');
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: 'Response', role: 'assistant' } }]
            })
          };
        };

        const conversation = [
          { role: 'user', content: 'Previous user message' },
          { role: 'assistant', content: 'Previous assistant message' }
        ];
        
        await callGroq('Hello', conversation, mockEnv, 'session1');
      });
    });

    describe('Given invalid API key, when calling Groq, then error is thrown', () => {
      it('should throw error when API key is missing', async () => {
        const envWithoutKey = { ...mockEnv };
        delete envWithoutKey.GROQ_API_KEY;

        await assert.rejects(
          async () => callGroq('Hello', [], envWithoutKey, 'session1'),
          { message: 'Groq API key not configured' }
        );
      });

      it('should throw error when API returns error', async () => {
        global.fetch = async () => ({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized'
        });

        await assert.rejects(
          async () => callGroq('Hello', [], mockEnv, 'session1'),
          { message: 'Groq failed: 401 - Unauthorized' }
        );
      });

      it('should handle network failures gracefully', async () => {
        global.fetch = async () => {
          throw new Error('Network error');
        };

        await assert.rejects(
          async () => callGroq('Hello', [], mockEnv, 'session1'),
          { message: 'Network error' }
        );
      });
    });
  });

  describe('Story 1.2: Gemini API Integration', () => {
    describe('Given valid API key, when calling Gemini, then response is returned in Groq format', () => {
      it('should call Gemini API with correct parameters', async () => {
        global.fetch = async (url, options) => {
          assert.ok(url.includes('generativelanguage.googleapis.com'));
          assert.ok(url.includes('mock-gemini-key'));
          
          const body = JSON.parse(options.body);
          assert.ok(body.contents);
          assert.equal(body.generationConfig.maxOutputTokens, 4096);
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{
                content: {
                  parts: [{ text: 'Hello from Gemini!' }]
                }
              }],
              usageMetadata: {
                promptTokenCount: 50,
                candidatesTokenCount: 25,
                totalTokenCount: 75
              }
            })
          };
        };

        const result = await callGemini('Hello', [], mockEnv, 'session1');
        assert.ok(result.choices[0].message.content.includes('Hello from Gemini!'));
        assert.equal(result.usage.total_tokens, 75);
        assert.equal(result.provider, 'gemini');
      });

      it('should handle conversation history correctly', async () => {
        global.fetch = async (url, options) => {
          const body = JSON.parse(options.body);
          assert.equal(body.contents.length, 3); // system + 1 history + user
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{
                content: {
                  parts: [{ text: 'Response' }]
                }
              }]
            })
          };
        };

        const conversation = [
          { role: 'user', content: 'Previous message' }
        ];
        
        await callGemini('Hello', conversation, mockEnv, 'session1');
      });
    });

    describe('Given invalid API key, when calling Gemini, then error is thrown', () => {
      it('should throw error when API key is missing', async () => {
        const envWithoutKey = { ...mockEnv };
        delete envWithoutKey.GEMINI_API_KEY;

        await assert.rejects(
          async () => callGemini('Hello', [], envWithoutKey, 'session1'),
          { message: 'Gemini API key not configured' }
        );
      });

      it('should parse and throw API errors', async () => {
        global.fetch = async () => ({
          ok: false,
          status: 400,
          text: async () => 'Invalid API key'
        });

        await assert.rejects(
          async () => callGemini('Hello', [], mockEnv, 'session1'),
          { message: 'Gemini failed: 400 - Invalid API key' }
        );
      });

      it('should handle malformed error responses', async () => {
        global.fetch = async () => ({
          ok: false,
          status: 500,
          text: async () => 'Internal server error'
        });

        await assert.rejects(
          async () => callGemini('Hello', [], mockEnv, 'session1'),
          { message: 'Gemini failed: 500 - Internal server error' }
        );
      });
    });
  });

  describe('Story 1.3: Claude API Integration', () => {
    describe('Given valid API key, when calling Claude, then response is returned in Groq format', () => {
      it('should call Claude API with correct parameters', async () => {
        global.fetch = async (url, options) => {
          assert.ok(url.includes('api.anthropic.com'));
          assert.equal(options.headers['x-api-key'], 'mock-claude-key');
          
          const body = JSON.parse(options.body);
          assert.equal(body.model, 'claude-3-haiku-20240307');
          assert.equal(body.max_tokens, 4096);
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              content: [{
                text: 'Hello from Claude!'
              }],
              usage: {
                input_tokens: 50,
                output_tokens: 25
              }
            })
          };
        };

        const result = await callClaude('Hello', [], mockEnv, 'session1');
        assert.ok(result.choices[0].message.content.includes('Hello from Claude!'));
        assert.equal(result.usage.total_tokens, 75);
        assert.equal(result.provider, 'claude');
      });

      it('should include system prompt in request', async () => {
        global.fetch = async (url, options) => {
          const body = JSON.parse(options.body);
          assert.ok(body.messages[0].content.includes('session1'));
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              content: [{ text: 'Response' }],
              usage: { input_tokens: 10, output_tokens: 5 }
            })
          };
        };

        await callClaude('Hello', [], mockEnv, 'session1');
      });

      it('should include conversation context in system prompt', async () => {
        global.fetch = async (url, options) => {
          const body = JSON.parse(options.body);
          assert.equal(body.messages.length, 4); // system + 2 history + user
          
          return {
            ok: true,
            status: 200,
            json: async () => ({
              content: [{ text: 'Response' }],
              usage: { input_tokens: 10, output_tokens: 5 }
            })
          };
        };

        const conversation = [
          { role: 'user', content: 'Previous message' },
          { role: 'assistant', content: 'Previous response' }
        ];
        
        await callClaude('Hello', conversation, mockEnv, 'session1');
      });
    });

    describe('Given invalid API key, when calling Claude, then error is thrown', () => {
      it('should throw error when API key is missing', async () => {
        const envWithoutKey = { ...mockEnv };
        delete envWithoutKey.ANTHROPIC_API_KEY;

        await assert.rejects(
          async () => callClaude('Hello', [], envWithoutKey, 'session1'),
          { message: 'Anthropic API key not configured' }
        );
      });

      it('should parse and throw API errors', async () => {
        global.fetch = async () => ({
          ok: false,
          status: 401,
          text: async () => 'Invalid API key'
        });

        await assert.rejects(
          async () => callClaude('Hello', [], mockEnv, 'session1'),
          { message: 'Claude failed: 401 - Invalid API key' }
        );
      });

      it('should handle network failures gracefully', async () => {
        global.fetch = async () => {
          throw new Error('Network error');
        };

        await assert.rejects(
          async () => callClaude('Hello', [], mockEnv, 'session1'),
          { message: 'Network error' }
        );
      });
    });
  });
});