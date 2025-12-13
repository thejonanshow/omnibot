/**
 * Configuration module for OmniBot
 * Centralizes all configuration and constants
 */

// GitHub configuration
export const GITHUB_REPO = process.env.GITHUB_REPO || 'thejonanshow/omnibot';
export const GITHUB_API_URL = 'https://api.github.com';

// Authentication configuration
export const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL || 'jonanscheffler@gmail.com';
export const SESSION_DURATION_MS = parseInt(process.env.SESSION_DURATION_MS) || 24 * 60 * 60 * 1000; // 24 hours

// Version information
export const VERSION = {
  major: parseInt(process.env.VERSION_MAJOR) || 1,
  minor: parseInt(process.env.VERSION_MINOR) || 1,
  patch: parseInt(process.env.VERSION_PATCH) || 1,
  codename: process.env.VERSION_CODENAME || 'Electric Eel',
  emoji: process.env.VERSION_EMOJI || '⚡',
  wiki: process.env.VERSION_WIKI || 'https://en.wikipedia.org/wiki/Electric_eel'
};

export const VERSION_STRING = `v${VERSION.major}.${VERSION.minor}.${VERSION.patch}`;
export const VERSION_FULL = `${VERSION.emoji} ${VERSION.codename} ${VERSION_STRING}`;

// Precompute version string for performance
const VERSION_CACHE = new Map();
VERSION_CACHE.set('string', VERSION_STRING);
VERSION_CACHE.set('full', VERSION_FULL);

// AI Provider configuration
export const AI_PROVIDERS = {
  // Purpose-based model chains (will try in order)
  planning: [
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'gemini', model: 'gemini-2.0-flash' },
    { provider: 'groq', model: 'llama-3.1-8b-instant' }
  ],
  coding: [
    { provider: 'groq', model: 'llama-3.1-8b-instant' },
    { provider: 'groq', model: 'openai/gpt-oss-20b' },
    { provider: 'gemini', model: 'gemini-2.0-flash' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' }
  ],
  review: [
    { provider: 'gemini', model: 'gemini-2.0-flash' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' }
  ],
  chat: [
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'groq', model: 'openai/gpt-oss-20b' },
    { provider: 'gemini', model: 'gemini-2.0-flash' }
  ]
};

// Precompute master prompt parts for better performance
const MASTER_PROMPT_PARTS = [
  'You are OmniBot, a self-editing AI assistant.',
  `Project Context:\n- Repository: ${GITHUB_REPO}\n- Platform: Cloudflare Workers\n- LLM Provider: Groq (Llama 3.3 70B, Qwen 2.5)\n- Version: ${VERSION_STRING}`,
  'Capabilities:\n- Chat with users\n- Edit your own source code\n- Access shared context via KV\n- Full safety validation before commits',
  'Rules:\n- Never remove required functions\n- Always preserve HTML UI\n- Code must work in Cloudflare Workers (no browser APIs in runtime)\n- Validate all changes before committing'
];

// Master prompt
export const DEFAULT_MASTER_PROMPT = MASTER_PROMPT_PARTS.join('\n\n');

// Required functions for self-editing
export const REQUIRED_FUNCTIONS = [
  'async function selfEdit',
  'async function callAI',
  'async function githubGet',
  'async function githubPut',
  'export default'
];

// API Endpoints
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Qwen API configuration
export const QWEN_API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
export const QWEN_OPENAI_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000; // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

// Circuit breaker configuration
export const CIRCUIT_BREAKER_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5;
export const CIRCUIT_BREAKER_TIMEOUT_MS = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS) || 60 * 1000; // 1 minute

// Distributed locking
export const LOCK_TIMEOUT_MS = parseInt(process.env.LOCK_TIMEOUT_MS) || 30 * 1000; // 30 seconds
export const LOCK_RETRY_DELAY_MS = parseInt(process.env.LOCK_RETRY_DELAY_MS) || 1000; // 1 second

export default {
  GITHUB_REPO,
  GITHUB_API_URL,
  ALLOWED_EMAIL,
  SESSION_DURATION_MS,
  VERSION,
  VERSION_STRING,
  VERSION_FULL,
  AI_PROVIDERS,
  DEFAULT_MASTER_PROMPT,
  REQUIRED_FUNCTIONS,
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  QWEN_API_ENDPOINT,
  QWEN_OPENAI_ENDPOINT,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_TIMEOUT_MS,
  LOCK_TIMEOUT_MS,
  LOCK_RETRY_DELAY_MS
};