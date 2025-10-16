/**
 * Context management
 */

export async function getSharedContext(contextStore, sessionId) {
  if (!contextStore) return {};
  const contextKey = `context:${sessionId}`;
  const contextData = await contextStore.get(contextKey);
  return contextData ? JSON.parse(contextData) : {};
}

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
