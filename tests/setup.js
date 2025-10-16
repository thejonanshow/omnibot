/**
 * Jest setup file for global test configuration
 */

import { jest } from '@jest/globals';
import { randomUUID } from 'crypto';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock crypto.randomUUID for Node < 19 or browser-like behavior
if (!global.crypto) {
  global.crypto = {
    randomUUID: randomUUID
  };
}

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'mock-groq-key';
process.env.GEMINI_API_KEY = 'mock-gemini-key';
process.env.ANTHROPIC_API_KEY = 'mock-claude-key';
process.env.RUNLOOP_API_KEY = 'mock-runloop-key';
process.env.SHARED_SECRET = 'mock-secret';

// Global test timeout
jest.setTimeout(10000);
