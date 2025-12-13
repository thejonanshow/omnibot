/**
 * API client for Omnibot backend
 */

import fetch from 'node-fetch';
import { getBaseUrl, getAccessToken } from './config.js';

/**
 * Make an authenticated request to the Omnibot API
 * @param {string} endpoint - API endpoint (e.g., '/api/cli/whoami')
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
async function request(endpoint, options = {}) {
  const baseUrl = getBaseUrl();
  const token = getAccessToken();

  if (!token) {
    throw new Error('Not logged in. Run "omnibot login" first.');
  }

  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('fetch failed')) {
      throw new Error(`Failed to connect to ${baseUrl}. Check your network connection and base URL.`);
    }
    throw error;
  }
}

/**
 * Get current user information
 * @returns {Promise<Object>} User object
 */
export async function whoami() {
  return await request('/api/cli/whoami', {
    method: 'GET'
  });
}

/**
 * Send a chat message
 * @param {string} message - Message to send
 * @param {string|null} conversationId - Optional conversation ID
 * @returns {Promise<Object>} Response with conversation_id and response
 */
export async function chat(message, conversationId = null) {
  const body = {
    message
  };

  if (conversationId) {
    body.conversation_id = conversationId;
  }

  return await request('/api/cli/chat', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Check health of the API
 * @returns {Promise<Object>} Health status
 */
export async function health() {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/health`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    if (error.message.includes('fetch failed')) {
      throw new Error(`Failed to connect to ${baseUrl}. Check your network connection and base URL.`);
    }
    throw error;
  }
}
