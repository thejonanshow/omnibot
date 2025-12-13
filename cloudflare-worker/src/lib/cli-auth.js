/**
 * CLI authentication utilities
 * 
 * Provides Bearer token-based authentication for CLI access.
 * Tokens are stored in the CLI_TOKENS KV namespace.
 */

/**
 * Authenticate a CLI request using Bearer token
 * 
 * @param {Request} request - HTTP request with Authorization header
 * @param {Object} env - Environment bindings including CLI_TOKENS KV
 * @returns {Promise<Object|null>} User object { id, email, source, scopes } or null if invalid
 */
export async function authenticateCliRequest(request, env) {
  if (!env.CLI_TOKENS) {
    console.error('CLI_TOKENS KV namespace not configured');
    return null;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  if (!token || token.length < 10) {
    return null;
  }

  try {
    // Look up token in KV
    const tokenDataJson = await env.CLI_TOKENS.get(token);
    if (!tokenDataJson) {
      return null;
    }

    const tokenData = JSON.parse(tokenDataJson);
    
    // Check if token is expired
    if (tokenData.expires_at && tokenData.expires_at < Date.now()) {
      // Delete expired token
      await env.CLI_TOKENS.delete(token);
      return null;
    }

    // Return user object
    return {
      id: tokenData.id || tokenData.email || 'cli-user',
      email: tokenData.email || null,
      source: 'cli',
      scopes: tokenData.scopes || ['chat', 'whoami']
    };
  } catch (e) {
    console.error('Error authenticating CLI request:', e);
    return null;
  }
}

/**
 * Check if a user has a specific scope
 * 
 * @param {Object} user - User object from authenticateCliRequest
 * @param {string} scope - Scope to check (e.g., 'chat', 'edit')
 * @returns {boolean} True if user has the scope
 */
export function hasScope(user, scope) {
  if (!user || !user.scopes) {
    return false;
  }
  return user.scopes.includes(scope) || user.scopes.includes('*');
}
