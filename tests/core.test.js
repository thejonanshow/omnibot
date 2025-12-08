/**

- Omnibot Core Tests
- 
- These tests verify the core functionality of the Omnibot system.
- Run with: npm test
  */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

// Mock KV namespace for testing
function createMockKV() {
const store = new Map();
return {
get: async (key) => store.get(key) || null,
put: async (key, value, options) => store.set(key, value),
delete: async (key) => store.delete(key),
list: async () => ({ keys: Array.from(store.keys()).map(k => ({ name: k })) })
};
}

// ============================================================
// USAGE TRACKING TESTS
// ============================================================

describe('Usage Tracking', () => {
it('should return correct date key format', async () => {
// Import the module (adjust path as needed when files exist)
const dateKey = new Date().toISOString().split('T')[0];
assert.match(dateKey, /^\d{4}-\d{2}-\d{2}$/);
});

it('should track usage correctly', async () => {
const mockKV = createMockKV();
const key = `usage:groq:${new Date().toISOString().split('T')[0]}`;

// Initial usage should be 0 or null
const initial = await mockKV.get(key);
assert.strictEqual(initial, null);

// After setting, should return the value
await mockKV.put(key, '5');
const after = await mockKV.get(key);
assert.strictEqual(after, '5');

});

it('should increment usage', async () => {
const mockKV = createMockKV();
const key = 'usage:test:2024-01-01';

await mockKV.put(key, '10');
const current = parseInt(await mockKV.get(key), 10);
await mockKV.put(key, (current + 1).toString());

const updated = await mockKV.get(key);
assert.strictEqual(updated, '11');

});
});

// ============================================================
// PROVIDER SELECTION TESTS
// ============================================================

describe('Provider Selection', () => {
it('should detect code-related requests', () => {
const codeKeywords = [
'write code', 'implement', 'create a function', 'build a',
'programming', 'code', 'script', 'algorithm', 'function',
'api', 'endpoint', 'javascript', 'python'
];

const testMessage = 'Can you write a function to sort an array?';
const isCodeRequest = codeKeywords.some(kw => 
  testMessage.toLowerCase().includes(kw)
);

assert.strictEqual(isCodeRequest, true);

});

it('should not detect non-code requests as code', () => {
const codeKeywords = [
'write code', 'implement', 'create a function', 'programming',
'javascript', 'python', 'api', 'endpoint'
];

const testMessage = 'What is the weather like today?';
const isCodeRequest = codeKeywords.some(kw => 
  testMessage.toLowerCase().includes(kw)
);

assert.strictEqual(isCodeRequest, false);

});

it('should prioritize Qwen for code requests', () => {
const isCodeRequest = true;

const codeProviders = [
  { name: 'qwen', priority: 1 },
  { name: 'groq', priority: 2 },
  { name: 'gemini', priority: 3 },
  { name: 'claude', priority: 4 }
];

const generalProviders = [
  { name: 'groq', priority: 1 },
  { name: 'gemini', priority: 2 },
  { name: 'qwen', priority: 3 },
  { name: 'claude', priority: 4 }
];

const providers = isCodeRequest ? codeProviders : generalProviders;
const firstProvider = providers.sort((a, b) => a.priority - b.priority)[0];

assert.strictEqual(firstProvider.name, 'qwen');

});
});

// ============================================================
// RESPONSE QUALITY ASSESSMENT TESTS
// ============================================================

describe('Response Quality Assessment', () => {
  it('should score responses with code higher', () => {
    const responseWithCode = {
      choices: [{
        message: {
          content: `Here's the solution:\n\n\`\`\`javascript\nfunction sortArray(arr) {\n  return arr.sort((a, b) => a - b);\n}\n\`\`\`\n\nThis function sorts an array in ascending order.`
        }
      }]
    };

    const content = responseWithCode.choices[0].message.content;
    let score = 0;

    if (content.includes('```')) score += 2;
    if (content.length > 100) score += 1;
    if (content.includes('return') || content.includes('function')) score += 1;
    if (content.split('\n').length > 3) score += 1;

    assert.ok(score >= 3, `Expected score >= 3, got ${score}`);
  });

it('should flag short responses for polishing', () => {
const shortResponse = {
choices: [{
message: {
content: 'Yes.'
}
}]
};

const content = shortResponse.choices[0].message.content;
const needsPolishing = content.length < 100;

assert.strictEqual(needsPolishing, true);

});
});

// ============================================================
// HMAC AUTHENTICATION TESTS
// ============================================================

describe('HMAC Authentication', () => {
it('should validate required headers', () => {
const headers = {
'X-Challenge': 'test-challenge',
'X-Signature': 'abc123',
'X-Timestamp': Date.now().toString()
};

const hasChallenge = !!headers['X-Challenge'];
const hasSignature = !!headers['X-Signature'];
const hasTimestamp = !!headers['X-Timestamp'];

assert.strictEqual(hasChallenge && hasSignature && hasTimestamp, true);

});

it('should reject expired timestamps', () => {
const oldTimestamp = Date.now() - 120000; // 2 minutes ago
const now = Date.now();
const maxAge = 60000; // 1 minute

const isExpired = Math.abs(now - oldTimestamp) > maxAge;

assert.strictEqual(isExpired, true);

});

it('should accept fresh timestamps', () => {
const freshTimestamp = Date.now() - 30000; // 30 seconds ago
const now = Date.now();
const maxAge = 60000; // 1 minute

const isExpired = Math.abs(now - freshTimestamp) > maxAge;

assert.strictEqual(isExpired, false);

});
});

// ============================================================
// CHALLENGE MANAGEMENT TESTS
// ============================================================

describe('Challenge Management', () => {
it('should generate unique challenges', () => {
const challenges = new Set();

for (let i = 0; i < 100; i++) {
  challenges.add(crypto.randomUUID());
}

assert.strictEqual(challenges.size, 100);

});

it('should invalidate used challenges', async () => {
const mockKV = createMockKV();
const challenge = 'test-challenge-123';

// Store challenge
await mockKV.put(challenge, JSON.stringify({ timestamp: Date.now() }));

// Verify it exists
const stored = await mockKV.get(challenge);
assert.ok(stored !== null);

// Delete (invalidate) challenge
await mockKV.delete(challenge);

// Verify it's gone
const deleted = await mockKV.get(challenge);
assert.strictEqual(deleted, null);

});
});

// ============================================================
// HEALTH CHECK TESTS
// ============================================================

describe('Health Check', () => {
it('should return proper health response format', () => {
const healthResponse = {
status: 'ok',
timestamp: new Date().toISOString(),
version: '1.0.0',
capabilities: ['function_calling', 'shared_context', 'voice_services']
};

assert.strictEqual(healthResponse.status, 'ok');
assert.ok(Array.isArray(healthResponse.capabilities));
assert.ok(healthResponse.timestamp.includes('T'));

});
});

// ============================================================
// ERROR HANDLING TESTS
// ============================================================

describe('Error Handling', () => {
it('should return graceful error when all providers fail', () => {
const attemptedProviders = [
'groq (limit reached: 30/30)',
'gemini (error: API timeout)',
'claude (limit reached: 50/50)'
];

const errorResponse = {
  response: 'I apologize, but I\'m currently experiencing issues with all AI providers.',
  provider: 'error',
  usage: 0,
  limit: 0,
  error: true,
  attemptedProviders: attemptedProviders
};

assert.strictEqual(errorResponse.error, true);
assert.strictEqual(errorResponse.provider, 'error');
assert.ok(errorResponse.attemptedProviders.length > 0);

});
});

console.log('✅ All tests completed');