/**
 * Simple, testable provider rotation system
 */

class ProviderRotation {
  constructor(providers, getUsage, incrementUsage) {
    this.providers = providers;
    this.getUsage = getUsage;
    this.incrementUsage = incrementUsage;
  }

  async selectProvider(message, isCodeRequest = false) {
    // Sort providers by priority
    let sortedProviders = [...this.providers].sort((a, b) => a.priority - b.priority);

    // Only prioritize Qwen for explicit coding requests
    if (isCodeRequest && message.toLowerCase().includes('code')) {
      sortedProviders = [...this.providers].sort((a, b) => {
        if (a.name === 'qwen' && b.name !== 'qwen') return -1;
        if (b.name === 'qwen' && a.name !== 'qwen') return 1;
        return a.priority - b.priority;
      });
    }

    // Find first available provider
    for (const provider of sortedProviders) {
      const currentUsage = await this.getUsage(provider.name);
      if (currentUsage < provider.limit) {
        return provider;
      }
    }

    return null; // All providers at limit
  }

  async executeWithProvider(message, conversation, env, sessionId) {
    const providers = [...this.providers].sort((a, b) => a.priority - b.priority);
    const isCodeRequest = this.isCodeRequest(message);

    // Only prioritize Qwen for explicit coding requests
    if (isCodeRequest && message.toLowerCase().includes('code')) {
      providers.sort((a, b) => {
        if (a.name === 'qwen' && b.name !== 'qwen') return -1;
        if (b.name === 'qwen' && a.name !== 'qwen') return 1;
        return a.priority - b.priority;
      });
    }

    let lastError = null;

    for (const provider of providers) {
      const usage = await this.getUsage(provider.name);
      if (usage >= provider.limit) {
        continue;
      }

      try {
        const response = await provider.fn(message, conversation, env, sessionId);
        await this.incrementUsage(provider.name);

        return {
          response,
          provider: provider.name,
          usage: usage + 1,
          limit: provider.limit
        };
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    throw new Error('All providers are at their usage limits');
  }

  isCodeRequest(message) {
    const codeKeywords = [
      'write code', 'implement', 'create a function', 'build a', 'develop',
      'programming', 'code', 'script', 'algorithm', 'function', 'class',
      'api', 'endpoint', 'database', 'sql', 'javascript', 'python', 'java',
      'react', 'vue', 'angular', 'node', 'express', 'flask', 'django',
      'html', 'css', 'typescript', 'json', 'xml', 'yaml', 'docker',
      'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'ansible'
    ];

    const messageLower = message.toLowerCase();
    return codeKeywords.some(keyword => messageLower.includes(keyword));
  }
}

module.exports = ProviderRotation;
