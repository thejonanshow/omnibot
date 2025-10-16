/**
 * Authentication utilities
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

  await challengeStore.delete(challenge);

  return true;
}
