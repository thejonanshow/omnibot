/**
 * Omnibot Cloudflare Worker - Main Entry Point
 * Handles routing, authentication, and provider coordination
 */

import { generateChallenge, verifyRequest } from './lib/auth.js';
import { getUsage, incrementUsage } from './lib/usage.js';
import { isCodeImplementationRequest } from './lib/classifier.js';
import { PROVIDERS, selectProvider, ProviderRotationError } from './lib/providers.js';
import { getSharedContext, saveContext } from './lib/context.js';
import { handleUpgrade, getCodebaseContext } from './upgrade.js';
import { callGroq, callGemini, callQwen, callClaude } from './llm-providers.js';
import { handleFunctionCall } from './functions.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Challenge, X-Signature, X-Timestamp',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response;

      switch (url.pathname) {
        case '/challenge':
          response = await handleChallengeEndpoint(env);
          break;
        case '/chat':
          await verifyRequest(request, env.CHALLENGES, env.SHARED_SECRET);
          response = await handleChatEndpoint(request, env);
          break;
        case '/upgrade':
          await verifyRequest(request, env.CHALLENGES, env.SHARED_SECRET);
          const files = await getCodebaseContext(env);
          const body = await request.json();
          response = await handleUpgrade(
            new Request(request.url, {
              method: 'POST',
              body: JSON.stringify({ ...body, files })
            }),
            env
          );
          break;
        case '/tts':
          await verifyRequest(request, env.CHALLENGES, env.SHARED_SECRET);
          response = await handleTTS(request, env);
          break;
        case '/stt':
          await verifyRequest(request, env.CHALLENGES, env.SHARED_SECRET);
          response = await handleSTT(request, env);
          break;
        case '/status':
          response = await handleStatusEndpoint(env);
          break;
        case '/health':
          response = await handleHealthEndpoint();
          break;
        default:
          response = new Response('Not Found', { status: 404 });
      }

      Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function handleChallengeEndpoint(env) {
  const challenge = await generateChallenge(env.CHALLENGES);
  return new Response(JSON.stringify(challenge), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleChatEndpoint(request, env) {
  const { message, conversation = [], sessionId = 'default' } = await request.json();

  const providerFunctions = {
    groq: callGroq,
    gemini: callGemini,
    qwen: callQwen,
    claude: callClaude
  };

  const isCodeRequest = isCodeImplementationRequest(message);
  let lastError = null;
  let attemptedProviders = [];

  // Try providers in priority order
  for (const providerConfig of PROVIDERS) {
    const usage = await getUsage(env.USAGE, providerConfig.name);
    
    if (usage >= providerConfig.limit) {
      attemptedProviders.push(`${providerConfig.name} (limit reached: ${usage}/${providerConfig.limit})`);
      continue;
    }

    try {
      const providerFn = providerFunctions[providerConfig.name];
      const response = await providerFn(message, conversation, env, sessionId);
      await incrementUsage(env.USAGE, providerConfig.name);

      // Handle function calls
      if (response.choices && response.choices[0].message.function_call) {
        const functionCall = response.choices[0].message.function_call;
        const functionResult = await handleFunctionCall(
          functionCall.name,
          JSON.parse(functionCall.arguments),
          env,
          sessionId
        );

        // Send function result back to LLM
        const finalResponse = await providerFn(
          `Function ${functionCall.name} returned: ${JSON.stringify(functionResult)}`,
          [...conversation, response.choices[0].message],
          env,
          sessionId
        );

        return new Response(JSON.stringify({
          response: finalResponse.choices[0].message.content,
          provider: providerConfig.name,
          usage: usage + 1,
          limit: providerConfig.limit,
          function_calls: [functionCall.name]
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        response: response.choices ? response.choices[0].message.content : response,
        provider: providerConfig.name,
        usage: usage + 1,
        limit: providerConfig.limit,
        isCodeRequest: isCodeRequest
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      lastError = error;
      attemptedProviders.push(`${providerConfig.name} (error: ${error.message})`);
      console.error(`Provider ${providerConfig.name} failed:`, error.message);
      continue;
    }
  }

  // All providers failed
  return new Response(JSON.stringify({
    response: `I apologize, but I'm currently experiencing issues with all AI providers. Please try again in a few moments.`,
    provider: 'error',
    usage: 0,
    limit: 0,
    error: true,
    attemptedProviders: attemptedProviders
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleStatusEndpoint(env) {
  const status = {};
  for (const provider of PROVIDERS) {
    status[provider.name] = await getUsage(env.USAGE, provider.name);
  }
  return new Response(JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleHealthEndpoint() {
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    capabilities: ['function_calling', 'shared_context', 'voice_services']
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleTTS(request, env) {
  const { text } = await request.json();

  if (env.RUNLOOP_URL) {
    try {
      const response = await fetch(`${env.RUNLOOP_URL}/tts/piper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        return new Response(await response.arrayBuffer(), {
          headers: { 'Content-Type': 'audio/wav' }
        });
      }
    } catch (e) {
      console.error('TTS error:', e);
    }
  }

  return new Response(JSON.stringify({ error: 'TTS not available' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleSTT(request, env) {
  const audioData = await request.arrayBuffer();

  if (env.RUNLOOP_URL) {
    try {
      const response = await fetch(`${env.RUNLOOP_URL}/stt/whisper`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: audioData
      });

      if (response.ok) {
        return new Response(await response.text(), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (e) {
      console.error('STT error:', e);
    }
  }

  return new Response(JSON.stringify({ error: 'STT not available' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}
