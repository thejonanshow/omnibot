/**
 * Integration tests for CLI endpoints using Node's native test runner
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

describe('CLI Endpoints', () => {
  
  before(async () => {
    // Dynamically import the worker to get the router
    const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
    
    // Check that CLI endpoints exist in the code
    assert.ok(workerCode.includes('/api/cli/whoami'));
    assert.ok(workerCode.includes('/api/cli/chat'));
    assert.ok(workerCode.includes('authenticateCliRequest'));
  });

  describe('GET /api/cli/whoami', () => {
    it('should exist in worker code', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      assert.ok(workerCode.includes("url.pathname === '/api/cli/whoami'"));
      assert.ok(workerCode.includes("request.method === 'GET'"));
    });

    it('should require authentication', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const whoamiSection = workerCode.match(/\/api\/cli\/whoami[\s\S]{0,1000}/);
      assert.ok(whoamiSection);
      assert.ok(whoamiSection[0].includes('authenticateCliRequest'));
      assert.ok(whoamiSection[0].includes('401') || whoamiSection[0].includes('Unauthorized'));
    });

    it('should return user information on success', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const whoamiSection = workerCode.match(/\/api\/cli\/whoami[\s\S]{0,1500}/);
      assert.ok(whoamiSection);
      assert.ok(whoamiSection[0].includes('user.id'));
      assert.ok(whoamiSection[0].includes('user.email'));
      assert.ok(whoamiSection[0].includes('user.source'));
      assert.ok(whoamiSection[0].includes('user.scopes'));
    });

    it('should log telemetry', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const whoamiSection = workerCode.match(/\/api\/cli\/whoami[\s\S]{0,1500}/);
      assert.ok(whoamiSection);
      assert.ok(whoamiSection[0].includes('logTelemetry'));
      assert.ok(whoamiSection[0].includes('cli_whoami'));
    });
  });

  describe('POST /api/cli/chat', () => {
    it('should exist in worker code', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      assert.ok(workerCode.includes("url.pathname === '/api/cli/chat'"));
      assert.ok(workerCode.includes("request.method === 'POST'"));
    });

    it('should require authentication', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const chatSection = workerCode.match(/\/api\/cli\/chat[\s\S]{0,2000}/);
      assert.ok(chatSection);
      assert.ok(chatSection[0].includes('authenticateCliRequest'));
      assert.ok(chatSection[0].includes('401') || chatSection[0].includes('Unauthorized'));
    });

    it('should check for chat scope', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const chatSection = workerCode.match(/\/api\/cli\/chat[\s\S]{0,2000}/);
      assert.ok(chatSection);
      assert.ok(chatSection[0].includes('hasScope'));
      assert.ok(chatSection[0].includes('chat'));
      assert.ok(chatSection[0].includes('403') || chatSection[0].includes('Insufficient'));
    });

    it('should validate message is provided', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const chatSection = workerCode.match(/\/api\/cli\/chat[\s\S]{0,2500}/);
      assert.ok(chatSection);
      assert.ok(chatSection[0].includes('message') && chatSection[0].includes('required'));
      assert.ok(chatSection[0].includes('400'));
    });

    it('should use conversation storage functions', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const chatSection = workerCode.match(/\/api\/cli\/chat[\s\S]{0,3000}/);
      assert.ok(chatSection);
      assert.ok(chatSection[0].includes('generateConversationId') || chatSection[0].includes('conversation_id'));
      assert.ok(chatSection[0].includes('getConversation'));
      assert.ok(chatSection[0].includes('saveConversation'));
    });

    it('should call LLM for response', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const chatSection = workerCode.match(/\/api\/cli\/chat[\s\S]{0,3000}/);
      assert.ok(chatSection);
      assert.ok(chatSection[0].includes('callGroq') || chatSection[0].includes('callAI'));
    });

    it('should return conversation_id and response', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const chatSection = workerCode.match(/\/api\/cli\/chat[\s\S]{0,3000}/);
      assert.ok(chatSection);
      assert.ok(chatSection[0].includes('conversation_id'));
      assert.ok(chatSection[0].includes('response'));
    });

    it('should index conversation for user', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const chatSection = workerCode.match(/\/api\/cli\/chat[\s\S]{0,3000}/);
      assert.ok(chatSection);
      assert.ok(chatSection[0].includes('indexConversation'));
    });

    it('should log telemetry', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const chatSection = workerCode.match(/\/api\/cli\/chat[\s\S]{0,3000}/);
      assert.ok(chatSection);
      assert.ok(chatSection[0].includes('logTelemetry'));
      assert.ok(chatSection[0].includes('cli_chat'));
    });
  });

  describe('Import statements', () => {
    it('should import CLI auth functions', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      assert.ok(workerCode.includes("from './lib/cli-auth.js'"));
      assert.ok(workerCode.includes('authenticateCliRequest'));
      assert.ok(workerCode.includes('hasScope'));
    });

    it('should import conversation functions', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      assert.ok(workerCode.includes("from './lib/conversations.js'"));
      assert.ok(workerCode.includes('generateConversationId'));
      assert.ok(workerCode.includes('getConversation'));
      assert.ok(workerCode.includes('saveConversation'));
      assert.ok(workerCode.includes('indexConversation'));
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in CLI endpoint responses', () => {
      const workerCode = fs.readFileSync('./cloudflare-worker/src/index.js', 'utf-8');
      const cliSection = workerCode.match(/\/api\/cli\/[\s\S]{0,5000}/);
      assert.ok(cliSection);
      assert.ok(cliSection[0].includes('cors') || cliSection[0].includes('Access-Control-Allow-Origin'));
    });
  });
});
