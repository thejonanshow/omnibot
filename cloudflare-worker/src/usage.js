/**
 * Usage tracking module for OmniBot
 * Tracks API usage across different providers
 */

// Buffer for batching usage updates
const usageBuffer = new Map();
let bufferTimeout = null;

/**
 * Get usage for a specific provider
 */
export async function getUsage(env, provider) {
  if (!env.USAGE) {
    return 0;
  }
  
  try {
    const key = `usage:${provider}:${getDateKey()}`;
    const data = await env.USAGE.get(key);
    return data ? parseInt(data) : 0;
  } catch (error) {
    console.error(`Error getting usage for ${provider}:`, error);
    return 0;
  }
}

/**
 * Flush usage buffer to KV
 */
async function flushUsageBuffer(env) {
  if (usageBuffer.size === 0) return;
  
  const updates = [];
  for (const [key, count] of usageBuffer.entries()) {
    updates.push(getUsage(env, key.split(':')[1]).then(current => {
      const newUsage = current + count;
      return env.USAGE.put(key, newUsage.toString(), { expirationTtl: 86400 });
    }));
  }
  
  await Promise.all(updates);
  usageBuffer.clear();
  bufferTimeout = null;
}

/**
 * Increment usage for a specific provider (batched)
 */
export async function incrementUsage(env, provider, increment = 1) {
  if (!env.USAGE) {
    console.warn('USAGE not available, skipping increment');
    return;
  }
  
  try {
    const key = `usage:${provider}:${getDateKey()}`;
    
    // Add to buffer
    usageBuffer.set(key, (usageBuffer.get(key) || 0) + increment);
    
    // Schedule buffer flush if not already scheduled
    if (!bufferTimeout) {
      bufferTimeout = setTimeout(() => flushUsageBuffer(env), 1000); // Flush after 1 second
    }
    
    return (await getUsage(env, provider)) + increment;
  } catch (error) {
    console.error(`Error incrementing usage for ${provider}:`, error);
    return 0;
  }
}

/**
 * Get usage for all providers
 */
export async function getAllUsage(env) {
  const providers = ['groq', 'gemini', 'qwen', 'claude'];
  const usage = {};
  
  for (const provider of providers) {
    usage[provider] = await getUsage(env, provider);
  }
  
  return usage;
}

/**
 * Reset usage for a specific provider
 */
export async function resetUsage(env, provider) {
  if (!env.USAGE) {
    return false;
  }
  
  try {
    const key = `usage:${provider}:${getDateKey()}`;
    await env.USAGE.delete(key);
    return true;
  } catch (error) {
    console.error(`Error resetting usage for ${provider}:`, error);
    return false;
  }
}

/**
 * Get date key for usage tracking (YYYY-MM-DD)
 */
export function getDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Check if provider is at limit
 */
export async function isAtLimit(env, provider) {
  const usage = await getUsage(env, provider);
  const limits = { groq: 30, gemini: 15, qwen: 1000, claude: 50 };
  return usage >= limits[provider];
}

/**
 * Get remaining usage for provider
 */
export async function getRemainingUsage(env, provider) {
  const usage = await getUsage(env, provider);
  const limits = { groq: 30, gemini: 15, qwen: 1000, claude: 50 };
  return Math.max(0, limits[provider] - usage);
}

export default {
  getUsage,
  incrementUsage,
  getAllUsage,
  resetUsage,
  getDateKey,
  isAtLimit,
  getRemainingUsage
};