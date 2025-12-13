/**
 * Configuration management for Omnibot CLI
 * Stores config in ~/.omnibot/config.json
 */

import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

const CONFIG_DIR = path.join(homedir(), '.omnibot');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Ensure the config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load configuration from file
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {
        baseUrl: 'https://omnibot.jonanscheffler.workers.dev',
        accessToken: null
      };
    }

    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

/**
 * Save configuration to file
 * @param {Object} config - Configuration object to save
 */
export function saveConfig(config) {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

/**
 * Get the base URL, checking environment variable override
 * @returns {string} Base URL
 */
export function getBaseUrl() {
  return process.env.OMNIBOT_BASE_URL || loadConfig().baseUrl;
}

/**
 * Get the access token
 * @returns {string|null} Access token or null
 */
export function getAccessToken() {
  const config = loadConfig();
  return config.accessToken;
}

/**
 * Check if user is logged in
 * @returns {boolean} True if logged in
 */
export function isLoggedIn() {
  const token = getAccessToken();
  return token !== null && token.length > 0;
}

/**
 * Get config file path (for display purposes)
 * @returns {string} Path to config file
 */
export function getConfigPath() {
  return CONFIG_FILE;
}
