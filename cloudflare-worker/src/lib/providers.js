/**
 * LLM provider configuration and intelligent selection
 * 
 * Manages automatic rotation between multiple LLM providers based on
 * rate limits and usage quotas. Providers are tried in priority order.
 * 
 * @typedef {Object} Provider
 * @property {string} name - Provider identifier (groq, gemini, qwen, claude)
 * @property {number} limit - Daily request limit
 * @property {number} priority - Selection priority (lower = higher priority)
 * @property {boolean} fallback - Whether to use as fallback when others fail
 */

/**
 * Available LLM providers with usage limits and priorities
 * 
 * @type {Provider[]}
 */
export const PROVIDERS = [
  { name: 'groq', limit: 30, priority: 1, fallback: true },
  { name: 'gemini', limit: 15, priority: 2, fallback: true },
  { name: 'qwen', limit: 1000, priority: 3, fallback: true },
  { name: 'claude', limit: 50, priority: 4, fallback: false }
];

/**
 * Select the best available provider based on usage and limits
 * 
 * Iterates through providers in priority order and selects the first
 * one that hasn't exceeded its daily limit.
 * 
 * @param {Provider[]} providers - Array of provider configurations
 * @param {Function} getUsageFn - Async function to get usage count for a provider
 * @returns {Promise<Provider|null>} Selected provider or null if all exhausted
 */
export async function selectProvider(providers, getUsageFn) {
  for (const provider of providers) {
    const usage = await getUsageFn(provider.name);
    if (usage < provider.limit) {
      return provider;
    }
  }
  return null;
}

/**
 * Error thrown when all providers have been exhausted or failed
 */
export class ProviderRotationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string[]} attemptedProviders - List of providers that were tried
   */
  constructor(message, attemptedProviders) {
    super(message);
    this.name = 'ProviderRotationError';
    this.attemptedProviders = attemptedProviders;
  }
}
