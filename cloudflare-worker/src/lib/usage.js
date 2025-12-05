/**

- Usage tracking utilities for LLM provider rate limiting
- 
- This module provides functions to track and retrieve API usage
- across different LLM providers to enable intelligent rotation.
  */

/**

- Get the current date key for usage tracking (YYYY-MM-DD format)
- Usage resets daily at midnight UTC
- 
- @returns {string} Date key in YYYY-MM-DD format
  */
  export function getDateKey() {
  const now = new Date();
  return now.toISOString().split(‘T’)[0];
  }

/**

- Get current usage count for a provider
- 
- @param {KVNamespace} usageKV - Cloudflare KV namespace for usage data
- @param {string} provider - Provider name (groq, gemini, claude, qwen)
- @returns {Promise<number>} Current usage count for today
  */
  export async function getUsage(usageKV, provider) {
  if (!usageKV) {
  console.warn(`[Usage] KV namespace not available, returning 0 for ${provider}`);
  return 0;
  }

const key = `usage:${provider}:${getDateKey()}`;

try {
const value = await usageKV.get(key);
const usage = value ? parseInt(value, 10) : 0;

```
// Log for observability
console.log(`[Usage] ${provider}: ${usage} requests today (key: ${key})`);

return usage;
```

} catch (error) {
console.error(`[Usage] Error getting usage for ${provider}:`, error.message);
return 0;
}
}

/**

- Increment usage count for a provider
- 
- @param {KVNamespace} usageKV - Cloudflare KV namespace for usage data
- @param {string} provider - Provider name
- @returns {Promise<number>} New usage count after increment
  */
  export async function incrementUsage(usageKV, provider) {
  if (!usageKV) {
  console.warn(`[Usage] KV namespace not available, cannot increment for ${provider}`);
  return 0;
  }

const key = `usage:${provider}:${getDateKey()}`;

try {
const current = await getUsage(usageKV, provider);
const newValue = current + 1;

```
// Store with 24-hour TTL (auto-cleanup)
await usageKV.put(key, newValue.toString(), {
  expirationTtl: 86400 // 24 hours in seconds
});

console.log(`[Usage] Incremented ${provider}: ${current} -> ${newValue}`);

return newValue;
```

} catch (error) {
console.error(`[Usage] Error incrementing usage for ${provider}:`, error.message);
return 0;
}
}

/**

- Get usage for all providers
- 
- @param {KVNamespace} usageKV - Cloudflare KV namespace
- @returns {Promise<Object>} Usage counts for all providers
  */
  export async function getAllUsage(usageKV) {
  const providers = [‘groq’, ‘gemini’, ‘claude’, ‘qwen’];
  const limits = { groq: 30, gemini: 15, claude: 50, qwen: 1000 };

const usage = {};

for (const provider of providers) {
const count = await getUsage(usageKV, provider);
usage[provider] = {
usage: count,
limit: limits[provider],
remaining: limits[provider] - count,
percentage: Math.round((count / limits[provider]) * 100)
};
}

return usage;
}

/**

- Check if a provider has capacity remaining
- 
- @param {KVNamespace} usageKV - Cloudflare KV namespace
- @param {string} provider - Provider name
- @param {number} limit - Usage limit for the provider
- @returns {Promise<boolean>} True if provider has capacity
  */
  export async function hasCapacity(usageKV, provider, limit) {
  const usage = await getUsage(usageKV, provider);
  const hasRoom = usage < limit;

if (!hasRoom) {
console.log(`[Usage] ${provider} at capacity: ${usage}/${limit}`);
}

return hasRoom;
}

/**

- Reset usage for a provider (admin function)
- 
- @param {KVNamespace} usageKV - Cloudflare KV namespace
- @param {string} provider - Provider name
- @returns {Promise<void>}
  */
  export async function resetUsage(usageKV, provider) {
  if (!usageKV) return;

const key = `usage:${provider}:${getDateKey()}`;

try {
await usageKV.delete(key);
console.log(`[Usage] Reset usage for ${provider}`);
} catch (error) {
console.error(`[Usage] Error resetting usage for ${provider}:`, error.message);
}
}