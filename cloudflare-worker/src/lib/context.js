/**
 * Context management for conversation history and shared state
 * 
 * Provides persistent storage for conversation context across requests.
 */

/**
 * Retrieve shared context for a session
 * 
 * @param {KVNamespace} contextStore - KV namespace for context storage
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<Object>} Context object or empty object if none exists
 */
export async function getSharedContext(contextStore, sessionId) {
  if (!contextStore) return {};
  const contextKey = `context:${sessionId}`;
  const contextData = await contextStore.get(contextKey);
  return contextData ? JSON.parse(contextData) : {};
}

/**
 * Save a key-value pair to session context
 * 
 * Merges new data with existing context without overwriting other keys.
 * 
 * @param {string} key - Context key to save
 * @param {*} value - Value to save (will be JSON serialized)
 * @param {KVNamespace} contextStore - KV namespace for context storage
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<{success: boolean, message?: string, error?: string}>} Result object
 */
export async function saveContext(key, value, contextStore, sessionId) {
  if (!contextStore) {
    return { error: 'Context storage not available' };
  }

  const contextKey = `context:${sessionId}`;
  const currentContext = await getSharedContext(contextStore, sessionId);
  currentContext[key] = value;
  await contextStore.put(contextKey, JSON.stringify(currentContext));
  return { success: true, message: `Saved ${key} to context` };
}
