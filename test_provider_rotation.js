#!/usr/bin/env node
/**
 * Unit tests for provider rotation logic
 */

// Mock the provider functions
const mockProviders = {
  groq: {
    name: 'groq',
    fn: async (message, conversation, env, sessionId) => {
      return {
        choices: [{
          message: {
            content: 'Groq response',
            role: 'assistant'
          }
        }]
      };
    },
    limit: 30,
    priority: 1,
    fallback: true
  },
  gemini: {
    name: 'gemini',
    fn: async (message, conversation, env, sessionId) => {
      return {
        choices: [{
          message: {
            content: 'Gemini response',
            role: 'assistant'
          }
        }]
      };
    },
    limit: 15,
    priority: 2,
    fallback: true
  },
  qwen: {
    name: 'qwen',
    fn: async (message, conversation, env, sessionId) => {
      return {
        choices: [{
          message: {
            content: 'Qwen response',
            role: 'assistant'
          }
        }]
      };
    },
    limit: 1000,
    priority: 3,
    fallback: true
  },
  claude: {
    name: 'claude',
    fn: async (message, conversation, env, sessionId) => {
      return {
        choices: [{
          message: {
            content: 'Claude response',
            role: 'assistant'
          }
        }]
      };
    },
    limit: 50,
    priority: 4,
    fallback: false
  }
};

// Mock usage tracking
const mockUsage = {
  groq: 0,
  gemini: 0,
  qwen: 0,
  claude: 0
};

const mockGetUsage = async (env, providerName) => {
  return mockUsage[providerName] || 0;
};

const mockIncrementUsage = async (env, providerName) => {
  mockUsage[providerName] = (mockUsage[providerName] || 0) + 1;
};

// Provider rotation logic
async function selectProvider(providers, usage, isCodeRequest = false, message = '') {
  // Sort providers by priority
  let sortedProviders = providers.sort((a, b) => a.priority - b.priority);

  // Only prioritize Qwen for explicit coding requests
  if (isCodeRequest && message.toLowerCase().includes('code')) {
    sortedProviders = providers.sort((a, b) => {
      if (a.name === 'qwen' && b.name !== 'qwen') return -1;
      if (b.name === 'qwen' && a.name !== 'qwen') return 1;
      return a.priority - b.priority;
    });
  }

  // Find first available provider
  for (const provider of sortedProviders) {
    const currentUsage = await mockGetUsage({}, provider.name);
    if (currentUsage < provider.limit) {
      return provider;
    }
  }

  return null; // All providers at limit
}

// Test cases
async function runTests() {
  console.log('🧪 Testing Provider Rotation Logic\n');

  // Test 1: Normal rotation (Groq -> Gemini -> Qwen -> Claude)
  console.log('Test 1: Normal rotation');
  mockUsage.groq = 0;
  mockUsage.gemini = 0;
  mockUsage.qwen = 0;
  mockUsage.claude = 0;

  const providers = [mockProviders.groq, mockProviders.gemini, mockProviders.qwen, mockProviders.claude];

  let provider = await selectProvider(providers, mockUsage, false);
  console.log(`  First request: ${provider.name} (expected: groq)`);
  await mockIncrementUsage({}, provider.name);

  provider = await selectProvider(providers, mockUsage, false);
  console.log(`  Second request: ${provider.name} (expected: groq)`);
  await mockIncrementUsage({}, provider.name);

  // Test 2: Groq at limit, should use Gemini
  console.log('\nTest 2: Groq at limit');
  mockUsage.groq = 30; // At limit
  mockUsage.gemini = 0;

  provider = await selectProvider(providers, mockUsage, false);
  console.log(`  Provider: ${provider.name} (expected: gemini)`);

  // Test 3: Groq and Gemini at limit, should use Qwen
  console.log('\nTest 3: Groq and Gemini at limit');
  mockUsage.groq = 30;
  mockUsage.gemini = 15;
  mockUsage.qwen = 0;

  provider = await selectProvider(providers, mockUsage, false);
  console.log(`  Provider: ${provider.name} (expected: qwen)`);

  // Test 4: All providers at limit
  console.log('\nTest 4: All providers at limit');
  mockUsage.groq = 30;
  mockUsage.gemini = 15;
  mockUsage.qwen = 1000;
  mockUsage.claude = 50;

  provider = await selectProvider(providers, mockUsage, false);
  console.log(`  Provider: ${provider ? provider.name : 'null'} (expected: null)`);

  // Test 5: Code request should prioritize Qwen
  console.log('\nTest 5: Code request prioritizes Qwen');
  mockUsage.groq = 0;
  mockUsage.gemini = 0;
  mockUsage.qwen = 0;
  mockUsage.claude = 0;

  const message = 'Write some code for me';
  provider = await selectProvider(providers, mockUsage, true, message);
  console.log(`  Provider: ${provider.name} (expected: qwen)`);

  console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(console.error);
