/**
 * Context management module for OmniBot
 * Handles shared context storage and retrieval
 */

/**
 * Get shared context
 */
export async function getSharedContext(env) {
  if (!env.CONTEXT) {
    return {};
  }
  
  try {
    const contextData = await env.CONTEXT.get('shared_context');
    return contextData ? JSON.parse(contextData) : {};
  } catch (error) {
    console.error('Error getting shared context:', error);
    return {};
  }
}

/**
 * Save context data
 */
export async function saveContext(key, value, env) {
  if (!env.CONTEXT) {
    console.warn('CONTEXT not available, skipping save');
    return false;
  }
  
  try {
    const context = await getSharedContext(env);
    context[key] = value;
    
    await env.CONTEXT.put('shared_context', JSON.stringify(context));
    return true;
  } catch (error) {
    console.error('Error saving context:', error);
    return false;
  }
}

/**
 * Get specific context value
 */
export async function getContextValue(key, env) {
  const context = await getSharedContext(env);
  return context[key];
}

/**
 * Delete context key
 */
export async function deleteContext(key, env) {
  if (!env.CONTEXT) {
    return false;
  }
  
  try {
    const context = await getSharedContext(env);
    delete context[key];
    
    await env.CONTEXT.put('shared_context', JSON.stringify(context));
    return true;
  } catch (error) {
    console.error('Error deleting context:', error);
    return false;
  }
}

/**
 * Clear all context
 */
export async function clearContext(env) {
  if (!env.CONTEXT) {
    return false;
  }
  
  try {
    await env.CONTEXT.delete('shared_context');
    return true;
  } catch (error) {
    console.error('Error clearing context:', error);
    return false;
  }
}

export default {
  getSharedContext,
  saveContext,
  getContextValue,
  deleteContext,
  clearContext
};