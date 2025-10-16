/**
 * Provider configuration and selection
 */

export const PROVIDERS = [
  { name: 'groq', limit: 30, priority: 1, fallback: true },
  { name: 'gemini', limit: 15, priority: 2, fallback: true },
  { name: 'qwen', limit: 1000, priority: 3, fallback: true },
  { name: 'claude', limit: 50, priority: 4, fallback: false }
];

export async function selectProvider(providers, getUsageFn) {
  for (const provider of providers) {
    const usage = await getUsageFn(provider.name);
    if (usage < provider.limit) {
      return provider;
    }
  }
  return null;
}

export class ProviderRotationError extends Error {
  constructor(message, attemptedProviders) {
    super(message);
    this.name = 'ProviderRotationError';
    this.attemptedProviders = attemptedProviders;
  }
}
