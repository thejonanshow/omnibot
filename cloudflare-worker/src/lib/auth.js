/**
 * Authentication utilities for HMAC-based request verification
 * 
 * Provides challenge-response authentication to prevent replay attacks.
 * Challenges are stored in KV with 60-second TTL.
 */

/**
 * Generate a unique authentication challenge
 * 
 * @param {KVNamespace} challengeStore - Cloudflare KV namespace for storing challenges
 * @returns {Promise<{challenge: string, timestamp: number, expires_in: number}>} Challenge object
 */
export async function generateChallenge(challengeStore) {
  const challenge = crypto.randomUUID();
  const timestamp = Date.now();

  await challengeStore.put(challenge, JSON.stringify({ timestamp }), {
    expirationTtl: 60
  });

  return {
    challenge,
    timestamp,
    expires_in: 60
  };
}

/**
 * Verify an authenticated request
 * 
 * Validates HMAC signature and ensures challenge hasn't been used before.
 * Challenges are deleted after use to prevent replay attacks.
 * 
 * @param {Request} request - HTTP request with auth headers
 * @param {KVNamespace} challengeStore - KV namespace for challenges
 * @param {string} secret - HMAC secret for signature verification
 * @returns {Promise<boolean>} True if request is valid
 * @throws {Error} If authentication fails
 */
export async function verifyRequest(request, challengeStore, secret) {
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

  const challengeData = await challengeStore.get(challenge);
  if (!challengeData) {
    throw new Error('Invalid challenge');
  }

  // Verify HMAC signature
  const message = `${challenge}:${timestamp}:${request.url}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  await challengeStore.delete(challenge);

  return true;
}
