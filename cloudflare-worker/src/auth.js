/**
 * Authentication module for OmniBot
 * Handles Google OAuth and session management
 */

import { 
  ALLOWED_EMAIL, 
  SESSION_DURATION_MS, 
  GOOGLE_AUTH_URL, 
  GOOGLE_TOKEN_URL, 
  GOOGLE_USERINFO_URL 
} from './config.js';

/**
 * Generate Google OAuth URL with state parameter
 */
export function getGoogleAuthUrl(env, redirectUri, state = null) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'online',
    prompt: 'select_account'
  });
  
  if (state) {
    params.set('state', state);
  }
  
  return `${GOOGLE_AUTH_URL}?${params}`;
}

/**
 * Exchange OAuth code for token
 */
export async function exchangeCodeForToken(code, env, redirectUri) {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  });

  return await tokenResponse.json();
}

/**
 * Get Google user info from access token
 */
export async function getGoogleUserInfo(accessToken) {
  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!userResponse.ok) {
    throw new Error('Failed to get user info');
  }

  return await userResponse.json();
}

/**
 * Create session token
 */
export async function createSessionToken(email, env) {
  const timestamp = Date.now();
  const data = JSON.stringify({ email, timestamp });
  
  // Create signature using HMAC
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureHex = [...new Uint8Array(signature)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${data}.${signatureHex}`;
}

/**
 * Verify session token
 */
export async function verifySessionToken(token, env) {
  try {
    const [data, signatureHex] = token.split('.');
    if (!data || !signatureHex) return null;
    
    const parsed = JSON.parse(data, (key, value) => {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
    
    const { email, timestamp } = parsed;
    
    // Check if session is expired
    if (Date.now() - timestamp > SESSION_DURATION_MS) {
      return null;
    }
    
    // Verify signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = new Uint8Array(
      signatureHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );
    
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
    
    if (!isValid) return null;
    
    // Check if email is allowed
    if (email !== ALLOWED_EMAIL) return null;
    
    return { email, timestamp };
  } catch (error) {
    return null;
  }
}

/**
 * Generate OAuth state parameter
 */
export async function generateOAuthState(env, sessionId = null) {
  const state = crypto.randomUUID();
  const timestamp = Date.now();
  const data = { state, timestamp, sessionId };
  
  // Store state with 10-minute expiration
  await env.CONTEXT.put(`oauth_state:${state}`, JSON.stringify(data), {
    expirationTtl: 600
  });
  
  return state;
}

/**
 * Validate OAuth state parameter
 */
export async function validateOAuthState(state, env) {
  if (!state) {
    const error = new Error('Missing state parameter');
    error.code = 'OAUTH_STATE_MISSING';
    throw error;
  }
  
  const stateData = await env.CONTEXT.get(`oauth_state:${state}`);
  if (!stateData) {
    const error = new Error('Invalid or expired state parameter');
    error.code = 'OAUTH_STATE_INVALID';
    throw error;
  }
  
  const data = JSON.parse(stateData);
  
  // Check if state is expired (10 minutes)
  if (Date.now() - data.timestamp > 600000) {
    await env.CONTEXT.delete(`oauth_state:${state}`);
    const error = new Error('State parameter expired');
    error.code = 'OAUTH_STATE_EXPIRED';
    throw error;
  }
  
  // Clean up used state
  await env.CONTEXT.delete(`oauth_state:${state}`);
  
  return data;
}

// UUID pool for better performance
const uuidPool = [];
const UUID_POOL_SIZE = 10;

// Pre-fill UUID pool
for (let i = 0; i < UUID_POOL_SIZE; i++) {
  uuidPool.push(crypto.randomUUID());
}

function getUUID() {
  // Return from pool and refill
  if (uuidPool.length === 0) {
    uuidPool.push(crypto.randomUUID());
  }
  return uuidPool.pop();
}

/**
 * Generate authentication challenge
 */
export async function generateChallenge(env) {
  const challenge = getUUID();
  const timestamp = Date.now();
  
  await env.CHALLENGES.put(challenge, JSON.stringify({ timestamp }), {
    expirationTtl: 60
  });
  
  return {
    challenge,
    timestamp,
    expires_in: 60
  };
}

/**
 * Verify request authentication
 */
export async function verifyRequest(request, env) {
  // Batch header extraction for better performance
  const headers = request.headers;
  const challenge = headers.get('X-Challenge');
  const signature = headers.get('X-Signature');
  const timestamp = headers.get('X-Timestamp');
  
  // Early validation with minimal branching
  if (!(challenge && signature && timestamp)) {
    const error = new Error('Missing auth headers');
    error.code = 'MISSING_HEADERS';
    throw error;
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
  
  // Verify signature using HMAC
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  // Optimized hex to bytes conversion
  const hexPairs = signature.match(/.{1,2}/g) || [];
  const signatureBytes = new Uint8Array(hexPairs.length);
  for (let i = 0; i < hexPairs.length; i++) {
    signatureBytes[i] = parseInt(hexPairs[i], 16);
  }
  
  const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(challenge));
  
  if (!isValid) {
    // Add small delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 100));
    const error = new Error('Invalid signature');
    error.code = 'INVALID_SIGNATURE';
    throw error;
  }
  
  return true;
}