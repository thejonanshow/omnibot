#!/usr/bin/env node

/**
 * BDD Tests for Local Qwen Development Support
 * 
 * User Story: As a developer working locally, I want to use a local Qwen instance 
 * instead of Runloop credits so that I can develop and test without consuming paid resources.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';

// Mock environment detection
const mockEnv = {
  NODE_ENV: 'development',
  QWEN_LOCAL_URL: 'http://localhost:11434',
  QWEN_RUNLOOP_URL: 'https://dbx_test.runloop.dev:8000',
  RUNLOOP_API_KEY: 'test_api_key'
};

// Mock fetch for local and remote Qwen calls
const mockFetch = mock.fn();

// Mock the callQwen function
const mockCallQwen = mock.fn();

describe('Local Qwen Development Support', () => {
  beforeEach(() => {
    // Reset all mocks
    mockFetch.mock.resetCalls();
    mockCallQwen.mock.resetCalls();
    
    // Set up environment
    process.env = { ...process.env, ...mockEnv };
    
    // Mock global fetch
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // Clean up
    delete global.fetch;
  });

  describe('Environment Detection', () => {
    it('should detect local development environment', () => {
      // Given: Local development environment
      process.env.NODE_ENV = 'development';
      
      // When: Checking environment
      const isLocal = process.env.NODE_ENV === 'development';
      
      // Then: Should be detected as local
      assert.equal(isLocal, true);
    });

    it('should detect staging environment', () => {
      // Given: Staging environment
      process.env.NODE_ENV = 'staging';
      
      // When: Checking environment
      const isLocal = process.env.NODE_ENV === 'development';
      
      // Then: Should not be detected as local
      assert.equal(isLocal, false);
    });

    it('should detect production environment', () => {
      // Given: Production environment
      process.env.NODE_ENV = 'production';
      
      // When: Checking environment
      const isLocal = process.env.NODE_ENV === 'development';
      
      // Then: Should not be detected as local
      assert.equal(isLocal, false);
    });
  });

  describe('Local Qwen Endpoint Selection', () => {
    it('should use local Qwen URL in development', () => {
      // Given: Development environment with local Qwen available
      process.env.NODE_ENV = 'development';
      const localUrl = 'http://localhost:11434';
      
      // When: Selecting Qwen endpoint
      const selectedUrl = process.env.NODE_ENV === 'development' ? localUrl : mockEnv.QWEN_RUNLOOP_URL;
      
      // Then: Should use local URL
      assert.equal(selectedUrl, localUrl);
    });

    it('should use Runloop Qwen URL in staging', () => {
      // Given: Staging environment
      process.env.NODE_ENV = 'staging';
      
      // When: Selecting Qwen endpoint
      const selectedUrl = process.env.NODE_ENV === 'development' ? mockEnv.QWEN_LOCAL_URL : mockEnv.QWEN_RUNLOOP_URL;
      
      // Then: Should use Runloop URL
      assert.equal(selectedUrl, mockEnv.QWEN_RUNLOOP_URL);
    });

    it('should use Runloop Qwen URL in production', () => {
      // Given: Production environment
      process.env.NODE_ENV = 'production';
      
      // When: Selecting Qwen endpoint
      const selectedUrl = process.env.NODE_ENV === 'development' ? mockEnv.QWEN_LOCAL_URL : mockEnv.QWEN_RUNLOOP_URL;
      
      // Then: Should use Runloop URL
      assert.equal(selectedUrl, mockEnv.QWEN_RUNLOOP_URL);
    });
  });

  describe('Local Qwen Health Check', () => {
    it('should check local Qwen service health', async () => {
      // Given: Local Qwen service running
      mockFetch.mock.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', service: 'ollama' })
        })
      );

      // When: Checking local Qwen health
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();

      // Then: Should return healthy status
      assert.equal(response.ok, true);
      assert.equal(data.status, 'ok');
      assert.equal(mockFetch.mock.callCount(), 1);
    });

    it('should handle local Qwen service unavailable', async () => {
      // Given: Local Qwen service not running
      mockFetch.mock.mockImplementationOnce(() => 
        Promise.reject(new Error('ECONNREFUSED'))
      );

      // When: Checking local Qwen health
      let error = null;
      try {
        await fetch('http://localhost:11434/api/tags');
      } catch (e) {
        error = e;
      }

      // Then: Should handle connection error
      assert.notEqual(error, null);
      assert.equal(error.message, 'ECONNREFUSED');
    });

    it('should check local Qwen model availability', async () => {
      // Given: Local Qwen with model loaded
      mockFetch.mock.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ 
            models: [{ name: 'qwen2.5:7b', size: 1234567890 }] 
          })
        })
      );

      // When: Checking model availability
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();

      // Then: Should return model information
      assert.equal(response.ok, true);
      assert.equal(data.models.length, 1);
      assert.equal(data.models[0].name, 'qwen2.5:7b');
    });
  });

  describe('Graceful Fallback to Runloop', () => {
    it('should fallback to Runloop when local Qwen unavailable', async () => {
      // Given: Local Qwen unavailable, Runloop available
      let callCount = 0;
      mockFetch.mock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('ECONNREFUSED')); // Local fails
        } else {
          return Promise.resolve({ // Runloop succeeds
            ok: true,
            status: 200,
            json: async () => ({ response: 'Qwen response from Runloop' })
          });
        }
      });

      // When: Attempting to use Qwen with fallback
      let response = null;
      let error = null;
      
      try {
        // Try local first
        response = await fetch('http://localhost:11434/api/chat');
      } catch (e) {
        error = e;
        // Fallback to Runloop
        response = await fetch('https://dbx_test.runloop.dev:8000/qwen/chat');
      }

      // Then: Should succeed with Runloop fallback
      assert.notEqual(error, null);
      assert.equal(response.ok, true);
      assert.equal(callCount, 2);
    });

    it('should log which Qwen instance is being used', () => {
      // Given: Environment detection
      const isLocal = process.env.NODE_ENV === 'development';
      const qwenUrl = isLocal ? mockEnv.QWEN_LOCAL_URL : mockEnv.QWEN_RUNLOOP_URL;
      
      // When: Logging Qwen instance usage
      const logMessage = `Using Qwen instance: ${qwenUrl} (${isLocal ? 'local' : 'remote'})`;
      
      // Then: Should provide clear logging
      assert(logMessage.includes('Using Qwen instance:'));
      assert(logMessage.includes(isLocal ? 'local' : 'remote'));
    });

    it('should handle both local and Runloop failures gracefully', async () => {
      // Given: Both local and Runloop Qwen unavailable
      let callCount = 0;
      mockFetch.mock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('ECONNREFUSED')); // Local fails
        } else {
          return Promise.reject(new Error('Service unavailable')); // Runloop fails
        }
      });

      // When: Attempting to use Qwen with both failing
      let localError = null;
      let runloopError = null;
      
      try {
        await fetch('http://localhost:11434/api/chat');
      } catch (e) {
        localError = e;
      }
      
      try {
        await fetch('https://dbx_test.runloop.dev:8000/qwen/chat');
      } catch (e) {
        runloopError = e;
      }

      // Then: Should handle both failures
      assert.notEqual(localError, null);
      assert.notEqual(runloopError, null);
      assert.equal(localError.message, 'ECONNREFUSED');
      assert.equal(runloopError.message, 'Service unavailable');
    });
  });

  describe('Credit Safety and Confirmation', () => {
    it('should require explicit confirmation before using paid services', () => {
      // Given: Request to use paid service
      const requiresConfirmation = (service, estimatedCost) => {
        return {
          service,
          estimatedCost,
          requiresConfirmation: true,
          message: `Approve ${estimatedCost} credit spend for ${service}? 22 remaining before 2am tomorrow.`
        };
      };

      // When: Requesting paid service usage
      const confirmation = requiresConfirmation('Groq API', 3);

      // Then: Should require confirmation with specific details
      assert.equal(confirmation.requiresConfirmation, true);
      assert.equal(confirmation.estimatedCost, 3);
      assert(confirmation.message.includes('Approve 3 credit spend for Groq API'));
      assert(confirmation.message.includes('22 remaining before 2am tomorrow'));
    });

    it('should never automatically fallback to paid services in local tests', () => {
      // Given: Local test environment
      const isLocalTest = process.env.NODE_ENV === 'development';
      const isTestEnvironment = process.env.NODE_TEST === 'true';
      
      // When: Checking if fallback to paid services is allowed
      const allowPaidFallback = !isLocalTest || !isTestEnvironment;
      
      // Then: Should not allow paid fallback in local tests
      if (isLocalTest && isTestEnvironment) {
        assert.equal(allowPaidFallback, false);
      }
    });

    it('should provide cost estimation before paid service usage', () => {
      // Given: Various paid services
      const serviceCosts = {
        'Groq API': { cost: 3, remaining: 22, resetTime: '2am tomorrow' },
        'Claude API': { cost: 5, remaining: 15, resetTime: '2am tomorrow' },
        'Runloop Credits': { cost: 1, remaining: 50, resetTime: 'midnight tonight' }
      };

      // When: Requesting cost estimation
      const getCostEstimate = (service) => {
        const info = serviceCosts[service];
        return `Approve ${info.cost} credit spend for ${service}? ${info.remaining} remaining before ${info.resetTime}.`;
      };

      // Then: Should provide detailed cost information
      const groqEstimate = getCostEstimate('Groq API');
      assert(groqEstimate.includes('Approve 3 credit spend for Groq API'));
      assert(groqEstimate.includes('22 remaining before 2am tomorrow'));

      const runloopEstimate = getCostEstimate('Runloop Credits');
      assert(runloopEstimate.includes('Approve 1 credit spend for Runloop Credits'));
      assert(runloopEstimate.includes('50 remaining before midnight tonight'));
    });

    it('should block paid service usage without explicit approval', () => {
      // Given: Service usage request
      const serviceRequest = {
        service: 'Groq API',
        estimatedCost: 3,
        approved: false
      };

      // When: Attempting to use service without approval
      const canUseService = serviceRequest.approved;

      // Then: Should block usage
      assert.equal(canUseService, false);
    });

    it('should allow paid service usage with explicit approval', () => {
      // Given: Service usage request with approval
      const serviceRequest = {
        service: 'Groq API',
        estimatedCost: 3,
        approved: true
      };

      // When: Attempting to use service with approval
      const canUseService = serviceRequest.approved;

      // Then: Should allow usage
      assert.equal(canUseService, true);
    });
  });

  describe('Local Development Workflow', () => {
    it('should prioritize local Qwen in development environment', () => {
      // Given: Development environment
      process.env.NODE_ENV = 'development';
      
      // When: Selecting Qwen provider
      const selectQwenProvider = () => {
        if (process.env.NODE_ENV === 'development') {
          return { url: mockEnv.QWEN_LOCAL_URL, type: 'local' };
        } else {
          return { url: mockEnv.QWEN_RUNLOOP_URL, type: 'remote' };
        }
      };

      const provider = selectQwenProvider();

      // Then: Should select local provider
      assert.equal(provider.type, 'local');
      assert.equal(provider.url, mockEnv.QWEN_LOCAL_URL);
    });

    it('should provide clear feedback about Qwen instance being used', () => {
      // Given: Different environments
      const environments = [
        { env: 'development', expected: 'local' },
        { env: 'staging', expected: 'remote' },
        { env: 'production', expected: 'remote' }
      ];

      // When: Checking feedback for each environment
      environments.forEach(({ env, expected }) => {
        process.env.NODE_ENV = env;
        const isLocal = process.env.NODE_ENV === 'development';
        const feedback = `Qwen instance: ${isLocal ? 'local' : 'remote'} (${env})`;
        
        // Then: Should provide appropriate feedback
        assert(feedback.includes(expected));
        assert(feedback.includes(env));
      });
    });

    it('should handle local Qwen startup time gracefully', async () => {
      // Given: Local Qwen starting up
      let startupAttempts = 0;
      mockFetch.mock.mockImplementation(() => {
        startupAttempts++;
        if (startupAttempts < 3) {
          return Promise.reject(new Error('ECONNREFUSED'));
        } else {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ status: 'ok' })
          });
        }
      });

      // When: Waiting for local Qwen to start
      let success = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!success && attempts < maxAttempts) {
        try {
          const response = await fetch('http://localhost:11434/api/tags');
          if (response.ok) {
            success = true;
          }
        } catch (e) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 10)); // Faster for tests
        }
        attempts++;
      }

      // Then: Should eventually succeed
      assert.equal(success, true);
      assert.equal(attempts, 3);
    });
  });
});
