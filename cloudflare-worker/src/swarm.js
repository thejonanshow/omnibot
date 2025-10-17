/**
 * Swarm Integration for Cloudflare Worker
 * Handles swarm mode requests and orchestrates multiple Qwen instances
 */

import { callQwen } from './llm-providers.js';

/**
 * Swarm configuration
 */
const SWARM_CONFIG = {
  DEFAULT_SIZE: 3,
  MAX_SIZE: 7,
  MIN_SIZE: 2,
  TIMEOUT_MS: 60000, // 60 seconds
  QUALITY_THRESHOLD: 0.7
};

/**
 * Swarm request handler
 * @param {Object} args - Request arguments
 * @param {string} args.message - The task message
 * @param {Array} args.conversation - Conversation history
 * @param {string} args.sessionId - Session ID
 * @param {number} args.swarmSize - Optional swarm size
 * @param {Object} env - Environment variables
 * @returns {Object} Swarm result
 */
export async function handleSwarmRequest(args, env) {
  const { message, conversation = [], sessionId, swarmSize = SWARM_CONFIG.DEFAULT_SIZE } = args;

  console.log(`[SWARM] Processing swarm request: ${message.substring(0, 50)}...`);
  console.log(`[SWARM] Swarm size: ${swarmSize}`);

  try {
    // Validate swarm size
    const validatedSwarmSize = Math.max(
      SWARM_CONFIG.MIN_SIZE,
      Math.min(swarmSize, SWARM_CONFIG.MAX_SIZE)
    );

    if (validatedSwarmSize !== swarmSize) {
      console.log(`[SWARM] Adjusted swarm size from ${swarmSize} to ${validatedSwarmSize}`);
    }

    // Process with swarm
    const result = await processSwarmTask(message, conversation, sessionId, validatedSwarmSize, env);

    console.log(`[SWARM] Swarm processing complete: ${result.successful_instances}/${validatedSwarmSize} instances`);

    return {
      success: true,
      swarm: true,
      swarmSize: validatedSwarmSize,
      successfulInstances: result.successful_instances,
      processingTimeMs: result.processing_time_ms,
      consensusResponse: result.consensus_response,
      qualityAnalysis: result.quality_analysis,
      responses: result.responses.map(r => ({
        instanceId: r.instance_id,
        qualityScore: r.quality_score,
        responseTimeMs: r.response_time_ms
      })),
      usedProviders: ['qwen-swarm']
    };

  } catch (error) {
    console.error(`[SWARM] Swarm processing failed:`, error);

    // Fallback to single Qwen instance
    console.log(`[SWARM] Falling back to single Qwen instance`);
    try {
      const fallbackResult = await callQwen(message, conversation, env, sessionId);
      return {
        success: true,
        swarm: false,
        fallback: true,
        response: fallbackResult.response,
        usedProviders: ['qwen-fallback']
      };
    } catch (fallbackError) {
      console.error(`[SWARM] Fallback also failed:`, fallbackError);
      throw new Error(`Swarm processing failed: ${error.message}`);
    }
  }
}

/**
 * Process task with swarm of Qwen instances
 * @param {string} task - The task to process
 * @param {Array} conversation - Conversation history
 * @param {string} sessionId - Session ID
 * @param {number} swarmSize - Number of instances to use
 * @param {Object} env - Environment variables
 * @returns {Object} Swarm result
 */
async function processSwarmTask(task, conversation, sessionId, swarmSize, env) {
  const startTime = Date.now();

  // Get swarm instances
  const instances = await getSwarmInstances(swarmSize, env);
  if (instances.length === 0) {
    throw new Error('No swarm instances available');
  }

  console.log(`[SWARM] Using ${instances.length} instances for processing`);

  // Process task in parallel
  const processingPromises = instances.map(instance =>
    processWithInstance(instance, task, conversation, sessionId, env)
  );

  // Wait for all responses with timeout
  const responses = await Promise.allSettled(processingPromises);

  // Process results
  const validResponses = [];
  const errors = [];

  responses.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      validResponses.push(result.value);
    } else {
      const error = result.status === 'rejected' ? result.reason : 'Unknown error';
      errors.push(`Instance ${index + 1}: ${error}`);
    }
  });

  if (validResponses.length === 0) {
    throw new Error(`All swarm instances failed: ${errors.join(', ')}`);
  }

  console.log(`[SWARM] ${validResponses.length}/${instances.length} instances responded successfully`);

  // Collate responses
  const collatedResult = collateResponses(task, validResponses);

  const processingTime = Date.now() - startTime;
  collatedResult.processing_time_ms = processingTime;
  collatedResult.swarm_size = swarmSize;
  collatedResult.successful_instances = validResponses.length;

  return collatedResult;
}

/**
 * Get swarm instances
 * @param {number} swarmSize - Number of instances needed
 * @param {Object} env - Environment variables
 * @returns {Array} Array of instance URLs
 */
async function getSwarmInstances(swarmSize, env) {
  // For now, we'll use the same Qwen URL multiple times
  // In a real implementation, this would manage multiple Runloop devboxes
  const baseUrl = env.QWEN_RUNLOOP_URL;
  if (!baseUrl) {
    throw new Error('QWEN_RUNLOOP_URL not configured');
  }

  // Create multiple instances (in real implementation, these would be different devboxes)
  const instances = [];
  for (let i = 0; i < swarmSize; i++) {
    instances.push({
      id: `swarm-${i + 1}`,
      url: baseUrl,
      index: i
    });
  }

  return instances;
}

