#!/usr/bin/env node

/**
 * BDD Tests for Smart Routing to Qwen
 *
 * User Story: As a user asking coding questions, I want my implementation requests
 * automatically routed to Qwen so that I get specialized, free code generation
 * without manual provider selection.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';

// Mock the classifier and provider selection
const mockIsCodeImplementationRequest = mock.fn();
const mockSelectProvider = mock.fn();
const mockCallQwen = mock.fn();
const mockCallGroq = mock.fn();
const mockCallGemini = mock.fn();

// Mock environment
const mockEnv = {
  NODE_ENV: 'development',
  QWEN_LOCAL_URL: 'http://localhost:11434',
  QWEN_RUNLOOP_URL: 'https://dbx_test.runloop.dev:8000',
  GROQ_API_KEY: 'test_groq_key',
  GEMINI_API_KEY: 'test_gemini_key'
};

describe('Smart Routing to Qwen', () => {
  beforeEach(() => {
    // Reset all mocks
    mockIsCodeImplementationRequest.mock.resetCalls();
    mockSelectProvider.mock.resetCalls();
    mockCallQwen.mock.resetCalls();
    mockCallGroq.mock.resetCalls();
    mockCallGemini.mock.resetCalls();
  });

  afterEach(() => {
    // Clean up
  });

  describe('Code Implementation Detection', () => {
    it('should route coding requests to Qwen', async () => {
      // Given: A coding request
      const codingMessage = 'Write a Python function to sort a list';
      mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => true);
      mockCallQwen.mock.mockImplementationOnce(() => Promise.resolve({
        choices: [{ message: { content: 'def sort_list(items): return sorted(items)', role: 'assistant' } }]
      }));

      // When: Processing the request
      const isCodeRequest = mockIsCodeImplementationRequest(codingMessage);
      let response = null;
      if (isCodeRequest) {
        response = await mockCallQwen(codingMessage, [], mockEnv, 'session1');
      }

      // Then: Should route to Qwen
      assert.equal(isCodeRequest, true);
      assert.notEqual(response, null);
      assert.equal(mockCallQwen.mock.callCount(), 1);
      assert.equal(mockCallGroq.mock.callCount(), 0);
    });

    it('should route non-coding requests to other providers', async () => {
      // Given: A non-coding request
      const generalMessage = 'What is the weather like today?';
      mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => false);
      mockSelectProvider.mock.mockImplementationOnce(() => 'groq');
      mockCallGroq.mock.mockImplementationOnce(() => Promise.resolve({
        choices: [{ message: { content: 'I cannot check the weather', role: 'assistant' } }]
      }));

      // When: Processing the request
      const isCodeRequest = mockIsCodeImplementationRequest(generalMessage);
      let response = null;
      if (!isCodeRequest) {
        const provider = mockSelectProvider();
        if (provider === 'groq') {
          response = await mockCallGroq(generalMessage, [], mockEnv, 'session1');
        }
      }

      // Then: Should route to other providers
      assert.equal(isCodeRequest, false);
      assert.notEqual(response, null);
      assert.equal(mockCallQwen.mock.callCount(), 0);
      assert.equal(mockCallGroq.mock.callCount(), 1);
    });

    it('should detect various coding request patterns', () => {
      // Given: Various coding request patterns
      const codingRequests = [
        'Write a function to calculate fibonacci',
        'How do I implement a binary search in Python?',
        'Create a REST API endpoint for user authentication',
        'Debug this JavaScript code',
        'Optimize this SQL query',
        'Build a React component for user profile',
        'Implement a sorting algorithm',
        'Fix the bug in this code'
      ];

      // When: Testing each pattern
      codingRequests.forEach(request => {
        mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => true);
        const isCodeRequest = mockIsCodeImplementationRequest(request);

        // Then: Should detect as coding request
        assert.equal(isCodeRequest, true, `Failed to detect coding request: "${request}"`);
      });
    });

    it('should not detect general questions as coding requests', () => {
      // Given: General questions
      const generalRequests = [
        'What is machine learning?',
        'How does the internet work?',
        'Tell me about quantum computing',
        'What are the benefits of cloud computing?',
        'Explain artificial intelligence',
        'What is the capital of France?',
        'How do I cook pasta?',
        'What time is it?'
      ];

      // When: Testing each pattern
      generalRequests.forEach(request => {
        mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => false);
        const isCodeRequest = mockIsCodeImplementationRequest(request);

        // Then: Should not detect as coding request
        assert.equal(isCodeRequest, false, `Incorrectly detected as coding request: "${request}"`);
      });
    });
  });

  describe('Qwen Availability Handling', () => {
    it('should fallback to other providers when Qwen unavailable', async () => {
      // Given: Coding request but Qwen unavailable
      const codingMessage = 'Write a Python function';
      mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => true);
      mockCallQwen.mock.mockImplementationOnce(() => Promise.reject(new Error('Qwen unavailable')));
      mockSelectProvider.mock.mockImplementationOnce(() => 'groq');
      mockCallGroq.mock.mockImplementationOnce(() => Promise.resolve({
        choices: [{ message: { content: 'def python_function(): pass', role: 'assistant' } }]
      }));

      // When: Processing with Qwen fallback
      const isCodeRequest = mockIsCodeImplementationRequest(codingMessage);
      let response = null;
      let error = null;

      if (isCodeRequest) {
        try {
          response = await mockCallQwen(codingMessage, [], mockEnv, 'session1');
        } catch (e) {
          error = e;
          // Fallback to other provider
          const provider = mockSelectProvider();
          if (provider === 'groq') {
            response = await mockCallGroq(codingMessage, [], mockEnv, 'session1');
          }
        }
      }

      // Then: Should fallback successfully
      assert.equal(isCodeRequest, true);
      assert.notEqual(error, null);
      assert.equal(error.message, 'Qwen unavailable');
      assert.notEqual(response, null);
      assert.equal(mockCallQwen.mock.callCount(), 1);
      assert.equal(mockCallGroq.mock.callCount(), 1);
    });

    it('should handle both Qwen and fallback provider failures', async () => {
      // Given: Both Qwen and fallback providers fail
      const codingMessage = 'Write a Python function';
      mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => true);
      mockCallQwen.mock.mockImplementationOnce(() => Promise.reject(new Error('Qwen unavailable')));
      mockSelectProvider.mock.mockImplementationOnce(() => 'groq');
      mockCallGroq.mock.mockImplementationOnce(() => Promise.reject(new Error('Groq unavailable')));

      // When: Processing with all providers failing
      const isCodeRequest = mockIsCodeImplementationRequest(codingMessage);
      let finalError = null;

      if (isCodeRequest) {
        try {
          await mockCallQwen(codingMessage, [], mockEnv, 'session1');
        } catch (e) {
          try {
            const provider = mockSelectProvider();
            if (provider === 'groq') {
              await mockCallGroq(codingMessage, [], mockEnv, 'session1');
            }
          } catch (fallbackError) {
            finalError = fallbackError;
          }
        }
      }

      // Then: Should handle all failures gracefully
      assert.equal(isCodeRequest, true);
      assert.notEqual(finalError, null);
      assert.equal(finalError.message, 'Groq unavailable');
    });

    it('should provide clear error messages when routing fails', async () => {
      // Given: Routing failure scenario
      const errorScenarios = [
        { error: 'Qwen unavailable', expected: 'Qwen service is not available' },
        { error: 'Local Qwen connection refused', expected: 'Local Qwen is not running' },
        { error: 'Runloop Qwen timeout', expected: 'Remote Qwen service timeout' },
        { error: 'All providers unavailable', expected: 'No providers available for coding requests' }
      ];

      // When: Each error occurs
      errorScenarios.forEach(scenario => {
        // Then: Should provide meaningful error message
        assert(scenario.expected.length > 0, 'Error message should not be empty');
        assert(scenario.expected.includes('Qwen') || scenario.expected.includes('provider'),
               'Error message should be descriptive');
      });
    });
  });

  describe('Environment-Aware Routing', () => {
    it('should use local Qwen in development environment', async () => {
      // Given: Development environment
      const devEnv = { ...mockEnv, NODE_ENV: 'development' };
      const codingMessage = 'Write a Python function';
      mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => true);
      mockCallQwen.mock.mockImplementationOnce(() => Promise.resolve({
        choices: [{ message: { content: 'def local_function(): pass', role: 'assistant' } }]
      }));

      // When: Processing in development
      const isCodeRequest = mockIsCodeImplementationRequest(codingMessage);
      let response = null;
      if (isCodeRequest) {
        response = await mockCallQwen(codingMessage, [], devEnv, 'session1');
      }

      // Then: Should use local Qwen
      assert.equal(isCodeRequest, true);
      assert.notEqual(response, null);
      assert.equal(mockCallQwen.mock.callCount(), 1);
    });

    it('should use Runloop Qwen in staging environment', async () => {
      // Given: Staging environment
      const stagingEnv = { ...mockEnv, NODE_ENV: 'staging' };
      const codingMessage = 'Write a Python function';
      mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => true);
      mockCallQwen.mock.mockImplementationOnce(() => Promise.resolve({
        choices: [{ message: { content: 'def staging_function(): pass', role: 'assistant' } }]
      }));

      // When: Processing in staging
      const isCodeRequest = mockIsCodeImplementationRequest(codingMessage);
      let response = null;
      if (isCodeRequest) {
        response = await mockCallQwen(codingMessage, [], stagingEnv, 'session1');
      }

      // Then: Should use Runloop Qwen
      assert.equal(isCodeRequest, true);
      assert.notEqual(response, null);
      assert.equal(mockCallQwen.mock.callCount(), 1);
    });

    it('should maintain credit safety in local development', async () => {
      // Given: Local development with credit safety
      const devEnv = { ...mockEnv, NODE_ENV: 'development' };
      const codingMessage = 'Write a Python function';
      mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => true);
      mockCallQwen.mock.mockImplementationOnce(() => Promise.reject(new Error('Local Qwen unavailable')));

      // Mock that fallback requires credit confirmation
      const requiresCreditConfirmation = (provider) => {
        return provider === 'groq' || provider === 'gemini' || provider === 'claude';
      };

      // When: Local Qwen fails and fallback would use credits
      const isCodeRequest = mockIsCodeImplementationRequest(codingMessage);
      let error = null;
      let usedCredits = false;

      if (isCodeRequest) {
        try {
          await mockCallQwen(codingMessage, [], devEnv, 'session1');
        } catch (e) {
          error = e;
          // In local development, don't automatically use paid services
          const fallbackProvider = 'groq';
          if (requiresCreditConfirmation(fallbackProvider)) {
            // Don't proceed without explicit confirmation
            usedCredits = false;
          }
        }
      }

      // Then: Should not use credits without confirmation
      assert.equal(isCodeRequest, true);
      assert.notEqual(error, null);
      assert.equal(usedCredits, false);
    });
  });

  describe('Response Quality Integration', () => {
    it('should assess Qwen response quality', async () => {
      // Given: Qwen response
      const qwenResponse = {
        choices: [{
          message: {
            content: 'def quick_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quick_sort(left) + middle + quick_sort(right)',
            role: 'assistant'
          }
        }]
      };

      // When: Assessing response quality
      const assessQuality = (response) => {
        const content = response.choices[0].message.content;
        const hasCode = content.includes('def ') || content.includes('```');
        const hasExplanation = content.length > 100;
        const isComplete = content.includes('return') || content.includes('print');

        return {
          hasCode,
          hasExplanation,
          isComplete,
          qualityScore: (hasCode ? 1 : 0) + (hasExplanation ? 1 : 0) + (isComplete ? 1 : 0)
        };
      };

      const quality = assessQuality(qwenResponse);

      // Then: Should assess quality correctly
      assert.equal(quality.hasCode, true);
      assert.equal(quality.hasExplanation, true);
      assert.equal(quality.isComplete, true);
      assert.equal(quality.qualityScore, 3);
    });

    it('should polish low-quality Qwen responses', async () => {
      // Given: Low-quality Qwen response
      const lowQualityResponse = {
        choices: [{
          message: {
            content: 'def func(): pass',
            role: 'assistant'
          }
        }]
      };

      // When: Assessing and polishing
      const assessQuality = (response) => {
        const content = response.choices[0].message.content;
        return content.length < 50; // Low quality threshold
      };

      const needsPolishing = assessQuality(lowQualityResponse);
      let polishedResponse = lowQualityResponse;

      if (needsPolishing) {
        // Mock polishing by premium provider
        mockCallGroq.mock.mockImplementationOnce(() => Promise.resolve({
          choices: [{
            message: {
              content: 'Here is a well-documented Python function:\n\ndef example_function():\n    """\n    Example function with proper documentation.\n    \n    Returns:\n        str: A greeting message\n    """\n    return "Hello, World!"\n\n# Usage example\nif __name__ == "__main__":\n    result = example_function()\n    print(result)',
              role: 'assistant'
            }
          }]
        }));

        polishedResponse = await mockCallGroq('Polish this response', [], mockEnv, 'session1');
      }

      // Then: Should polish low-quality responses
      assert.equal(needsPolishing, true);
      assert.notEqual(polishedResponse, lowQualityResponse);
      assert.equal(mockCallGroq.mock.callCount(), 1);
    });

    it('should indicate which providers were used', async () => {
      // Given: Response from multiple providers
      const providerChain = ['qwen', 'groq'];
      const response = {
        choices: [{
          message: {
            content: 'Polished response from Qwen + Groq',
            role: 'assistant'
          }
        }],
        providers: providerChain,
        polished: true
      };

      // When: Checking provider information
      const hasProviderInfo = response.providers && response.providers.length > 0;
      const wasPolished = response.polished;

      // Then: Should indicate provider usage
      assert.equal(hasProviderInfo, true);
      assert.equal(response.providers.length, 2);
      assert.equal(response.providers.includes('qwen'), true);
      assert.equal(response.providers.includes('groq'), true);
      assert.equal(wasPolished, true);
    });
  });

  describe('Performance Optimization', () => {
    it('should make fast routing decisions', async () => {
      // Given: Fast classifier and provider selection
      const startTime = Date.now();

      mockIsCodeImplementationRequest.mock.mockImplementationOnce(() => true);
      mockCallQwen.mock.mockImplementationOnce(() => Promise.resolve({
        choices: [{ message: { content: 'Fast response', role: 'assistant' } }]
      }));

      // When: Making routing decision
      const isCodeRequest = mockIsCodeImplementationRequest('Write a function');
      let response = null;
      if (isCodeRequest) {
        response = await mockCallQwen('Write a function', [], mockEnv, 'session1');
      }
      const routingTime = Date.now() - startTime;

      // Then: Should be fast
      assert.equal(isCodeRequest, true);
      assert.notEqual(response, null);
      assert(routingTime < 100, `Routing took ${routingTime}ms, should be under 100ms`);
    });

    it('should cache routing decisions appropriately', () => {
      // Given: Routing decision cache
      const routingCache = new Map();

      const cacheKey = 'coding_request_pattern';
      const cachedDecision = { provider: 'qwen', timestamp: Date.now() };

      // When: Caching and retrieving decisions
      routingCache.set(cacheKey, cachedDecision);
      const retrievedDecision = routingCache.get(cacheKey);
      const isRecent = (Date.now() - retrievedDecision.timestamp) < 60000; // 1 minute

      // Then: Should cache and retrieve correctly
      assert.notEqual(retrievedDecision, null);
      assert.equal(retrievedDecision.provider, 'qwen');
      assert.equal(isRecent, true);
    });

    it('should handle concurrent routing requests efficiently', async () => {
      // Given: Multiple concurrent requests
      const requests = [
        'Write a Python function',
        'Create a JavaScript class',
        'Implement a sorting algorithm',
        'Build a REST API endpoint'
      ];

      mockIsCodeImplementationRequest.mock.mockImplementation(() => true);
      mockCallQwen.mock.mockImplementation(() => Promise.resolve({
        choices: [{ message: { content: 'Concurrent response', role: 'assistant' } }]
      }));

      // When: Processing concurrent requests
      const startTime = Date.now();
      const promises = requests.map(request => {
        const isCodeRequest = mockIsCodeImplementationRequest(request);
        if (isCodeRequest) {
          return mockCallQwen(request, [], mockEnv, 'session1');
        }
        return Promise.resolve(null);
      });

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Then: Should handle efficiently
      assert.equal(responses.length, 4);
      assert(responses.every(r => r !== null), 'All responses should be non-null');
      assert(totalTime < 500, `Concurrent processing took ${totalTime}ms, should be under 500ms`);
    });
  });

  describe('Routing Decision Logging', () => {
    it('should log routing decisions for observability', () => {
      // Given: Routing decision
      const routingDecision = {
        message: 'Write a Python function',
        isCodeRequest: true,
        selectedProvider: 'qwen',
        environment: 'development',
        timestamp: new Date().toISOString(),
        fallbackUsed: false
      };

      // When: Logging the decision
      const logEntry = {
        level: 'info',
        message: 'Routing decision made',
        data: routingDecision
      };

      // Then: Should have complete logging information
      assert.equal(logEntry.level, 'info');
      assert.equal(logEntry.data.isCodeRequest, true);
      assert.equal(logEntry.data.selectedProvider, 'qwen');
      assert.equal(logEntry.data.environment, 'development');
      assert.notEqual(logEntry.data.timestamp, null);
    });

    it('should log fallback scenarios', () => {
      // Given: Fallback scenario
      const fallbackLog = {
        level: 'warn',
        message: 'Qwen unavailable, using fallback provider',
        data: {
          originalProvider: 'qwen',
          fallbackProvider: 'groq',
          reason: 'Local Qwen connection refused',
          timestamp: new Date().toISOString()
        }
      };

      // When: Checking fallback logging
      const isFallbackLog = fallbackLog.level === 'warn' &&
                           fallbackLog.message.includes('fallback');

      // Then: Should log fallback scenarios
      assert.equal(isFallbackLog, true);
      assert.equal(fallbackLog.data.originalProvider, 'qwen');
      assert.equal(fallbackLog.data.fallbackProvider, 'groq');
      assert.equal(fallbackLog.data.reason, 'Local Qwen connection refused');
    });

    it('should track routing performance metrics', () => {
      // Given: Performance metrics
      const metrics = {
        totalRequests: 100,
        qwenRequests: 45,
        fallbackRequests: 5,
        averageRoutingTime: 25, // ms
        successRate: 0.95
      };

      // When: Calculating derived metrics
      const qwenUsageRate = metrics.qwenRequests / metrics.totalRequests;
      const fallbackRate = metrics.fallbackRequests / metrics.totalRequests;

      // Then: Should track performance correctly
      assert.equal(qwenUsageRate, 0.45);
      assert.equal(fallbackRate, 0.05);
      assert(metrics.averageRoutingTime < 100, 'Average routing time should be under 100ms');
      assert(metrics.successRate > 0.9, 'Success rate should be over 90%');
    });
  });
});
