/**
 * Swarm Integration Tests
 * Tests for swarm orchestration and response collation
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handleSwarmRequest, shouldUseSwarm, getSwarmConfig } from '../cloudflare-worker/src/swarm.js';

// Mock environment
const mockEnv = {
  QWEN_RUNLOOP_URL: 'https://test-qwen.runloop.dev:8000',
  SWARM_MODE: 'true'
};

// Mock fetch for Qwen calls
let fetchCallCount = 0;
const originalFetch = global.fetch;

describe('Swarm Integration', () => {
  beforeEach(() => {
    fetchCallCount = 0;
    global.fetch = async (url, options) => {
      fetchCallCount++;

      if (url.includes('/qwen/chat')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            response: `Mock Qwen response ${fetchCallCount} for: ${JSON.parse(options.body).message}`,
            success: true
          })
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' })
      };
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Swarm Request Handling', () => {
    it('should process swarm request successfully', async () => {
      const args = {
        message: 'Write a Python function to calculate factorial',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 3
      };

      const result = await handleSwarmRequest(args, mockEnv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.swarm, true);
      assert.strictEqual(result.swarmSize, 3);
      assert.strictEqual(result.successfulInstances, 3);
      assert.strictEqual(result.usedProviders[0], 'qwen-swarm');
      assert.ok(result.consensusResponse);
      assert.ok(result.qualityAnalysis);
      assert.ok(result.responses);
      assert.strictEqual(result.responses.length, 3);
    });

    it('should validate and adjust swarm size', async () => {
      const args = {
        message: 'Write a Python function',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 10 // Exceeds max size
      };

      const result = await handleSwarmRequest(args, mockEnv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.swarmSize, 7); // Should be adjusted to max
    });

    it('should handle minimum swarm size', async () => {
      const args = {
        message: 'Write a Python function',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 1 // Below minimum
      };

      const result = await handleSwarmRequest(args, mockEnv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.swarmSize, 2); // Should be adjusted to minimum
    });

    it('should fallback to single Qwen on swarm failure', async () => {
      // Mock fetch to fail for swarm but succeed for fallback
      global.fetch = async (url, options) => {
        if (url.includes('/qwen/chat') && fetchCallCount < 3) {
          fetchCallCount++;
          throw new Error('Swarm instance failed');
        }

        if (url.includes('/qwen/chat')) {
          fetchCallCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              response: 'Fallback Qwen response',
              success: true
            })
          };
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' })
        };
      };

      const args = {
        message: 'Write a Python function',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 3
      };

      const result = await handleSwarmRequest(args, mockEnv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.swarm, false);
      assert.strictEqual(result.fallback, true);
      assert.strictEqual(result.response, 'Fallback Qwen response');
      assert.strictEqual(result.usedProviders[0], 'qwen-fallback');
    });

    it('should handle complete swarm failure', async () => {
      // Mock fetch to always fail
      global.fetch = async () => {
        throw new Error('All instances failed');
      };

      const args = {
        message: 'Write a Python function',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 3
      };

      await assert.rejects(
        () => handleSwarmRequest(args, mockEnv),
        /Swarm processing failed/
      );
    });
  });

  describe('Swarm Mode Detection', () => {
    it('should detect swarm mode from environment', () => {
      const message = 'Write a simple function';
      const env = { SWARM_MODE: 'true' };

      assert.strictEqual(shouldUseSwarm(message, env), true);
    });

    it('should detect swarm keywords', () => {
      const message = 'Use swarm to implement a complex system';
      const env = { SWARM_MODE: 'false' };

      assert.strictEqual(shouldUseSwarm(message, env), true);
    });

    it('should detect complex coding tasks', () => {
      const message = 'Implement a distributed system architecture';
      const env = { SWARM_MODE: 'false' };

      assert.strictEqual(shouldUseSwarm(message, env), true);
    });

    it('should not use swarm for simple tasks', () => {
      const message = 'What is the weather today?';
      const env = { SWARM_MODE: 'false' };

      assert.strictEqual(shouldUseSwarm(message, env), false);
    });

    it('should not use swarm when disabled', () => {
      const message = 'Implement a complex system';
      const env = { SWARM_MODE: 'false' };

      assert.strictEqual(shouldUseSwarm(message, env), false);
    });
  });

  describe('Swarm Configuration', () => {
    it('should return correct swarm configuration', () => {
      const config = getSwarmConfig();

      assert.strictEqual(config.DEFAULT_SIZE, 3);
      assert.strictEqual(config.MAX_SIZE, 7);
      assert.strictEqual(config.MIN_SIZE, 2);
      assert.strictEqual(config.TIMEOUT_MS, 60000);
      assert.strictEqual(config.QUALITY_THRESHOLD, 0.7);
    });
  });

  describe('Quality Analysis', () => {
    it('should calculate quality scores correctly', async () => {
      const args = {
        message: 'Write a Python function to calculate factorial',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 3
      };

      const result = await handleSwarmRequest(args, mockEnv);

      assert.ok(result.qualityAnalysis);
      assert.ok(result.qualityAnalysis.average_quality >= 0);
      assert.ok(result.qualityAnalysis.average_quality <= 1);
      assert.ok(result.qualityAnalysis.best_quality >= 0);
      assert.ok(result.qualityAnalysis.best_quality <= 1);
      assert.ok(result.qualityAnalysis.consensus_confidence >= 0);
      assert.ok(result.qualityAnalysis.consensus_confidence <= 1);
    });

    it('should provide response quality metrics', async () => {
      const args = {
        message: 'Write a Python function',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 3
      };

      const result = await handleSwarmRequest(args, mockEnv);

      assert.ok(result.responses);
      assert.strictEqual(result.responses.length, 3);

      result.responses.forEach(response => {
        assert.ok(response.instanceId);
        assert.ok(response.qualityScore >= 0);
        assert.ok(response.qualityScore <= 1);
        assert.ok(response.responseTimeMs > 0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing QWEN_RUNLOOP_URL', async () => {
      const env = { SWARM_MODE: 'true' };
      const args = {
        message: 'Write a Python function',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 3
      };

      await assert.rejects(
        () => handleSwarmRequest(args, env),
        /QWEN_RUNLOOP_URL not configured/
      );
    });

    it('should handle invalid swarm size', async () => {
      const args = {
        message: 'Write a Python function',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: -1
      };

      const result = await handleSwarmRequest(args, mockEnv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.swarmSize, 2); // Should be adjusted to minimum
    });

    it('should handle empty message', async () => {
      const args = {
        message: '',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 3
      };

      const result = await handleSwarmRequest(args, mockEnv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.swarm, true);
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();

      const args = {
        message: 'Write a Python function',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 3
      };

      const result = await handleSwarmRequest(args, mockEnv);
      const duration = Date.now() - startTime;

      assert.strictEqual(result.success, true);
      assert.ok(duration < 5000); // Should complete within 5 seconds
      assert.ok(result.processingTimeMs > 0);
    });

    it('should track processing time accurately', async () => {
      const args = {
        message: 'Write a Python function',
        conversation: [],
        sessionId: 'test-session',
        swarmSize: 3
      };

      const result = await handleSwarmRequest(args, mockEnv);

      assert.ok(result.processingTimeMs > 0);
      assert.ok(result.processingTimeMs < 10000); // Should be reasonable
    });
  });
});
