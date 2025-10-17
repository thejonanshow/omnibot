/**
 * Unit tests for function calling
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleFunctionCall } from '../cloudflare-worker/src/functions.js';

describe('Function Calling', () => {
  let mockEnv;
  let originalFetch;

  beforeEach(() => {
    mockEnv = {
      RUNLOOP_API_KEY: 'mock-runloop-key',
      RUNLOOP_DEVOX_ID: 'mock-devbox-id',
      CONTEXT: {
        data: {},
        async get(key) {
          return this.data[key];
        },
        async put(key, value) {
          this.data[key] = value;
        }
      }
    };

    // Save original fetch
    originalFetch = global.fetch;

    // Mock fetch
    global.fetch = mock.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({ output: 'success' })
    }));
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('handleFunctionCall', () => {
    it('should throw error for unknown function', async () => {
      await assert.rejects(
        async () => handleFunctionCall('unknown_function', {}, mockEnv, 'session1'),
        { message: 'Unknown function: unknown_function' }
      );
    });

    it('should require Runloop API key for execute_command', async () => {
      mockEnv.RUNLOOP_API_KEY = null;

      await assert.rejects(
        async () => handleFunctionCall('execute_command', { command: 'ls' }, mockEnv, 'session1'),
        { message: 'Runloop API key not configured' }
      );
    });

    it('should handle save_context without Runloop', async () => {
      const result = await handleFunctionCall(
        'save_context',
        { key: 'test', value: 'data' },
        mockEnv,
        'session1'
      );

      assert.equal(result.success, true);
      assert.equal(result.message, 'Saved test to context');
    });
  });

  describe('Execute Command', () => {
    it('should call Runloop API with correct parameters', async () => {
      global.fetch = mock.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({ output: 'success' })
      }));

      await handleFunctionCall(
        'execute_command',
        { command: 'echo hello' },
        mockEnv,
        'session1'
      );

      assert.equal(global.fetch.mock.calls.length, 1);
      const [url, options] = global.fetch.mock.calls[0].arguments;

      assert.ok(url.includes('/devboxes/'));
      assert.equal(options.method, 'POST');
      assert.ok(options.headers['Authorization'].includes('mock-runloop-key'));
      assert.ok(options.body.includes('echo hello'));
    });
  });

  describe('File Operations', () => {
    it('should read file with cat command', async () => {
      global.fetch = mock.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({ output: 'file contents' })
      }));

      await handleFunctionCall(
        'read_file',
        { path: '/path/to/file.txt' },
        mockEnv,
        'session1'
      );

      const [, options] = global.fetch.mock.calls[0].arguments;
      const callBody = JSON.parse(options.body);
      assert.ok(callBody.command.includes('cat'));
      assert.ok(callBody.command.includes('/path/to/file.txt'));
    });

    it('should write file with echo command', async () => {
      global.fetch = mock.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({ output: 'success' })
      }));

      await handleFunctionCall(
        'write_file',
        { path: '/path/to/file.txt', content: 'Hello World' },
        mockEnv,
        'session1'
      );

      const [, options] = global.fetch.mock.calls[0].arguments;
      const callBody = JSON.parse(options.body);
      assert.ok(callBody.command.includes('echo'));
      assert.ok(callBody.command.includes('/path/to/file.txt'));
    });

    it('should escape special characters in file content', async () => {
      global.fetch = mock.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({ output: 'success' })
      }));

      await handleFunctionCall(
        'write_file',
        { path: '/path/to/file.txt', content: 'Hello "World" with $variables' },
        mockEnv,
        'session1'
      );

      const [, options] = global.fetch.mock.calls[0].arguments;
      const callBody = JSON.parse(options.body);
      assert.ok(callBody.command.includes('\\"'));
      assert.ok(callBody.command.includes('\\$'));
    });

    it('should list files with ls command', async () => {
      global.fetch = mock.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({ output: 'file1\nfile2' })
      }));

      await handleFunctionCall(
        'list_files',
        { path: '/some/directory' },
        mockEnv,
        'session1'
      );

      const [, options] = global.fetch.mock.calls[0].arguments;
      const callBody = JSON.parse(options.body);
      assert.ok(callBody.command.includes('ls'));
      assert.ok(callBody.command.includes('/some/directory'));
    });

    it('should use current directory if no path provided', async () => {
      global.fetch = mock.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({ output: 'file1' })
      }));

      await handleFunctionCall(
        'list_files',
        {},
        mockEnv,
        'session1'
      );

      const [, options] = global.fetch.mock.calls[0].arguments;
      const callBody = JSON.parse(options.body);
      assert.ok(callBody.command.includes('.'));
    });
  });

  describe('Web Browsing', () => {
    it('should browse web with curl command', async () => {
      global.fetch = mock.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({ output: 'web content' })
      }));

      await handleFunctionCall(
        'browse_web',
        { url: 'https://example.com' },
        mockEnv,
        'session1'
      );

      const [, options] = global.fetch.mock.calls[0].arguments;
      const callBody = JSON.parse(options.body);
      assert.ok(callBody.command.includes('curl'));
      assert.ok(callBody.command.includes('https://example.com'));
    });

    it('should require Runloop API key for web browsing', async () => {
      mockEnv.RUNLOOP_API_KEY = null;

      await assert.rejects(
        async () => handleFunctionCall('browse_web', { url: 'https://example.com' }, mockEnv, 'session1'),
        { message: 'Runloop API key not configured' }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Runloop API failures gracefully', async () => {
      global.fetch = mock.fn(() => Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      }));

      const result = await handleFunctionCall('execute_command', { command: 'ls' }, mockEnv, 'session1');

      // The function should return the error response, not throw
      assert.ok(result.error);
      assert.equal(result.error, 'Internal server error');
    });

    it('should handle Runloop API failures without error field', async () => {
      global.fetch = mock.fn(() => Promise.resolve({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'Forbidden' })
      }));

      const result = await handleFunctionCall('execute_command', { command: 'ls' }, mockEnv, 'session1');

      // The function should return the error response with HTTP status
      assert.ok(result.error);
      assert.equal(result.error, 'HTTP 403: Forbidden');
    });

    it('should handle network failures', async () => {
      global.fetch = mock.fn(() => Promise.reject(new Error('Network error')));

      await assert.rejects(
        async () => handleFunctionCall('execute_command', { command: 'ls' }, mockEnv, 'session1'),
        { message: 'Network error' }
      );
    });
  });
});
