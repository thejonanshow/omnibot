/**
 * BDD Tests for LLM Provider Integration
 *
 * Epic 1: LLM Provider Integration
 * Stories 1.1-1.4: Groq, Gemini, Claude, Qwen API Integration
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { callGroq, callGemini, callClaude, callQwen } from '../cloudflare-worker/src/llm-providers.js';

describe('Epic 1: LLM Provider Integration', () => {
  let mockEnv;
  let originalFetch;

  beforeEach(() => {
    mockEnv = {
      GROQ_API_KEY: 'mock-groq-key',
      GEMINI_API_KEY: 'mock-gemini-key',
      ANTHROPIC_API_KEY: 'mock-claude-key',
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

  describe('Story 1.1: Groq API Integration', () => {
    describe('Given valid API key, when calling Groq, then response is returned', () => {
      it('should call Groq API with correct parameters', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: 'Hello from Groq!',
              role: 'assistant'
            }
          }]
        };

        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          json: async () => mockResponse
        }));

        const result = await callGroq('Hello', [], mockEnv, 'session1');

        assert.equal(global.fetch.mock.calls.length, 1);
        const [url, options] = global.fetch.mock.calls[0].arguments;

        assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers['Authorization'], 'Bearer mock-groq-key');
        assert.equal(options.headers['Content-Type'], 'application/json');

        const body = JSON.parse(options.body);
        assert.equal(body.model, 'llama-3.3-70b-versatile');
        assert.equal(body.messages[0].role, 'system');
        assert.equal(body.messages[1].role, 'user');
        assert.equal(body.messages[1].content, 'Hello');
        assert.equal(body.max_tokens, 2000);

        assert.deepEqual(result, mockResponse);
      });

      it('should include conversation context in system prompt', async () => {
        mockEnv.CONTEXT.data['context:session1'] = JSON.stringify({
          previous_topic: 'coding',
          user_preferences: 'detailed explanations'
        });

        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'Response', role: 'assistant' } }] })
        }));

        await callGroq('Hello', [], mockEnv, 'session1');

        const [, options] = global.fetch.mock.calls[0].arguments;
        const body = JSON.parse(options.body);
        const systemPrompt = body.messages[0].content;

        assert.ok(systemPrompt.includes('previous_topic'));
        assert.ok(systemPrompt.includes('user_preferences'));
      });

      it('should include conversation history in messages', async () => {
        const conversation = [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' }
        ];

        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'Response', role: 'assistant' } }] })
        }));

        await callGroq('Second message', conversation, mockEnv, 'session1');

        const [, options] = global.fetch.mock.calls[0].arguments;
        const body = JSON.parse(options.body);

        assert.equal(body.messages.length, 4); // system + 2 conversation + 1 new message
        assert.equal(body.messages[1].content, 'First message');
        assert.equal(body.messages[2].content, 'First response');
        assert.equal(body.messages[3].content, 'Second message');
      });
    });

    describe('Given invalid API key, when calling Groq, then error is thrown', () => {
      it('should throw error when API key is missing', async () => {
        delete mockEnv.GROQ_API_KEY;

        await assert.rejects(
          async () => callGroq('Hello', [], mockEnv, 'session1'),
          { message: /Groq failed/ }
        );
      });

      it('should throw error when API returns error', async () => {
        global.fetch = mock.fn(() => Promise.resolve({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized'
        }));

        await assert.rejects(
          async () => callGroq('Hello', [], mockEnv, 'session1'),
          { message: 'Groq failed: 401 - Unauthorized' }
        );
      });

      it('should handle network failures gracefully', async () => {
        global.fetch = mock.fn(() => Promise.reject(new Error('Network error')));

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
        const mockGeminiResponse = {
          candidates: [{
            content: {
              parts: [{ text: 'Hello from Gemini!' }]
            }
          }]
        };

        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          json: async () => mockGeminiResponse
        }));

        const result = await callGemini('Hello', [], mockEnv, 'session1');

        assert.equal(global.fetch.mock.calls.length, 1);
        const [url, options] = global.fetch.mock.calls[0].arguments;

        assert.ok(url.includes('generativelanguage.googleapis.com'));
        assert.ok(url.includes('key=mock-gemini-key'));
        assert.equal(options.method, 'POST');
        assert.equal(options.headers['Content-Type'], 'application/json');

        const body = JSON.parse(options.body);
        assert.equal(body.contents.length, 2); // system + user message
        assert.equal(body.contents[0].role, 'user');
        assert.equal(body.contents[1].role, 'user');
        assert.equal(body.contents[1].parts[0].text, 'Hello');

        // Should return in Groq-compatible format
        assert.deepEqual(result, {
          choices: [{
            message: {
              content: 'Hello from Gemini!',
              role: 'assistant'
            }
          }]
        });
      });

      it('should handle conversation history correctly', async () => {
        const conversation = [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' }
        ];

        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Response' }] } }]
          })
        }));

        await callGemini('Second message', conversation, mockEnv, 'session1');

        const [, options] = global.fetch.mock.calls[0].arguments;
        const body = JSON.parse(options.body);

        assert.equal(body.contents.length, 4); // system + 2 conversation + 1 new message
        assert.equal(body.contents[1].role, 'user');
        assert.equal(body.contents[1].parts[0].text, 'First message');
        assert.equal(body.contents[2].role, 'model');
        assert.equal(body.contents[2].parts[0].text, 'First response');
        assert.equal(body.contents[3].role, 'user');
        assert.equal(body.contents[3].parts[0].text, 'Second message');
      });
    });

    describe('Given invalid API key, when calling Gemini, then error is thrown', () => {
      it('should throw error when API key is missing', async () => {
        delete mockEnv.GEMINI_API_KEY;

        await assert.rejects(
          async () => callGemini('Hello', [], mockEnv, 'session1'),
          { message: /Gemini failed/ }
        );
      });

      it('should parse and throw API errors', async () => {
        global.fetch = mock.fn(() => Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: { message: 'Invalid API key' }
          })
        }));

        await assert.rejects(
          async () => callGemini('Hello', [], mockEnv, 'session1'),
          { message: 'Gemini failed: 400 - Invalid API key' }
        );
      });

      it('should handle malformed error responses', async () => {
        global.fetch = mock.fn(() => Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({})
        }));

        await assert.rejects(
          async () => callGemini('Hello', [], mockEnv, 'session1'),
          { message: 'Gemini failed: 500 - Unknown error' }
        );
      });
    });
  });

  describe('Story 1.3: Claude API Integration', () => {
    describe('Given valid API key, when calling Claude, then response is returned in Groq format', () => {
      it('should call Claude API with correct parameters', async () => {
        const mockClaudeResponse = {
          content: [{ text: 'Hello from Claude!' }]
        };

        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          json: async () => mockClaudeResponse
        }));

        const result = await callClaude('Hello', [], mockEnv, 'session1');

        assert.equal(global.fetch.mock.calls.length, 1);
        const [url, options] = global.fetch.mock.calls[0].arguments;

        assert.equal(url, 'https://api.anthropic.com/v1/messages');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers['x-api-key'], 'mock-claude-key');
        assert.equal(options.headers['anthropic-version'], '2023-06-01');
        assert.equal(options.headers['Content-Type'], 'application/json');

        const body = JSON.parse(options.body);
        assert.equal(body.model, 'claude-3-haiku-20240307');
        assert.equal(body.max_tokens, 1000);
        assert.ok(body.system);
        assert.equal(body.messages.length, 1);
        assert.equal(body.messages[0].role, 'user');
        assert.equal(body.messages[0].content, 'Hello');

        // Should return in Groq-compatible format
        assert.deepEqual(result, {
          choices: [{
            message: {
              content: 'Hello from Claude!',
              role: 'assistant'
            }
          }]
        });
      });

      it('should include system prompt in request', async () => {
        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          json: async () => ({ content: [{ text: 'Response' }] })
        }));

        await callClaude('Hello', [], mockEnv, 'session1');

        const [, options] = global.fetch.mock.calls[0].arguments;
        const body = JSON.parse(options.body);

        assert.ok(body.system);
        assert.ok(body.system.includes('Omnibot'));
      });

      it('should include conversation context in system prompt', async () => {
        mockEnv.CONTEXT.data['context:session1'] = JSON.stringify({
          user_name: 'TestUser',
          preferences: 'concise responses'
        });

        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          json: async () => ({ content: [{ text: 'Response' }] })
        }));

        await callClaude('Hello', [], mockEnv, 'session1');

        const [, options] = global.fetch.mock.calls[0].arguments;
        const body = JSON.parse(options.body);

        assert.ok(body.system.includes('user_name'));
        assert.ok(body.system.includes('preferences'));
      });
    });

    describe('Given invalid API key, when calling Claude, then error is thrown', () => {
      it('should throw error when API key is missing', async () => {
        delete mockEnv.ANTHROPIC_API_KEY;

        await assert.rejects(
          async () => callClaude('Hello', [], mockEnv, 'session1'),
          { message: /Claude failed/ }
        );
      });

      it('should parse and throw API errors', async () => {
        global.fetch = mock.fn(() => Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({
            error: { message: 'Invalid API key' }
          })
        }));

        await assert.rejects(
          async () => callClaude('Hello', [], mockEnv, 'session1'),
          { message: 'Claude failed: 401 - Invalid API key' }
        );
      });
    });
  });

  describe('Story 1.4: Qwen Implementation', () => {
    describe('Given coding request, when calling Qwen, then response is returned', () => {
      it('should return Qwen response from Runloop', async () => {
        // Mock Runloop Qwen response
        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ 
            response: 'Here is a Python function to sort a list:\n\n```python\ndef sort_list(items):\n    return sorted(items)\n```' 
          })
        }));

        const result = await callQwen('Write a Python function to sort a list', [], mockEnv, 'session1');

        assert.ok(result.choices);
        assert.equal(result.choices.length, 1);
        assert.equal(result.choices[0].message.role, 'assistant');

        const content = result.choices[0].message.content;
        assert.ok(content.includes('Python'));
        assert.ok(content.includes('def sort_list'));
        assert.ok(content.includes('```python'));
      });

      it('should include user message in response', async () => {
        // Mock Runloop Qwen response
        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ 
            response: 'Here is a REST API endpoint for your request: Create a REST API endpoint' 
          })
        }));

        const userMessage = 'Create a REST API endpoint';
        const result = await callQwen(userMessage, [], mockEnv, 'session1');

        const content = result.choices[0].message.content;
        assert.ok(content.includes(userMessage));
      });

      it('should return consistent response structure', async () => {
        // Mock Runloop Qwen response
        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ response: 'Test response' })
        }));

        const result1 = await callQwen('Message 1', [], mockEnv, 'session1');
        const result2 = await callQwen('Message 2', [], mockEnv, 'session1');

        assert.deepEqual(Object.keys(result1), Object.keys(result2));
        assert.equal(result1.choices.length, result2.choices.length);
        assert.equal(result1.choices[0].message.role, result2.choices[0].message.role);
      });

      it('should handle local Qwen in development environment', async () => {
        // Mock local Ollama Qwen response
        global.fetch = mock.fn(() => Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ 
            message: { content: 'Local Qwen response' }
          })
        }));

        const devEnv = { ...mockEnv, NODE_ENV: 'development' };
        const result = await callQwen('Test message', [], devEnv, 'session1');

        assert.ok(result.choices);
        assert.equal(result.choices[0].message.role, 'assistant');
        assert.equal(result.choices[0].message.content, 'Local Qwen response');
      });

      it('should fallback to Runloop when local Qwen fails', async () => {
        // Mock local failure, then Runloop success
        let callCount = 0;
        global.fetch = mock.fn(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('ECONNREFUSED'));
          } else {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({ response: 'Runloop Qwen response' })
            });
          }
        });

        const devEnv = { ...mockEnv, NODE_ENV: 'development' };
        const result = await callQwen('Test message', [], devEnv, 'session1');

        assert.ok(result.choices);
        assert.equal(result.choices[0].message.content, 'Runloop Qwen response');
        assert.equal(callCount, 2); // Local attempt + Runloop fallback
      });

      it('should handle both local and Runloop failures', async () => {
        // Mock both failures
        global.fetch = mock.fn(() => Promise.reject(new Error('Service unavailable')));

        const devEnv = { ...mockEnv, NODE_ENV: 'development' };
        
        await assert.rejects(
          async () => callQwen('Test message', [], devEnv, 'session1'),
          { message: 'Qwen failed: Service unavailable' }
        );
      });
    });
  });
});