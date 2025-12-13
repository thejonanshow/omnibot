/**
 * Security and validation module for OmniBot
 * Handles input validation, sanitization, and security checks
 */

import { REQUIRED_FUNCTIONS } from './config.js';

// Object pool for validation results
const validationPool = [];
const MAX_POOL_SIZE = 10;

function getValidationResult() {
  return validationPool.pop() || { isValid: true, errors: [], warnings: [] };
}

function releaseValidationResult(result) {
  if (validationPool.length < MAX_POOL_SIZE) {
    result.errors.length = 0;
    result.warnings.length = 0;
    result.isValid = true;
    validationPool.push(result);
  }
}

// Precompile regex patterns for performance
const MALICIOUS_PATTERNS = [
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /setTimeout\s*\(/gi,
  /setInterval\s*\(/gi,
  /require\s*\(\s*['"`].*child_process/gi,
  /spawn\s*\(/gi,
  /exec\s*\(/gi,
  /execSync\s*\(/gi
];

const DANGEROUS_PATTERNS = [
  /process\.exit/gi,
  /require\s*\(\s*['"`][fs]['"`]\s*\)/gi,
  /require\s*\(\s*['"`][child_process]['"`]\s*\)/gi,
  /fs\.unlink/gi,
  /fs\.rmdir/gi,
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /setTimeout\s*\(\s*['"`]\s*['"`]\s*,\s*0\s*\)/gi
];

const INFINITE_LOOP_PATTERNS = [
  /while\s*\(\s*true\s*\)/gi,
  /for\s*\(\s*;\s*;\s*\)/gi,
  /do\s*{[^}]*}\s*while\s*\(\s*true\s*\)/gi
];

const SECRET_PATTERNS = [
  /['"`]?[A-Za-z0-9]{40}['"`]?/gi,
  /['"`]?sk-[A-Za-z0-9]{48}['"`]?/gi,
  /['"`]?AIza[0-9A-Za-z\-_]{35}['"`]?/gi,
  /password\s*=\s*['"`][^'"`]+['"`]/gi,
  /api[_-]?key\s*=\s*['"`][^'"`]+['"`]/gi,
  /secret\s*=\s*['"`][^'"`]+['"`]/gi
];

/**
 * Validate user input for code editing
 */
export function validateEditInput(instruction, options = {}) {
  const errors = [];
  
  // Check instruction length
  if (!instruction || instruction.trim().length === 0) {
    errors.push('Instruction cannot be empty');
  }
  
  if (instruction.length > 10000) {
    errors.push('Instruction too long (max 10000 characters)');
  }
  
  // Check for potentially malicious patterns
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(instruction)) {
      errors.push(`Potentially malicious pattern detected: ${pattern.source}`);
    }
  }
  
  // Check for SQL injection patterns (even though we're not using SQL)
  const sqlPatterns = [
    /';\s*--/gi,
    /"\s*OR\s*1\s*=\s*1/gi,
    /UNION\s+SELECT/gi,
    /DROP\s+TABLE/gi,
    /INSERT\s+INTO/gi,
    /UPDATE\s+.*SET/gi,
    /DELETE\s+FROM/gi
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(instruction)) {
      errors.push(`SQL injection pattern detected: ${pattern.source}`);
    }
  }
  
  // Check for XSS patterns
  const xssPatterns = [
    /<script[^>]*>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onload, etc.
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi
  ];
  
  for (const pattern of xssPatterns) {
    if (pattern.test(instruction)) {
      errors.push(`XSS pattern detected: ${pattern.source}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate generated code before applying
 */
export function validateGeneratedCode(code, originalCode) {
  const result = getValidationResult();
  const { errors, warnings } = result;
  
  // Basic syntax validation
  try {
    // Try to parse as JavaScript (basic check)
    new Function(code);
  } catch (error) {
    errors.push(`Syntax error: ${error.message}`);
  }
  
  // Check for required functions
  for (const requiredFunction of REQUIRED_FUNCTIONS) {
    if (!code.includes(requiredFunction)) {
      warnings.push(`Required function may be missing: ${requiredFunction}`);
    }
  }
  
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`Dangerous pattern detected: ${pattern.source}`);
    }
  }
  
  // Check for infinite loops
  for (const pattern of INFINITE_LOOP_PATTERNS) {
    if (pattern.test(code)) {
      warnings.push(`Potential infinite loop detected: ${pattern.source}`);
    }
  }
  
  // Check for hardcoded secrets
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(code)) {
      warnings.push(`Potential hardcoded secret detected: ${pattern.source}`);
    }
  }
  
  // Size validation
  if (code.length > 100000) { // 100KB limit
    errors.push('Generated code too large (max 100KB)');
  }
  
  result.isValid = errors.length === 0;
  
  // Return pooled result (caller should release when done)
  return result;
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Limit length
  if (sanitized.length > 50000) {
    sanitized = sanitized.substring(0, 50000);
  }
  
  // Basic HTML encoding for display
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // Prevent script injection patterns
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '');
  
  return sanitized;
}

/**
 * Validate patch format
 */
export function validatePatch(patch) {
  const errors = [];
  
  if (typeof patch !== 'string') {
    errors.push('Patch must be a string');
    return { isValid: false, errors };
  }
  
  // Basic patch format validation
  const lines = patch.split('\n');
  let hasAdditions = false;
  let hasDeletions = false;
  
  for (const line of lines) {
    if (line.startsWith('+')) {
      hasAdditions = true;
    } else if (line.startsWith('-')) {
      hasDeletions = true;
    }
  }
  
  if (!hasAdditions && !hasDeletions) {
    errors.push('Patch must contain additions or deletions');
  }
  
  // Check for suspicious patterns in patches
  const suspiciousPatterns = [
    /^\+.*eval\s*\(/gm,
    /^\+.*Function\s*\(/gm,
    /^\+.*require\s*\(\s*['"`]child_process['"`]\s*\)/gm,
    /^\+.*process\.exit/gm
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(patch)) {
      errors.push(`Suspicious pattern in patch: ${pattern.source}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Rate limiting check
 */
export class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }
  
  async checkLimit(identifier, env) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get current request count from KV store
    const key = `rate_limit:${identifier}`;
    const data = await env.USAGE.get(key);
    let requestData = data ? JSON.parse(data) : { count: 0, windowStart: now };
    
    // Reset if window has passed
    if (requestData.windowStart < windowStart) {
      requestData = { count: 0, windowStart: now };
    }
    
    // Check if limit exceeded
    if (requestData.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: requestData.windowStart + this.windowMs
      };
    }
    
    // Increment count
    requestData.count++;
    
    // Store updated data
    await env.USAGE.put(key, JSON.stringify(requestData), {
      expirationTtl: Math.ceil(this.windowMs / 1000)
    });
    
    return {
      allowed: true,
      remaining: this.maxRequests - requestData.count,
      resetTime: requestData.windowStart + this.windowMs
    };
  }
}

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  constructor(threshold, timeoutMs) {
    this.threshold = threshold;
    this.timeoutMs = timeoutMs;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed'; // closed, open, half-open
  }
  
  async execute(operation, env, serviceName) {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error(`${serviceName} service unavailable (circuit breaker open)`);
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
        console.error(`[CircuitBreaker] ${serviceName} circuit opened after ${this.failures} failures`);
      }
      
      throw error;
    }
  }
}

/**
 * Distributed locking mechanism
 */
export class DistributedLock {
  constructor(env, timeoutMs = 30000, retryDelayMs = 1000) {
    this.env = env;
    this.timeoutMs = timeoutMs;
    this.retryDelayMs = retryDelayMs;
  }
  
  async acquire(lockKey, ownerId) {
    const lockValue = JSON.stringify({
      owner: ownerId,
      timestamp: Date.now(),
      expires: Date.now() + this.timeoutMs
    });
    
    // Try to acquire lock
    const existingLock = await this.env.CONTEXT.get(lockKey);
    if (existingLock) {
      const lockData = JSON.parse(existingLock);
      
      // Check if lock is expired
      if (Date.now() > lockData.expires) {
        // Lock is expired, remove it
        await this.env.CONTEXT.delete(lockKey);
      } else {
        // Lock is held by someone else
        return false;
      }
    }
    
    // Acquire the lock
    await this.env.CONTEXT.put(lockKey, lockValue, {
      expirationTtl: Math.ceil(this.timeoutMs / 1000)
    });
    
    return true;
  }
  
  async release(lockKey, ownerId) {
    const existingLock = await this.env.CONTEXT.get(lockKey);
    if (!existingLock) {
      return true; // Lock doesn't exist
    }
    
    const lockData = JSON.parse(existingLock);
    
    // Only release if we own the lock
    if (lockData.owner === ownerId) {
      await this.env.CONTEXT.delete(lockKey);
      return true;
    }
    
    return false; // We don't own this lock
  }
  
  async withLock(lockKey, ownerId, operation) {
    const acquired = await this.acquire(lockKey, ownerId);
    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${lockKey}`);
    }
    
    try {
      return await operation();
    } finally {
      await this.release(lockKey, ownerId);
    }
  }
}

export default {
  validateEditInput,
  validateGeneratedCode,
  sanitizeInput,
  validatePatch,
  RateLimiter,
  CircuitBreaker,
  DistributedLock
};