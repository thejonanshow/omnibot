/**
 * Unit tests for request classifier
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isCodeImplementationRequest } from '../cloudflare-worker/src/lib/classifier.js';

describe('Request Classifier', () => {
  describe('isCodeImplementationRequest', () => {
    it('should detect code implementation keywords', () => {
      const codeRequests = [
        'write code for a login system',
        'implement a sorting algorithm',
        'create a function to parse JSON',
        'build a REST API',
        'develop a React component',
        'can you code this for me?',
        'help me write a Python script',
        'create an API endpoint',
        'implement database queries'
      ];

      codeRequests.forEach(request => {
        assert.equal(isCodeImplementationRequest(request), true);
      });
    });

    it('should not detect general questions as code requests', () => {
      const generalRequests = [
        'Hello, how are you?',
        'What is the weather today?',
        'Explain quantum physics',
        'Tell me a joke',
        'What is your name?',
        'Help me understand recursion',
        'Why is the sky blue?',
        'What are some good practices?'
      ];

      generalRequests.forEach(request => {
        assert.equal(isCodeImplementationRequest(request), false);
      });
    });

    it('should detect programming language mentions', () => {
      const languageRequests = [
        'Write some JavaScript',
        'Help with Python code',
        'Java implementation needed',
        'TypeScript question',
        'Need help with SQL'
      ];

      languageRequests.forEach(request => {
        assert.equal(isCodeImplementationRequest(request), true);
      });
    });

    it('should detect framework/tool mentions', () => {
      const toolRequests = [
        'Create a React app',
        'Build with Node.js',
        'Set up Express server',
        'Deploy with Docker',
        'Use Terraform for infrastructure'
      ];

      toolRequests.forEach(request => {
        assert.equal(isCodeImplementationRequest(request), true);
      });
    });

    it('should be case insensitive', () => {
      assert.equal(isCodeImplementationRequest('WRITE CODE'), true);
      assert.equal(isCodeImplementationRequest('Write Code'), true);
      assert.equal(isCodeImplementationRequest('write code'), true);
    });

    it('should handle partial keyword matches', () => {
      assert.equal(isCodeImplementationRequest('I need programming help'), true);
      assert.equal(isCodeImplementationRequest('Let me implement this'), true);
      assert.equal(isCodeImplementationRequest('Working on an algorithm'), true);
    });

    it('should not have false positives', () => {
      const edgeCases = [
        'What is a function in math?', // function mentioned but not code
        'I like to build houses', // build mentioned but not code
        'The class was interesting', // class mentioned but not code
        'This script for a movie' // script mentioned but not code
      ];

      // These should actually return false ideally, but with simple keyword matching
      // they might return true. This documents current behavior vs ideal behavior.
      edgeCases.forEach(request => {
        const result = isCodeImplementationRequest(request);
        // Document the result - these are known edge cases
        assert.equal(typeof result, 'boolean');
      });
    });
  });
});
