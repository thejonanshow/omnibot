/**
 * Request classification utilities
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
