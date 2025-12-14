/**
 * Test setup for unit tests
 * Handles crypto and other global dependencies
 */

import { webcrypto } from 'crypto';

// Set up global crypto for Node.js test environment
if (!global.crypto) {
  global.crypto = webcrypto;
}

// Mock Cloudflare Worker environment globals
global.ENV = {
  GITHUB_TOKEN: 'mock-github-token',
  GITHUB_REPO: 'test/repo',
  ALLOWED_EMAIL: 'test@example.com',
  SESSION_SECRET: 'mock-session-secret',
  CHALLENGES: new Map(),
  USAGE: new Map(),
  CONTEXT: new Map()
};

// Mock fetch for external API calls
global.fetch = async (url, options = {}) => {
  const urlStr = url.toString();
  
  // Mock GitHub API responses
  if (urlStr.includes('api.github.com')) {
    if (urlStr.includes('/contents/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: btoa('mock file content'),
          sha: 'mock-sha'
        })
      };
    }
    if (urlStr.includes('/pulls')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          number: 123,
          html_url: 'https://github.com/test/repo/pull/123'
        })
      };
    }
  }
  
  // Mock AI provider responses
  if (urlStr.includes('api.groq.com') || urlStr.includes('generativelanguage.googleapis.com') || urlStr.includes('dashscope.aliyuncs.com')) {
    let content = 'Mock AI response';
    
    // Return code for coding requests
    if (urlStr.includes('dashscope.aliyuncs.com')) {
      content = '```javascript\nfunction add(a, b) {\n  return a + b;\n}\n```';
    }
    
    // Qwen API format
    if (urlStr.includes('dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          output: {
            choices: [{ message: { content } }]
          },
          usage: { total_tokens: 100 }
        })
      };
    }
    
    // OpenAI-compatible format for other providers
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content } }],
        usage: { total_tokens: 100 }
      })
    };
  }
  
  return {
    ok: false,
    status: 404,
    text: async () => 'Not found'
  };
};

// Mock btoa/atob for base64 encoding/decoding
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

// Mock console methods for cleaner test output
global.console.log = () => {};
global.console.error = () => {};
global.console.warn = () => {};

export default global;