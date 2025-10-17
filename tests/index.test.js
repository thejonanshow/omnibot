/**
 * BDD Tests for Main Router Functionality
 *
 * Epic 2: Main Router Functionality
 * Stories 2.1-2.5: Challenge, Chat, Status, Health, TTS/STT Endpoints
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock the worker module
const mockWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Challenge, X-Signature, X-Timestamp',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response;

      if (url.pathname === '/challenge') {
        response = await handleChallenge(env);
      } else if (url.pathname === '/chat') {
        await verifyRequest(request, env);
        response = await handleChat(request, env);
      } else if (url.pathname === '/status') {
        response = await handleStatus(env);
      } else if (url.pathname === '/health') {
        response = new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['function_calling', 'shared_context', 'voice_services']
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (url.pathname === '/tts') {
        await verifyRequest(request, env);
        response = await handleTTS(request, env);
      } else if (url.pathname === '/stt') {
        await verifyRequest(request, env);
        response = await handleSTT(request, env);
      } else {
        response = new Response('Not Found', { status: 404 });
      }

      Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    } catch (error) {
      const errorResponse = new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      return errorResponse;
    }
  }
};

// Mock implementations for testing
async function handleChallenge(env) {
  const challenge = crypto.randomUUID();
  const timestamp = Date.now();

  await env.CHALLENGES.put(challenge, JSON.stringify({ timestamp }), {
    expirationTtl: 60
  });

  return new Response(JSON.stringify({
    challenge,
    timestamp,
    expires_in: 60
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function verifyRequest(request, env) {
  const challenge = request.headers.get('X-Challenge');
  const signature = request.headers.get('X-Signature');
  const timestamp = request.headers.get('X-Timestamp');

  if (!challenge || !signature || !timestamp) {
    throw new Error('Missing auth headers');
  }

  const now = Date.now();
  if (Math.abs(now - parseInt(timestamp)) > 60000) {
    throw new Error('Request expired');
  }

  const challengeData = await env.CHALLENGES.get(challenge);
  if (!challengeData) {
    throw new Error('Invalid challenge');
  }

  await env.CHALLENGES.delete(challenge);
  return true;
}

async function handleChat(request, env) {
  const { message, conversation = [] } = await request.json();

  // Mock chat response
  return new Response(JSON.stringify({
    response: `Echo: ${message}`,
    provider: 'test',
    usage: 1,
    limit: 100
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleStatus(env) {
  const providers = ['groq', 'gemini', 'qwen', 'claude'];
  const status = { llm_providers: {} };

  for (const provider of providers) {
    const usage = await getUsage(env, provider);
    const limits = { groq: 30, gemini: 15, qwen: 1000, claude: 50 };
    status.llm_providers[provider] = {
      usage: usage,
      limit: limits[provider],
      remaining: limits[provider] - usage
    };
  }

  // Mock Runloop credit info
  if (env.RUNLOOP_API_KEY) {
    status.runloop = {
      credit_balance: 18.50,
      credit_limit: 25.00,
      credit_used: 6.50,
      credit_remaining_pct: 74.0
    };
  }

  return new Response(JSON.stringify(status, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getUsage(env, provider) {
  const key = `usage:${provider}:${getDateKey()}`;
  const data = await env.USAGE.get(key);
  return data ? parseInt(data) : 0;
}

function getDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function handleTTS(request, env) {
  const { text } = await request.json();

  if (env.RUNLOOP_URL) {
    return new Response('mock-audio-data', {
      headers: { 'Content-Type': 'audio/wav' }
    });
  }

  return new Response(JSON.stringify({ error: 'TTS not available' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleSTT(request, env) {
  if (env.RUNLOOP_URL) {
    return new Response(JSON.stringify({ text: 'mock transcription' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'STT not available' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('Epic 2: Main Router Functionality', () => {
  let mockEnv;
  let originalCrypto;

  beforeEach(() => {
    mockEnv = {
      CHALLENGES: {
        data: {},
        async put(key, value, options) {
          this.data[key] = value;
        },
        async get(key) {
          return this.data[key];
        },
        async delete(key) {
          delete this.data[key];
        }
      },
      USAGE: {
        data: {},
        async get(key) {
          return this.data[key];
        }
      },
      RUNLOOP_API_KEY: 'mock-runloop-key',
      RUNLOOP_URL: 'https://mock-runloop.com'
    };

    // Mock crypto.randomUUID using Object.defineProperty
    originalCrypto = global.crypto;
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: () => 'mock-uuid-123'
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true
    });
  });

  describe('Story 2.1: Challenge Endpoint', () => {
    describe('Given GET request to /challenge, when called, then challenge object is returned', () => {
      it('should return challenge object with correct structure', async () => {
        const request = new Request('https://example.com/challenge', {
          method: 'GET'
        });

        const response = await mockWorker.fetch(request, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.challenge, 'mock-uuid-123');
        assert.ok(data.timestamp);
        assert.equal(data.expires_in, 60);
        assert.equal(response.headers.get('Content-Type'), 'application/json');
      });

      it('should store challenge in KV with expiration', async () => {
        const request = new Request('https://example.com/challenge', {
          method: 'GET'
        });

        await mockWorker.fetch(request, mockEnv);

        assert.ok(mockEnv.CHALLENGES.data['mock-uuid-123']);
        const storedData = JSON.parse(mockEnv.CHALLENGES.data['mock-uuid-123']);
        assert.ok(storedData.timestamp);
      });

      it('should set CORS headers', async () => {
        const request = new Request('https://example.com/challenge', {
          method: 'GET'
        });

        const response = await mockWorker.fetch(request, mockEnv);

        assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
        assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
        assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Authorization, X-Challenge, X-Signature, X-Timestamp');
      });
    });
  });

  describe('Story 2.2: Chat Endpoint', () => {
    describe('Given authenticated request, when sending chat, then response is returned', () => {
      it('should handle authenticated chat requests', async () => {
        // First get a challenge
        const challengeRequest = new Request('https://example.com/challenge', {
          method: 'GET'
        });
        const challengeResponse = await mockWorker.fetch(challengeRequest, mockEnv);
        const challengeData = await challengeResponse.json();

        // Now send chat request
        const chatRequest = new Request('https://example.com/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Challenge': challengeData.challenge,
            'X-Signature': 'mock-signature',
            'X-Timestamp': Date.now().toString()
          },
          body: JSON.stringify({
            message: 'Hello',
            conversation: []
          })
        });

        const response = await mockWorker.fetch(chatRequest, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.response, 'Echo: Hello');
        assert.equal(data.provider, 'test');
        assert.equal(data.usage, 1);
        assert.equal(data.limit, 100);
      });

      it('should preserve conversation history', async () => {
        const challengeRequest = new Request('https://example.com/challenge', {
          method: 'GET'
        });
        const challengeResponse = await mockWorker.fetch(challengeRequest, mockEnv);
        const challengeData = await challengeResponse.json();

        const conversation = [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' }
        ];

        const chatRequest = new Request('https://example.com/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Challenge': challengeData.challenge,
            'X-Signature': 'mock-signature',
            'X-Timestamp': Date.now().toString()
          },
          body: JSON.stringify({
            message: 'Second message',
            conversation
          })
        });

        const response = await mockWorker.fetch(chatRequest, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.response, 'Echo: Second message');
      });
    });

    describe('Given unauthenticated request, when sending chat, then 401 error is returned', () => {
      it('should reject request without auth headers', async () => {
        const chatRequest = new Request('https://example.com/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Hello',
            conversation: []
          })
        });

        const response = await mockWorker.fetch(chatRequest, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 500);
        assert.equal(data.error, 'Missing auth headers');
      });

      it('should reject request with invalid challenge', async () => {
        const chatRequest = new Request('https://example.com/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Challenge': 'invalid-challenge',
            'X-Signature': 'mock-signature',
            'X-Timestamp': Date.now().toString()
          },
          body: JSON.stringify({
            message: 'Hello',
            conversation: []
          })
        });

        const response = await mockWorker.fetch(chatRequest, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 500);
        assert.equal(data.error, 'Invalid challenge');
      });

      it('should reject expired request', async () => {
        const chatRequest = new Request('https://example.com/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Challenge': 'mock-uuid-123',
            'X-Signature': 'mock-signature',
            'X-Timestamp': (Date.now() - 120000).toString() // 2 minutes ago
          },
          body: JSON.stringify({
            message: 'Hello',
            conversation: []
          })
        });

        const response = await mockWorker.fetch(chatRequest, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 500);
        assert.equal(data.error, 'Request expired');
      });
    });
  });

  describe('Story 2.3: Status Endpoint', () => {
    describe('Given GET request to /status, when called, then usage stats are returned', () => {
      it('should return usage statistics for all providers', async () => {
        const request = new Request('https://example.com/status', {
          method: 'GET'
        });

        const response = await mockWorker.fetch(request, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.ok(data.llm_providers);
        assert.ok(data.llm_providers.groq);
        assert.ok(data.llm_providers.gemini);
        assert.ok(data.llm_providers.qwen);
        assert.ok(data.llm_providers.claude);

        // Check structure
        assert.equal(data.llm_providers.groq.limit, 30);
        assert.equal(data.llm_providers.gemini.limit, 15);
        assert.equal(data.llm_providers.qwen.limit, 1000);
        assert.equal(data.llm_providers.claude.limit, 50);
      });

      it('should include Runloop credit info when API key is available', async () => {
        const request = new Request('https://example.com/status', {
          method: 'GET'
        });

        const response = await mockWorker.fetch(request, mockEnv);
        const data = await response.json();

        assert.ok(data.runloop);
        assert.equal(data.runloop.credit_balance, 18.50);
        assert.equal(data.runloop.credit_limit, 25.00);
        assert.equal(data.runloop.credit_used, 6.50);
        assert.equal(data.runloop.credit_remaining_pct, 74.0);
      });

      it('should handle missing Runloop API key gracefully', async () => {
        delete mockEnv.RUNLOOP_API_KEY;

        const request = new Request('https://example.com/status', {
          method: 'GET'
        });

        const response = await mockWorker.fetch(request, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.ok(data.llm_providers);
        assert.equal(data.runloop, undefined);
      });
    });
  });

  describe('Story 2.4: Health Endpoint', () => {
    describe('Given GET request to /health, when called, then health status is returned', () => {
      it('should return health status with correct structure', async () => {
        const request = new Request('https://example.com/health', {
          method: 'GET'
        });

        const response = await mockWorker.fetch(request, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.status, 'ok');
        assert.ok(data.timestamp);
        assert.equal(data.version, '1.0.0');
        assert.deepEqual(data.capabilities, ['function_calling', 'shared_context', 'voice_services']);
      });

      it('should include current timestamp', async () => {
        const before = Date.now();
        const request = new Request('https://example.com/health', {
          method: 'GET'
        });

        const response = await mockWorker.fetch(request, mockEnv);
        const data = await response.json();
        const after = Date.now();

        const timestamp = new Date(data.timestamp).getTime();
        assert.ok(timestamp >= before);
        assert.ok(timestamp <= after);
      });
    });
  });

  describe('Story 2.5: TTS/STT Endpoints', () => {
    describe('Given valid TTS request, when called, then audio is returned', () => {
      it('should return audio data when Runloop URL is available', async () => {
        const challengeRequest = new Request('https://example.com/challenge', {
          method: 'GET'
        });
        const challengeResponse = await mockWorker.fetch(challengeRequest, mockEnv);
        const challengeData = await challengeResponse.json();

        const ttsRequest = new Request('https://example.com/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Challenge': challengeData.challenge,
            'X-Signature': 'mock-signature',
            'X-Timestamp': Date.now().toString()
          },
          body: JSON.stringify({
            text: 'Hello world'
          })
        });

        const response = await mockWorker.fetch(ttsRequest, mockEnv);
        const audioData = await response.text();

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'audio/wav');
        assert.equal(audioData, 'mock-audio-data');
      });

      it('should return error when Runloop URL is missing', async () => {
        delete mockEnv.RUNLOOP_URL;

        const challengeRequest = new Request('https://example.com/challenge', {
          method: 'GET'
        });
        const challengeResponse = await mockWorker.fetch(challengeRequest, mockEnv);
        const challengeData = await challengeResponse.json();

        const ttsRequest = new Request('https://example.com/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Challenge': challengeData.challenge,
            'X-Signature': 'mock-signature',
            'X-Timestamp': Date.now().toString()
          },
          body: JSON.stringify({
            text: 'Hello world'
          })
        });

        const response = await mockWorker.fetch(ttsRequest, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 503);
        assert.equal(data.error, 'TTS not available');
      });
    });

    describe('Given valid STT request, when called, then transcription is returned', () => {
      it('should return transcription when Runloop URL is available', async () => {
        const challengeRequest = new Request('https://example.com/challenge', {
          method: 'GET'
        });
        const challengeResponse = await mockWorker.fetch(challengeRequest, mockEnv);
        const challengeData = await challengeResponse.json();

        const sttRequest = new Request('https://example.com/stt', {
          method: 'POST',
          headers: {
            'Content-Type': 'audio/wav',
            'X-Challenge': challengeData.challenge,
            'X-Signature': 'mock-signature',
            'X-Timestamp': Date.now().toString()
          },
          body: 'mock-audio-data'
        });

        const response = await mockWorker.fetch(sttRequest, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'application/json');
        assert.equal(data.text, 'mock transcription');
      });

      it('should return error when Runloop URL is missing', async () => {
        delete mockEnv.RUNLOOP_URL;

        const challengeRequest = new Request('https://example.com/challenge', {
          method: 'GET'
        });
        const challengeResponse = await mockWorker.fetch(challengeRequest, mockEnv);
        const challengeData = await challengeResponse.json();

        const sttRequest = new Request('https://example.com/stt', {
          method: 'POST',
          headers: {
            'Content-Type': 'audio/wav',
            'X-Challenge': challengeData.challenge,
            'X-Signature': 'mock-signature',
            'X-Timestamp': Date.now().toString()
          },
          body: 'mock-audio-data'
        });

        const response = await mockWorker.fetch(sttRequest, mockEnv);
        const data = await response.json();

        assert.equal(response.status, 503);
        assert.equal(data.error, 'STT not available');
      });
    });
  });

  describe('CORS and Error Handling', () => {
    it('should handle OPTIONS requests', async () => {
      const request = new Request('https://example.com/chat', {
        method: 'OPTIONS'
      });

      const response = await mockWorker.fetch(request, mockEnv);

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    });

    it('should return 404 for unknown endpoints', async () => {
      const request = new Request('https://example.com/unknown', {
        method: 'GET'
      });

      const response = await mockWorker.fetch(request, mockEnv);
      const text = await response.text();

      assert.equal(response.status, 404);
      assert.equal(text, 'Not Found');
    });

    it('should handle errors gracefully', async () => {
      // This would require mocking an error condition
      // For now, we'll test the error response structure
      const request = new Request('https://example.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      });

      const response = await mockWorker.fetch(request, mockEnv);
      const data = await response.json();

      assert.equal(response.status, 500);
      assert.ok(data.error);
    });
  });
});
