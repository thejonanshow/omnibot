/**
 * AI module for OmniBot
 * Handles AI provider calls and orchestration
 */

import { AI_PROVIDERS, DEFAULT_MASTER_PROMPT } from './config.js';
import { CircuitBreaker } from './security.js';
import { getUsage, incrementUsage } from './usage.js';
import { callQwen } from './llm-providers.js';

// Micro-cache for AI responses (5 second TTL)
const responseCache = new Map();
const CACHE_TTL = 5000;

// Request coalescing to prevent duplicate calls
const pendingRequests = new Map();

// Lazy cache cleanup function (called on each cache access)
function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      responseCache.delete(key);
    }
  }
}

// Initialize circuit breakers for each provider
const circuitBreakers = {
  groq: new CircuitBreaker(5, 60000),
  gemini: new CircuitBreaker(5, 60000),
  qwen: new CircuitBreaker(5, 60000),
  claude: new CircuitBreaker(5, 60000)
};

/**
 * Call AI with provider fallback
 */
export async function callAI(message, conversation, env, purpose = 'chat') {
  // Lazy cleanup of expired cache entries
  cleanupExpiredCache();
  
  // Create cache key from message and conversation hash
  const cacheKey = `${purpose}:${message}:${JSON.stringify(conversation)}`;
  
  // Check cache first
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.response;
  }
  
  // Check if identical request is already in flight
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }
  
  // Create promise for this request
  const requestPromise = (async () => {
    const providers = AI_PROVIDERS[purpose] || AI_PROVIDERS.chat;
    const attemptedProviders = [];
  
  for (const providerConfig of providers) {
    const { provider, model } = providerConfig;
    
    try {
      // Check usage limits
      const usage = await getUsage(env, provider);
      const limits = { groq: 30, gemini: 15, qwen: 1000, claude: 50 };
      
      if (usage >= limits[provider]) {
        console.log(`[${provider}] At limit (${usage}/${limits[provider]}), skipping`);
        attemptedProviders.push({ provider, reason: 'at_limit' });
        continue;
      }
      
      // Try to call the provider with circuit breaker
      let result;
      
      switch (provider) {
        case 'groq':
          result = await circuitBreakers.groq.execute(
            () => callGroq(message, conversation, env, model),
            env,
            'Groq'
          );
          break;
          
        case 'gemini':
          result = await circuitBreakers.gemini.execute(
            () => callGemini(message, conversation, env, model),
            env,
            'Gemini'
          );
          break;
          
        case 'qwen':
          result = await circuitBreakers.qwen.execute(
            () => callQwen(message, conversation, env, 'session'),
            env,
            'Qwen'
          );
          break;
          
        case 'claude':
          result = await circuitBreakers.claude.execute(
            () => callClaude(message, conversation, env, model),
            env,
            'Claude'
          );
          break;
          
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
      
      // Increment usage
      await incrementUsage(env, provider);
      
      console.log(`[AI] Success with ${provider} (${model})`);
      
      // Cache successful response
      const response = {
        ...result,
        provider,
        model
      };
      
      responseCache.set(cacheKey, {
        response,
        timestamp: Date.now()
      });
      
      return response;
      
    } catch (error) {
      console.error(`[${provider}] Failed: ${error.message}`);
      attemptedProviders.push({ provider, error: error.message });
      
      // Clear cache on error to prevent stale data
      if (responseCache.size > 100) {
        responseCache.clear();
      }
      
      continue;
    }
  }
  
  // All providers failed
  throw new Error(`All AI providers failed: ${attemptedProviders.map(p => `${p.provider}: ${p.error}`).join(', ')}`);
  })();
  
  // Store promise for coalescing
  pendingRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Always clean up pending request
    pendingRequests.delete(cacheKey);
  }
}

/**
 * Call Groq API
 */
async function callGroq(message, conversation, env, model) {
  if (!env.GROQ_API_KEY) {
    throw new Error('Groq API key not configured');
  }
  
  const messages = [
    { role: 'system', content: DEFAULT_MASTER_PROMPT },
    ...conversation,
    { role: 'user', content: message }
  ];
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.7
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq failed: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Call Gemini API
 */
async function callGemini(message, conversation, env, model) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }
  
  const messages = [
    { role: 'user', parts: [{ text: DEFAULT_MASTER_PROMPT }] },
    ...conversation.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096
        }
      })
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini failed: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  // Convert to OpenAI format
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: data.candidates[0].content.parts[0].text
      },
      finish_reason: data.candidates[0].finishReason
    }],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    }
  };
}

/**
 * Call Claude API (placeholder - not implemented)
 */
async function callClaude(_message, _conversation, _env, _model) {
  throw new Error('Claude API not implemented');
}

/**
 * Provider rotation error
 */
export class ProviderRotationError extends Error {
  constructor(message, attemptedProviders) {
    super(message);
    this.name = 'ProviderRotationError';
    this.attemptedProviders = attemptedProviders;
  }
}

export default {
  callAI,
  ProviderRotationError
};