/**
 * Process task with a single instance
 * @param {Object} instance - Instance configuration
 * @param {string} task - Task to process
 * @param {Array} conversation - Conversation history
 * @param {string} sessionId - Session ID
 * @param {Object} env - Environment variables
 * @returns {Object} Response from instance
 */
async function processWithInstance(instance, task, conversation, sessionId, env) {
  const startTime = Date.now();

  try {
    // Add some variation to the task to get different perspectives
    const variedTask = addTaskVariation(task, instance.index);

    // Call Qwen with the varied task
    const result = await callQwen(variedTask, conversation, env, `${sessionId}-${instance.id}`);

    const responseTime = Date.now() - startTime;

    // Calculate quality score
    const qualityScore = calculateQualityScore(result.response);

    return {
      instance_id: instance.id,
      response: result.response,
      quality_score: qualityScore,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString(),
      metadata: {
        original_task: task,
        varied_task: variedTask,
        instance_url: instance.url
      }
    };

  } catch (error) {
    console.error(`[SWARM] Instance ${instance.id} failed:`, error);
    throw error;
  }
}

/**
 * Add variation to task for different perspectives
 * @param {string} task - Original task
 * @param {number} index - Instance index
 * @returns {string} Varied task
 */
function addTaskVariation(task, index) {
  const variations = [
    task, // Original task
    `${task} Please provide a detailed implementation with examples.`,
    `${task} Focus on best practices and error handling.`,
    `${task} Include comprehensive documentation and comments.`,
    `${task} Optimize for performance and efficiency.`,
    `${task} Make it production-ready with proper validation.`,
    `${task} Include unit tests and edge case handling.`
  ];

  return variations[index % variations.length];
}

/**
 * Calculate quality score for a response
 * @param {string} response - Response text
 * @returns {number} Quality score (0-1)
 */
function calculateQualityScore(response) {
  if (!response || typeof response !== 'string') {
    return 0.0;
  }

  let score = 0.0;

  // Check for code presence
  if (response.includes('```') || response.includes('def ') || response.includes('function ')) {
    score += 0.3;
  }

  // Check for explanation
  if (response.length > 200) {
    score += 0.2;
  }

  // Check for structure
  const structureKeywords = ['implementation', 'example', 'usage', 'test', 'function', 'class'];
  if (structureKeywords.some(keyword => response.toLowerCase().includes(keyword))) {
    score += 0.2;
  }

  // Check for completeness
  if (response.length > 500) {
    score += 0.2;
  }

  // Check for formatting
  if ((response.match(/\n/g) || []).length > 5) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Collate responses from multiple instances
 * @param {string} task - Original task
 * @param {Array} responses - Array of responses
 * @returns {Object} Collated result
 */
function collateResponses(task, responses) {
  if (responses.length === 0) {
    throw new Error('No responses to collate');
  }

  // Sort by quality score
  responses.sort((a, b) => b.quality_score - a.quality_score);

  // Select consensus response (highest quality)
  const consensusResponse = responses[0].response;

  // Analyze quality
  const qualityAnalysis = {
    average_quality: responses.reduce((sum, r) => sum + r.quality_score, 0) / responses.length,
    best_quality: responses[0].quality_score,
    quality_range: responses[0].quality_score - responses[responses.length - 1].quality_score,
    response_count: responses.length,
    consensus_confidence: calculateConsensusConfidence(responses)
  };

  return {
    task,
    responses,
    consensus_response: consensusResponse,
    quality_analysis: qualityAnalysis
  };
}

/**
 * Calculate consensus confidence
 * @param {Array} responses - Array of responses
 * @returns {number} Confidence score (0-1)
 */
function calculateConsensusConfidence(responses) {
  if (responses.length < 2) {
    return 1.0;
  }

  // Calculate similarity between top responses
  const topResponses = responses.slice(0, 2);
  const similarity = calculateSimilarity(
    topResponses[0].response,
    topResponses[1].response
  );

  return similarity;
}

/**
 * Calculate similarity between two texts
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2 || typeof text1 !== 'string' || typeof text2 !== 'string') {
    return 0.0;
  }

  // Simple similarity based on common words
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  if (words1.size === 0 || words2.size === 0) {
    return 0.0;
  }

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Check if request should use swarm mode
 * @param {string} message - Request message
 * @param {Object} env - Environment variables
 * @returns {boolean} Whether to use swarm mode
 */
export function shouldUseSwarm(message, env) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lowerMessage = message.toLowerCase();

  // Check for swarm indicators
  const swarmKeywords = ['swarm', 'multiple', 'parallel', 'compare', 'best', 'optimize'];
  const hasSwarmKeyword = swarmKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );

  // Check for complex coding tasks
  const complexKeywords = ['implement', 'create', 'build', 'develop', 'design', 'architecture'];
  const hasComplexKeyword = complexKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );

  // Check for swarm mode flag
  const swarmMode = env.SWARM_MODE === 'true';

  return swarmMode || (hasSwarmKeyword && hasComplexKeyword);
}

/**
 * Get swarm configuration
 * @returns {Object} Swarm configuration
 */
export function getSwarmConfig() {
  return SWARM_CONFIG;
}
