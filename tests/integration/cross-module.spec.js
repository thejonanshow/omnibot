/**
 * Integration Tests: Cross-Module Communication
 * Tests interaction between multiple modules/components
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import modules for integration testing
import { generateChallenge, verifyRequest } from '../../cloudflare-worker/src/lib/auth.js';
import { isCodeImplementationRequest } from '../../cloudflare-worker/src/lib/classifier.js';
import { getSharedContext, saveContext } from '../../cloudflare-worker/src/lib/context.js';
import { selectProvider } from '../../cloudflare-worker/src/lib/providers.js';
import { getUsage, incrementUsage } from '../../cloudflare-worker/src/lib/usage.js';

describe('Integration Tests: Cross-Module Communication', () => {
  const createMockEnv = () => {
    const authStore = new Map();
    const contextStore = new Map();
    const usageStore = new Map();

    return {
      AUTH: {
        async get(key) { return authStore.get(key) || null; },
        async put(key, value, options) { authStore.set(key, value); return; },
        async delete(key) { authStore.delete(key); return; }
      },
      CONTEXT: {
        async get(key) { return contextStore.get(key) || null; },
        async put(key, value) { contextStore.set(key, value); return; }
      },
      USAGE: {
        async get(key) { return usageStore.get(key) || null; },
        async put(key, value) { usageStore.set(key, value); return; }
      }
    };
  };

  test('should integrate authentication with context management', async () => {
    const mockEnv = createMockEnv();

    // Generate a challenge
    const challenge = await generateChallenge(mockEnv.AUTH);

    // Verify the challenge was stored
    assert.ok(challenge.challenge);
    assert.ok(challenge.timestamp);

    // Simulate context retrieval during authentication
    const context = await getSharedContext(mockEnv.CONTEXT, 'test-session');
    assert.deepEqual(context, {});

    // Save some context
    await saveContext('user_preference', 'dark_mode', mockEnv.CONTEXT, 'test-session');

    // Retrieve context again
    const updatedContext = await getSharedContext(mockEnv.CONTEXT, 'test-session');
    assert.equal(updatedContext.user_preference, 'dark_mode');
  });

  test('should integrate classifier with provider selection', async () => {
    const mockEnv = createMockEnv();

    // Test code request classification
    const codeRequest = 'Write a Python function to calculate fibonacci numbers';
    const isCode = isCodeImplementationRequest(codeRequest);
    assert.equal(isCode, true);

    // Test general request classification
    const generalRequest = 'What is the weather like today?';
    const isGeneral = isCodeImplementationRequest(generalRequest);
    assert.equal(isGeneral, false);

    // Simulate provider selection based on classification
    const providers = [
      { name: 'qwen', limit: 1000, priority: 1 },
      { name: 'groq', limit: 30, priority: 2 },
      { name: 'gemini', limit: 15, priority: 3 }
    ];

    const getUsageFn = async (provider) => await getUsage(mockEnv.USAGE, provider);
    const selectedProvider = await selectProvider(providers, getUsageFn);
    assert.ok(selectedProvider);
    assert.equal(selectedProvider.name, 'qwen'); // Should select first available
  });

  test('should integrate usage tracking with provider selection', async () => {
    const mockEnv = createMockEnv();

    // Initialize usage for a provider
    await incrementUsage(mockEnv.USAGE, 'groq');

    // Check usage
    const usage = await getUsage(mockEnv.USAGE, 'groq');
    assert.equal(usage, 1);

    // Simulate provider selection with usage limits
    const providers = [
      { name: 'groq', limit: 1, priority: 1 }, // At limit
      { name: 'gemini', limit: 15, priority: 2 }
    ];

    const getUsageFn = async (provider) => await getUsage(mockEnv.USAGE, provider);
    const selectedProvider = await selectProvider(providers, getUsageFn);
    assert.ok(selectedProvider);
    assert.equal(selectedProvider.name, 'gemini'); // Should skip groq due to limit
  });

  test('should integrate context with conversation flow', async () => {
    const mockEnv = createMockEnv();

    // Save initial context
    await saveContext('project_type', 'web_app', mockEnv.CONTEXT, 'session-1');
    await saveContext('language', 'javascript', mockEnv.CONTEXT, 'session-1');

    // Retrieve context for conversation
    const context = await getSharedContext(mockEnv.CONTEXT, 'session-1');
    assert.equal(context.project_type, 'web_app');
    assert.equal(context.language, 'javascript');

    // Simulate conversation with context
    const message = 'Create a React component for user authentication';
    const isCode = isCodeImplementationRequest(message);
    assert.equal(isCode, true);

    // Context should influence provider selection
    const providers = [
      { name: 'qwen', limit: 1000, priority: 1, isCodeSpecialist: true },
      { name: 'groq', limit: 30, priority: 2 }
    ];

    const getUsageFn = async (provider) => await getUsage(mockEnv.USAGE, provider);
    const selectedProvider = await selectProvider(providers, getUsageFn);
    assert.equal(selectedProvider.name, 'qwen');
  });

  test('should handle cross-module error propagation', async () => {
    const mockEnv = createMockEnv();

    // Test error handling across modules
    const invalidEnv = {
      AUTH: null, // Invalid KV store
      CONTEXT: null,
      USAGE: null
    };

    // Authentication should handle missing KV store
    await assert.rejects(
      async () => generateChallenge(invalidEnv.AUTH),
      { message: /Cannot read properties of null/ }
    );

    // Context should handle missing KV store
    const contextResult = await getSharedContext(invalidEnv.CONTEXT, 'session');
    assert.deepEqual(contextResult, {});

    // Usage should handle missing KV store
    await assert.rejects(
      async () => getUsage(invalidEnv.USAGE, 'groq'),
      { message: /Cannot read properties of null/ }
    );
  });

  test('should integrate session management across modules', async () => {
    const mockEnv = createMockEnv();
    const sessionId = 'integration-test-session';

    // Generate challenge for session
    const challenge = await generateChallenge(mockEnv.AUTH);

    // Save session-specific context
    await saveContext('user_id', 'user123', mockEnv.CONTEXT, sessionId);
    await saveContext('conversation_count', '5', mockEnv.CONTEXT, sessionId);

    // Track usage for session
    await incrementUsage(mockEnv.USAGE, 'groq');

    // Verify session data integrity
    const context = await getSharedContext(mockEnv.CONTEXT, sessionId);
    const usage = await getUsage(mockEnv.USAGE, 'groq');

    assert.equal(context.user_id, 'user123');
    assert.equal(context.conversation_count, '5');
    assert.equal(usage, 1);
  });

  test('should integrate provider rotation with usage tracking', async () => {
    const mockEnv = createMockEnv();

    // Simulate multiple requests with usage tracking
    const providers = [
      { name: 'groq', limit: 2, priority: 1 },
      { name: 'gemini', limit: 1, priority: 2 }
    ];

    const getUsageFn = async (provider) => await getUsage(mockEnv.USAGE, provider);

    // First request - should select groq
    let selectedProvider = await selectProvider(providers, getUsageFn);
    assert.equal(selectedProvider.name, 'groq');
    await incrementUsage(mockEnv.USAGE, 'groq');

    // Second request - should still select groq (under limit)
    selectedProvider = await selectProvider(providers, getUsageFn);
    assert.equal(selectedProvider.name, 'groq');
    await incrementUsage(mockEnv.USAGE, 'groq');

    // Third request - should select gemini (groq at limit)
    selectedProvider = await selectProvider(providers, getUsageFn);
    assert.equal(selectedProvider.name, 'gemini');
    await incrementUsage(mockEnv.USAGE, 'gemini');

    // Fourth request - should return null (all at limit)
    selectedProvider = await selectProvider(providers, getUsageFn);
    assert.equal(selectedProvider, null);
  });
});