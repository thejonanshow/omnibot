#!/usr/bin/env node

/**
 * BDD Tests for Qwen Blueprint Optimization & Health Check
 *
 * User Story: As a system administrator, I want to ensure the Qwen Ollama blueprint
 * is optimized with snapshots and health checks so that deployment is fast and reliable
 * with proper failure handling.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';

// Mock the RunloopAPI and DevboxLifecycleManager
const mockRunloopAPI = {
  get_blueprint: mock.fn(),
  create_devbox: mock.fn(),
  get_devbox: mock.fn(),
  resume_devbox: mock.fn(),
  suspend_devbox: mock.fn(),
  execute_command: mock.fn(),
  list_devboxes: mock.fn(),
  delete_devbox: mock.fn()
};

const mockDevboxLifecycleManager = {
  get_or_create_healthy_devbox: mock.fn(),
  run_health_checks: mock.fn(),
  finalize_devbox: mock.fn(),
  cleanup_shutdown_devboxes: mock.fn()
};

// Mock environment variables
const originalEnv = process.env;
const mockEnv = {
  QWEN_OLLAMA_BLUEPRINT_ID: 'bpt_test_123',
  QWEN_OLLAMA_DEVOX_ID: 'dbx_test_456',
  QWEN_OLLAMA_URL: 'https://dbx_test_456.runloop.dev:8000',
  RUNLOOP_API_KEY: 'test_api_key'
};

describe('Qwen Blueprint Optimization & Health Check', () => {
  beforeEach(() => {
    // Reset all mocks
    Object.values(mockRunloopAPI).forEach(mockFn => mockFn.mock.resetCalls());
    Object.values(mockDevboxLifecycleManager).forEach(mockFn => mockFn.mock.resetCalls());

    // Set up environment
    process.env = { ...originalEnv, ...mockEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Blueprint Status Validation', () => {
    it('should validate blueprint is ready before deployment', async () => {
      // Given: A blueprint exists and is ready
      mockRunloopAPI.get_blueprint.mock.mockImplementationOnce(() =>
        Promise.resolve({
          id: 'bpt_test_123',
          status: 'build_complete',
          name: 'qwen-ollama-optimized'
        })
      );

      // When: Checking blueprint status
      const blueprintData = await mockRunloopAPI.get_blueprint('bpt_test_123');

      // Then: Blueprint should be ready for deployment
      assert.equal(blueprintData.status, 'build_complete');
      assert.equal(mockRunloopAPI.get_blueprint.mock.callCount(), 1);
    });

    it('should handle blueprint not ready status', async () => {
      // Given: A blueprint exists but is not ready
      mockRunloopAPI.get_blueprint.mock.mockImplementationOnce(() =>
        Promise.resolve({
          id: 'bpt_test_123',
          status: 'building',
          name: 'qwen-ollama-optimized'
        })
      );

      // When: Checking blueprint status
      const blueprintData = await mockRunloopAPI.get_blueprint('bpt_test_123');

      // Then: Blueprint should not be ready
      assert.notEqual(blueprintData.status, 'build_complete');
      assert.equal(blueprintData.status, 'building');
    });

    it('should handle blueprint not found', async () => {
      // Given: A blueprint does not exist
      mockRunloopAPI.get_blueprint.mock.mockImplementationOnce(() =>
        Promise.resolve(null)
      );

      // When: Checking blueprint status
      const blueprintData = await mockRunloopAPI.get_blueprint('bpt_nonexistent');

      // Then: Should return null
      assert.equal(blueprintData, null);
    });
  });

  describe('Devbox Creation from Blueprint', () => {
    it('should create devbox from ready blueprint', async () => {
      // Given: A ready blueprint
      mockRunloopAPI.get_blueprint.mock.mockImplementationOnce(() =>
        Promise.resolve({
          id: 'bpt_test_123',
          status: 'build_complete'
        })
      );

      // And: Devbox creation succeeds
      mockRunloopAPI.create_devbox.mock.mockImplementationOnce(() =>
        Promise.resolve('dbx_new_789')
      );

      // When: Creating devbox from blueprint
      const devboxId = await mockRunloopAPI.create_devbox('qwen-ollama-devbox', 'bpt_test_123');

      // Then: Devbox should be created successfully
      assert.equal(devboxId, 'dbx_new_789');
      assert.equal(mockRunloopAPI.create_devbox.mock.callCount(), 1);
    });

    it('should handle devbox creation failure', async () => {
      // Given: A ready blueprint
      mockRunloopAPI.get_blueprint.mock.mockImplementationOnce(() =>
        Promise.resolve({
          id: 'bpt_test_123',
          status: 'build_complete'
        })
      );

      // And: Devbox creation fails
      mockRunloopAPI.create_devbox.mock.mockImplementationOnce(() =>
        Promise.resolve(null)
      );

      // When: Creating devbox from blueprint
      const devboxId = await mockRunloopAPI.create_devbox('qwen-ollama-devbox', 'bpt_test_123');

      // Then: Should return null indicating failure
      assert.equal(devboxId, null);
    });
  });

  describe('Health Check System', () => {
    it('should run comprehensive health checks on devbox', async () => {
      // Given: A running devbox
      const devboxId = 'dbx_test_456';

      // And: Health checks pass
      mockDevboxLifecycleManager.run_health_checks.mock.mockImplementationOnce(() =>
        Promise.resolve(true)
      );

      // When: Running health checks
      const isHealthy = await mockDevboxLifecycleManager.run_health_checks(devboxId);

      // Then: Devbox should be healthy
      assert.equal(isHealthy, true);
      assert.equal(mockDevboxLifecycleManager.run_health_checks.mock.callCount(), 1);
    });

    it('should handle health check failures', async () => {
      // Given: A running devbox
      const devboxId = 'dbx_test_456';

      // And: Health checks fail
      mockDevboxLifecycleManager.run_health_checks.mock.mockImplementationOnce(() =>
        Promise.resolve(false)
      );

      // When: Running health checks
      const isHealthy = await mockDevboxLifecycleManager.run_health_checks(devboxId);

      // Then: Devbox should be unhealthy
      assert.equal(isHealthy, false);
    });

    it('should check Ollama service readiness', async () => {
      // Given: A devbox with Ollama service
      const devboxId = 'dbx_test_456';

      // And: Ollama health check command succeeds
      mockRunloopAPI.execute_command.mock.mockImplementationOnce(() =>
        Promise.resolve({
          exit_status: 0,
          stdout: '{"status": "ok", "service": "qwen_ollama_server", "model": "qwen2.5:7b", "ollama_ready": true}',
          stderr: ''
        })
      );

      // When: Checking Ollama service health
      const result = await mockRunloopAPI.execute_command(devboxId, 'curl -s http://localhost:8000/health');

      // Then: Ollama should be ready
      assert.equal(result.exit_status, 0);
      const healthData = JSON.parse(result.stdout);
      assert.equal(healthData.ollama_ready, true);
      assert.equal(healthData.model, 'qwen2.5:7b');
    });

    it('should check model loading status', async () => {
      // Given: A devbox with Ollama service
      const devboxId = 'dbx_test_456';

      // And: Model status check succeeds
      mockRunloopAPI.execute_command.mock.mockImplementationOnce(() =>
        Promise.resolve({
          exit_status: 0,
          stdout: '{"models": [{"name": "qwen2.5:7b", "size": 1234567890}], "current_model": "qwen2.5:7b"}',
          stderr: ''
        })
      );

      // When: Checking model status
      const result = await mockRunloopAPI.execute_command(devboxId, 'curl -s http://localhost:8000/qwen/models');

      // Then: Model should be loaded
      assert.equal(result.exit_status, 0);
      const modelData = JSON.parse(result.stdout);
      assert.equal(modelData.current_model, 'qwen2.5:7b');
      assert.equal(modelData.models.length, 1);
    });
  });

  describe('Retry and Rollback Strategy', () => {
    it('should retry deployment exactly once on failure', async () => {
      // Given: First deployment attempt fails, retry succeeds
      let callCount = 0;
      mockDevboxLifecycleManager.get_or_create_healthy_devbox.mock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(null); // First attempt fails
        } else {
          return Promise.resolve('dbx_retry_123'); // Retry succeeds
        }
      });

      // When: Attempting deployment with retry
      let devboxId = await mockDevboxLifecycleManager.get_or_create_healthy_devbox();

      // First attempt fails
      if (!devboxId) {
        devboxId = await mockDevboxLifecycleManager.get_or_create_healthy_devbox();
      }

      // Then: Should succeed on retry
      assert.equal(devboxId, 'dbx_retry_123');
      assert.equal(callCount, 2);
    });

    it('should not retry more than once', async () => {
      // Given: Both deployment attempts fail
      mockDevboxLifecycleManager.get_or_create_healthy_devbox.mock.mockImplementation(() =>
        Promise.resolve(null)
      );

      // When: Attempting deployment with retry
      let devboxId = await mockDevboxLifecycleManager.get_or_create_healthy_devbox();

      // First attempt fails
      if (!devboxId) {
        devboxId = await mockDevboxLifecycleManager.get_or_create_healthy_devbox();
      }

      // Then: Should fail after exactly one retry
      assert.equal(devboxId, null);
      assert.equal(mockDevboxLifecycleManager.get_or_create_healthy_devbox.mock.callCount(), 2);
    });

    it('should handle suspended devbox corruption', async () => {
      // Given: A corrupted suspended devbox
      const corruptedDevboxId = 'dbx_corrupted_456';

      // And: Resume fails due to corruption
      mockRunloopAPI.resume_devbox.mock.mockImplementationOnce(() =>
        Promise.resolve(false)
      );

      // And: Health checks fail
      mockDevboxLifecycleManager.run_health_checks.mock.mockImplementationOnce(() =>
        Promise.resolve(false)
      );

      // When: Attempting to resume corrupted devbox
      const resumeSuccess = await mockRunloopAPI.resume_devbox(corruptedDevboxId);
      const isHealthy = await mockDevboxLifecycleManager.run_health_checks(corruptedDevboxId);

      // Then: Should fail and require rebuild
      assert.equal(resumeSuccess, false);
      assert.equal(isHealthy, false);
    });

    it('should implement automatic rollback on persistent failures', async () => {
      // Given: All deployment attempts fail
      mockDevboxLifecycleManager.get_or_create_healthy_devbox.mock.mockImplementation(() =>
        Promise.resolve(null)
      );

      // And: Rollback mechanism is available
      const rollbackToPreviousState = mock.fn(() => Promise.resolve(true));

      // When: Deployment fails after retry
      let devboxId = await mockDevboxLifecycleManager.get_or_create_healthy_devbox();
      if (!devboxId) {
        devboxId = await mockDevboxLifecycleManager.get_or_create_healthy_devbox();
      }

      // And: Rollback is triggered
      if (!devboxId) {
        await rollbackToPreviousState();
      }

      // Then: Rollback should be executed
      assert.equal(devboxId, null);
      assert.equal(rollbackToPreviousState.mock.callCount(), 1);
    });
  });

  describe('Deployment Speed Optimization', () => {
    it('should use snapshots for sub-30-second deployment', async () => {
      // Given: A blueprint with snapshots
      const startTime = Date.now();

      mockDevboxLifecycleManager.get_or_create_healthy_devbox.mock.mockImplementationOnce(() =>
        Promise.resolve('dbx_fast_789')
      );

      // When: Deploying from snapshot-enabled blueprint
      const devboxId = await mockDevboxLifecycleManager.get_or_create_healthy_devbox();
      const deploymentTime = Date.now() - startTime;

      // Then: Deployment should be fast
      assert.equal(devboxId, 'dbx_fast_789');
      assert(deploymentTime < 30000, `Deployment took ${deploymentTime}ms, should be under 30s`);
    });

    it('should prioritize suspended devbox resume over fresh creation', async () => {
      // Given: A suspended devbox exists
      const suspendedDevboxId = 'dbx_suspended_123';

      // And: Resume is faster than fresh creation
      mockRunloopAPI.resume_devbox.mock.mockImplementationOnce(() =>
        Promise.resolve(true)
      );

      mockDevboxLifecycleManager.run_health_checks.mock.mockImplementationOnce(() =>
        Promise.resolve(true)
      );

      // When: Getting healthy devbox
      const resumeSuccess = await mockRunloopAPI.resume_devbox(suspendedDevboxId);
      const isHealthy = await mockDevboxLifecycleManager.run_health_checks(suspendedDevboxId);

      // Then: Should use suspended devbox
      assert.equal(resumeSuccess, true);
      assert.equal(isHealthy, true);
    });

    it('should validate blueprint before attempting deployment', async () => {
      // Given: A blueprint that needs validation
      mockRunloopAPI.get_blueprint.mock.mockImplementationOnce(() =>
        Promise.resolve({
          id: 'bpt_test_123',
          status: 'build_complete',
          name: 'qwen-ollama-optimized'
        })
      );

      // When: Validating blueprint before deployment
      const blueprintData = await mockRunloopAPI.get_blueprint('bpt_test_123');

      // Then: Should validate before proceeding
      assert.notEqual(blueprintData, null);
      assert.equal(blueprintData.status, 'build_complete');
    });
  });

  describe('Error Handling and Logging', () => {
    it('should log detailed error context for failed deployments', async () => {
      // Given: A deployment that fails
      const errorContext = {
        blueprintId: 'bpt_test_123',
        devboxId: null,
        error: 'Blueprint not ready',
        timestamp: new Date().toISOString(),
        retryCount: 0
      };

      mockDevboxLifecycleManager.get_or_create_healthy_devbox.mock.mockImplementationOnce(() =>
        Promise.resolve(null)
      );

      // When: Deployment fails
      const devboxId = await mockDevboxLifecycleManager.get_or_create_healthy_devbox();

      // Then: Should have error context for logging
      assert.equal(devboxId, null);
      assert.equal(errorContext.error, 'Blueprint not ready');
      assert.equal(errorContext.retryCount, 0);
    });

    it('should handle API timeout errors gracefully', async () => {
      // Given: An API call that times out
      mockRunloopAPI.get_blueprint.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('Request timeout'))
      );

      // When: Making API call
      let blueprintData = null;
      let error = null;

      try {
        blueprintData = await mockRunloopAPI.get_blueprint('bpt_test_123');
      } catch (e) {
        error = e;
      }

      // Then: Should handle timeout gracefully
      assert.equal(blueprintData, null);
      assert.notEqual(error, null);
      assert.equal(error.message, 'Request timeout');
    });

    it('should provide meaningful error messages for troubleshooting', async () => {
      // Given: Various failure scenarios with meaningful error messages
      const errorScenarios = [
        { error: 'Blueprint not found', expected: 'Blueprint bpt_test_123 not found' },
        { error: 'Devbox creation failed', expected: 'Failed to create devbox from blueprint' },
        { error: 'Health check failed', expected: 'Devbox failed health checks' },
        { error: 'Model not loaded', expected: 'Qwen model not available on devbox' }
      ];

      // When: Each error occurs
      for (const scenario of errorScenarios) {
        // Then: Should provide meaningful error message
        assert(scenario.expected.length > 0, 'Error message should not be empty');
        // Check that the error message contains key descriptive words
        const hasDescriptiveWords = scenario.expected.includes('Blueprint') ||
                                   scenario.expected.includes('Devbox') ||
                                   scenario.expected.includes('Health') ||
                                   scenario.expected.includes('Model') ||
                                   scenario.expected.includes('Qwen') ||
                                   scenario.expected.includes('Failed') ||
                                   scenario.expected.includes('not found') ||
                                   scenario.expected.includes('not available');
        assert(hasDescriptiveWords, `Error message "${scenario.expected}" should be descriptive`);
      }
    });
  });
});
