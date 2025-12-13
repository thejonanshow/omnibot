/**
 * Conversation storage utilities
 * 
 * Provides KV-based conversation/session storage for CLI and web UI.
 */

/**
 * Generate a unique conversation ID
 * 
 * @returns {string} Unique conversation ID
 */
export function generateConversationId() {
  // Use crypto.randomUUID() for cryptographically secure, unpredictable IDs
  return `conv_${crypto.randomUUID()}`;
}

/**
 * Get a conversation from KV storage
 * 
 * @param {string} conversationId - Conversation ID
 * @param {Object} env - Environment bindings including CONTEXT KV
 * @returns {Promise<Array>} Array of messages, or empty array if not found
 */
export async function getConversation(conversationId, env) {
  if (!conversationId || !env.CONTEXT) {
    return [];
  }

  try {
    const key = `conversation_${conversationId}`;
    const dataJson = await env.CONTEXT.get(key);
    if (!dataJson) {
      return [];
    }

    const data = JSON.parse(dataJson);
    return data.messages || [];
  } catch (e) {
    console.error('Error getting conversation:', e);
    return [];
  }
}

/**
 * Save a conversation to KV storage
 * 
 * @param {string} conversationId - Conversation ID
 * @param {Array} messages - Array of messages to save
 * @param {Object} env - Environment bindings including CONTEXT KV
 * @param {number} expirationTtl - TTL in seconds (default: 24 hours)
 * @returns {Promise<boolean>} True if successful
 */
export async function saveConversation(conversationId, messages, env, expirationTtl = 86400) {
  if (!conversationId || !env.CONTEXT) {
    return false;
  }

  try {
    const key = `conversation_${conversationId}`;
    const data = {
      messages,
      updated_at: Date.now()
    };

    await env.CONTEXT.put(key, JSON.stringify(data), {
      expirationTtl
    });

    return true;
  } catch (e) {
    console.error('Error saving conversation:', e);
    return false;
  }
}

/**
 * Delete a conversation from KV storage
 * 
 * @param {string} conversationId - Conversation ID
 * @param {Object} env - Environment bindings including CONTEXT KV
 * @returns {Promise<boolean>} True if successful
 */
export async function deleteConversation(conversationId, env) {
  if (!conversationId || !env.CONTEXT) {
    return false;
  }

  try {
    const key = `conversation_${conversationId}`;
    await env.CONTEXT.delete(key);
    return true;
  } catch (e) {
    console.error('Error deleting conversation:', e);
    return false;
  }
}

/**
 * List recent conversations for a user
 * 
 * @param {string} userId - User ID
 * @param {Object} env - Environment bindings including CONTEXT KV
 * @param {number} limit - Maximum number of conversations to return
 * @returns {Promise<Array>} Array of conversation metadata
 */
export async function listConversations(userId, env, limit = 10) {
  if (!userId || !env.CONTEXT) {
    return [];
  }

  try {
    // Note: KV doesn't have a great way to list by prefix efficiently
    // This is a simplified implementation that could be enhanced with
    // a separate index in production
    const indexKey = `user_conversations_${userId}`;
    const indexJson = await env.CONTEXT.get(indexKey);
    
    if (!indexJson) {
      return [];
    }

    const index = JSON.parse(indexJson);
    return index.conversations.slice(0, limit);
  } catch (e) {
    console.error('Error listing conversations:', e);
    return [];
  }
}

/**
 * Add a conversation to user's index
 * 
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @param {Object} metadata - Conversation metadata (title, created_at, etc.)
 * @param {Object} env - Environment bindings including CONTEXT KV
 * @returns {Promise<boolean>} True if successful
 */
export async function indexConversation(userId, conversationId, metadata, env) {
  if (!userId || !conversationId || !env.CONTEXT) {
    return false;
  }

  try {
    const indexKey = `user_conversations_${userId}`;
    const indexJson = await env.CONTEXT.get(indexKey);
    
    const index = indexJson ? JSON.parse(indexJson) : { conversations: [] };
    
    // Add or update conversation in index
    const existingIndex = index.conversations.findIndex(c => c.id === conversationId);
    const conversationEntry = {
      id: conversationId,
      ...metadata,
      updated_at: Date.now()
    };

    if (existingIndex >= 0) {
      index.conversations[existingIndex] = conversationEntry;
    } else {
      index.conversations.unshift(conversationEntry);
    }

    // Keep only the most recent 100 conversations in the index
    index.conversations = index.conversations.slice(0, 100);

    await env.CONTEXT.put(indexKey, JSON.stringify(index), {
      expirationTtl: 2592000 // 30 days
    });

    return true;
  } catch (e) {
    console.error('Error indexing conversation:', e);
    return false;
  }
}
