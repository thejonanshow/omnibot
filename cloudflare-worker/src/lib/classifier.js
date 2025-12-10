/**
 * Request classification utilities
 * 
 * Determines request type for routing to appropriate models/handlers.
 */

/**
 * Classify if a message is requesting code implementation
 * 
 * Uses keyword matching to detect code-related requests that should
 * be routed to code-optimized models like Qwen or Codellama.
 * 
 * @param {string} message - User message to classify
 * @returns {boolean} True if message is requesting code implementation
 */
export function isCodeImplementationRequest(message) {
  const codeKeywords = [
    'write code', 'implement', 'create a function', 'build a', 'develop',
    'programming', 'code', 'script', 'algorithm', 'function', 'class',
    'api', 'endpoint', 'database', 'sql', 'javascript', 'python', 'java',
    'react', 'vue', 'angular', 'node', 'express', 'flask', 'django',
    'html', 'css', 'typescript', 'json', 'xml', 'yaml', 'docker',
    'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'ansible'
  ];

  const messageLower = message.toLowerCase();
  return codeKeywords.some(keyword => messageLower.includes(keyword));
}
