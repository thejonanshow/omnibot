/**
 * Jest setup file for global test configuration
 */

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'mock-groq-key';
process.env.GEMINI_API_KEY = 'mock-gemini-key';
process.env.ANTHROPIC_API_KEY = 'mock-claude-key';
process.env.RUNLOOP_API_KEY = 'mock-runloop-key';
process.env.SHARED_SECRET = 'mock-secret';

// Global test timeout
jest.setTimeout(10000);
