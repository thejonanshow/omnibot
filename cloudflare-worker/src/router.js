/**
 * Router module for OmniBot
 * Handles HTTP request routing and main application logic
 */

import { 
  getGoogleAuthUrl, 
  exchangeCodeForToken, 
  getGoogleUserInfo, 
  createSessionToken, 
  verifySessionToken,
  generateOAuthState,
  validateOAuthState,
  generateChallenge,
  verifyRequest
} from './auth.js';
import { 
  validateEditInput, 
  DistributedLock,
  RateLimiter
} from './security.js';
import { 
  VERSION_FULL, 
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  LOCK_TIMEOUT_MS,
  LOCK_RETRY_DELAY_MS
} from './config.js';
import { callAI } from './ai.js';
import { selfEdit } from './editor.js';
import { getSharedContext, saveContext } from './context.js';
import { getUsage } from './usage.js';
import { logTelemetry } from './telemetry.js';
import { renderUI } from './ui.js';

// Initialize rate limiters
const rateLimiter = new RateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);

/**
 * Main router function
 */
// Precompute CORS headers for performance
const BASE_CORS = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Challenge, X-Signature, X-Timestamp'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

const CORS_HEADERS = { ...BASE_CORS, ...SECURITY_HEADERS };

export async function handleRequest(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const cors = CORS_HEADERS;
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }
  
  const baseUrl = url.origin;
  const redirectUri = `${baseUrl}/auth/callback`;
  
  try {
    // ===== OAuth Routes =====
    
    // Start Google OAuth
    if (url.pathname === '/auth/google') {
      // Generate state parameter for CSRF protection
      const state = await generateOAuthState(env);
      const authUrl = getGoogleAuthUrl(env, redirectUri, state);
      return Response.redirect(authUrl, 302);
    }
    
    // OAuth callback
    if (url.pathname === '/auth/callback') {
      return await handleOAuthCallback(url, env, redirectUri, cors);
    }
    
    // ===== API Routes =====
    
    // Health check
    if (url.pathname === '/health') {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: VERSION_FULL,
        uptime: Math.floor(Date.now() / 1000),
        checks: {}
      };
      
      // Check KV stores
      try {
        await env.CONTEXT.get('health-check');
        health.checks.kv_context = 'ok';
      } catch (e) {
        health.checks.kv_context = 'error';
        health.status = 'degraded';
      }
      
      try {
        await env.CHALLENGES.get('health-check');
        health.checks.kv_challenges = 'ok';
      } catch (e) {
        health.checks.kv_challenges = 'error';
        health.status = 'degraded';
      }
      
      // Check required environment variables
      health.checks.env = {
        has_session_secret: !!env.SESSION_SECRET,
        has_google_client_id: !!env.GOOGLE_CLIENT_ID,
        has_ai_providers: !!(env.GROQ_API_KEY || env.GEMINI_API_KEY || env.ANTHROPIC_API_KEY)
      };
      
      return new Response(JSON.stringify(health), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    // Challenge endpoint
    if (url.pathname === '/challenge') {
      const challenge = await generateChallenge(env);
      return new Response(JSON.stringify(challenge), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    // Status endpoint
    if (url.pathname === '/status') {
      return await handleStatus(env, cors);
    }
    
    // Chat endpoint
    if (url.pathname === '/chat') {
      return await handleChat(request, env, cors);
    }
    
    // Edit endpoint (self-editing)
    if (url.pathname === '/edit') {
      return await handleEdit(request, env, cors);
    }
    
    // Context management endpoints
    if (url.pathname === '/api/context') {
      return await handleContext(request, env, cors);
    }
    
    if (url.pathname === '/api/prompt') {
      return await handlePrompt(request, env, cors);
    }
    
    // TTS/STT endpoints
    if (url.pathname === '/tts') {
      return await handleTTS(request, env, cors);
    }
    
    if (url.pathname === '/stt') {
      return await handleSTT(request, env, cors);
    }
    
    // ===== UI Routes =====
    
    // Main UI
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const sessionToken = url.searchParams.get('session');
      return await handleUI(sessionToken, env, cors);
    }
    
    // Static assets
    if (url.pathname.startsWith('/assets/')) {
      return await handleStaticAsset(url.pathname, cors);
    }
    
    // 404 for unknown routes
    return new Response('Not Found', { status: 404, headers: cors });
    
  } catch (error) {
    console.error('Router error:', error);
    const errorResponse = {
      error: error.message,
      code: 'INTERNAL_ERROR',
      requestId,
      timestamp: new Date().toISOString(),
      path: url.pathname,
      method: request.method
    };
    
    // Add stack trace in development
    if (env.ENVIRONMENT === 'development') {
      errorResponse.stack = error.stack;
    }
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle OAuth callback
 */
async function handleOAuthCallback(url, env, redirectUri, _cors) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  
  if (error) {
    return new Response(`Auth error: ${error}`, { status: 400 });
  }
  
  if (!code) {
    return new Response('No code provided', { status: 400 });
  }
  
  // Validate state parameter for CSRF protection
  try {
    await validateOAuthState(state, env);
  } catch (stateError) {
    return new Response(`State validation error: ${stateError.message}`, { status: 400 });
  }
  
  // Exchange code for token
  const tokenData = await exchangeCodeForToken(code, env, redirectUri);
  
  if (tokenData.error) {
    return new Response(`Token error: ${tokenData.error_description || tokenData.error}`, { status: 400 });
  }
  
  // Get user info
  const userInfo = await getGoogleUserInfo(tokenData.access_token);
  
  if (userInfo.email !== env.ALLOWED_EMAIL) {
    return new Response(`Access denied. Only ${env.ALLOWED_EMAIL} can access this app.`, { 
      status: 403,
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // Create session
  const sessionToken = await createSessionToken(userInfo.email, env);
  
  await logTelemetry('login', { email: userInfo.email }, env);
  
  // Redirect to app with session (email not included in URL for security)
  const baseUrl = url.origin;
  return Response.redirect(`${baseUrl}/?session=${encodeURIComponent(sessionToken)}`, 302);
}

/**
 * Handle status endpoint
 */
async function handleStatus(env, cors) {
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
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle chat endpoint
 */
async function handleChat(request, env, cors) {
  await verifyRequest(request, env);
  
  const { message, conversation = [] } = await request.json();
  
  // Rate limiting
  const rateLimit = await rateLimiter.checkLimit('chat', env);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      reset_time: new Date(rateLimit.resetTime).toISOString()
    }), {
      status: 429,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  
  const response = await callAI(message, conversation, env, 'chat');
  
  return new Response(JSON.stringify(response), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle edit endpoint (self-editing)
 */
async function handleEdit(request, env, cors) {
  await verifyRequest(request, env);
  
  const { instruction, options = {} } = await request.json();
  
  // Validate input
  const validation = validateEditInput(instruction, options);
  if (!validation.isValid) {
    return new Response(JSON.stringify({ 
      error: 'Invalid input',
      details: validation.errors 
    }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  
  // Rate limiting
  const rateLimit = await rateLimiter.checkLimit('edit', env);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      reset_time: new Date(rateLimit.resetTime).toISOString()
    }), {
      status: 429,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  
  // Use distributed locking to prevent concurrent edits
  const lock = new DistributedLock(env, LOCK_TIMEOUT_MS, LOCK_RETRY_DELAY_MS);
  const lockKey = 'self-edit-lock';
  const ownerId = `edit-${Date.now()}`;
  
  try {
    const result = await lock.withLock(lockKey, ownerId, async () => {
      return await selfEdit(instruction, options, env);
    });
    
    return new Response(JSON.stringify(result), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error.message.includes('Failed to acquire lock')) {
      return new Response(JSON.stringify({ 
        error: 'Another edit is in progress. Please try again in a few moments.' 
      }), {
        status: 409,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

/**
 * Handle context management
 */
async function handleContext(request, env, cors) {
  if (request.method === 'GET') {
    const context = await getSharedContext(env);
    return new Response(JSON.stringify({ prompt: context.masterPrompt || '' }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  
  if (request.method === 'POST') {
    await verifyRequest(request, env);
    const { prompt } = await request.json();
    await saveContext('masterPrompt', prompt, env);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405, headers: cors });
}

/**
 * Handle prompt management
 */
async function handlePrompt(request, env, cors) {
  if (request.method === 'POST') {
    await verifyRequest(request, env);
    const { prompt } = await request.json();
    await saveContext('masterPrompt', prompt, env);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405, headers: cors });
}

/**
 * Handle TTS endpoint
 */
async function handleTTS(request, env, cors) {
  await verifyRequest(request, env);
  
  const { text: _text } = await request.json();
  
  if (env.RUNLOOP_URL) {
    return new Response('mock-audio-data', {
      headers: { ...cors, 'Content-Type': 'audio/wav' }
    });
  }
  
  return new Response(JSON.stringify({ error: 'TTS not available' }), {
    status: 503,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle STT endpoint
 */
async function handleSTT(request, env, cors) {
  await verifyRequest(request, env);
  
  if (env.RUNLOOP_URL) {
    return new Response(JSON.stringify({ text: 'mock transcription' }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ error: 'STT not available' }), {
    status: 503,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

/**
 * Handle UI rendering
 */
async function handleUI(sessionToken, env, cors) {
  if (sessionToken) {
    const session = await verifySessionToken(sessionToken, env);
    if (!session) {
      return Response.redirect('/', 302);
    }
  }
  
  const html = renderUI(sessionToken);
  return new Response(html, {
    headers: { 
      ...cors, 
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
    }
  });
}

/**
 * Handle static assets
 */
async function handleStaticAsset(pathname, cors) {
  // For now, return 404 for static assets
  // In a real implementation, you'd serve these from a CDN or KV store
  return new Response('Not Found', { status: 404, headers: cors });
}

export default { handleRequest };