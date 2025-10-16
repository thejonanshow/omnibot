#!/usr/bin/env node
/**
 * Unit tests for the ProviderRotation class
 */

const ProviderRotation = require('./provider_rotation.js');

// Mock provider functions
const mockProviders = [
  {
    name: 'groq',
    fn: async (message, conversation, env, sessionId) => ({
      choices: [{ message: { content: 'Groq response', role: 'assistant' } }]
    }),
    limit: 30,
    priority: 1,
    fallback: true
  },
  {
    name: 'gemini',
    fn: async (message, conversation, env, sessionId) => ({
      choices: [{ message: { content: 'Gemini response', role: 'assistant' } }]
    }),
    limit: 15,
    priority: 2,
    fallback: true
  },
  {
    name: 'qwen',
    fn: async (message, conversation, env, sessionId) => ({
      choices: [{ message: { content: 'Qwen response', role: 'assistant' } }]
    }),
    limit: 1000,
    priority: 3,
    fallback: true
  },
  {
    name: 'claude',
    fn: async (message, conversation, env, sessionId) => ({
      choices: [{ message: { content: 'Claude response', role: 'assistant' } }]
    }),
    limit: 50,
    priority: 4,
    fallback: false
  }
];

// Mock usage tracking
const mockUsage = { groq: 0, gemini: 0, qwen: 0, claude: 0 };

const mockGetUsage = async (providerName) => mockUsage[providerName] || 0;
const mockIncrementUsage = async (providerName) => {
  mockUsage[providerName] = (mockUsage[providerName] || 0) + 1;
};

async function runTests() {
  console.log('🧪 Testing ProviderRotation System\n');

  const rotation = new ProviderRotation(mockProviders, mockGetUsage, mockIncrementUsage);

  // Test 1: Normal rotation
  console.log('Test 1: Normal rotation');
  mockUsage.groq = 0;
  mockUsage.gemini = 0;
  mockUsage.qwen = 0;
  mockUsage.claude = 0;

  let result = await rotation.executeWithProvider('Hello', [], {}, 'test');
  console.log(`  Provider: ${result.provider} (expected: groq)`);
  console.log(`  Usage: ${result.usage}/${result.limit}`);

  // Test 2: Groq at limit
  console.log('\nTest 2: Groq at limit');
  mockUsage.groq = 30;
  mockUsage.gemini = 0;

  result = await rotation.executeWithProvider('Hello', [], {}, 'test');
  console.log(`  Provider: ${result.provider} (expected: gemini)`);

  // Test 3: Code request prioritizes Qwen
  console.log('\nTest 3: Code request prioritizes Qwen');
  mockUsage.groq = 0;
  mockUsage.gemini = 0;
  mockUsage.qwen = 0;

  result = await rotation.executeWithProvider('Write some code for me', [], {}, 'test');
  console.log(`  Provider: ${result.provider} (expected: qwen)`);

  // Test 4: All providers at limit
  console.log('\nTest 4: All providers at limit');
  mockUsage.groq = 30;
  mockUsage.gemini = 15;
  mockUsage.qwen = 1000;
  mockUsage.claude = 50;

  try {
    result = await rotation.executeWithProvider('Hello', [], {}, 'test');
    console.log(`  Provider: ${result.provider} (expected: error)`);
  } catch (error) {
    console.log(`  Error: ${error.message} (expected: All providers are at their usage limits)`);
  }

  // Test 5: Code detection
  console.log('\nTest 5: Code detection');
  const testMessages = [
    'Hello world',
    'Write a Python function',
    'Create an API endpoint',
    'How are you?',
    'Build a React component'
  ];

  for (const message of testMessages) {
    const isCode = rotation.isCodeRequest(message);
    console.log(`  "${message}" -> ${isCode ? 'CODE' : 'GENERAL'}`);
  }

  console.log('\n✅ All tests completed!');
}

runTests().catch(console.error);
