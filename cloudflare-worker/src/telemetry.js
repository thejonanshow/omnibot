/**
 * Telemetry module for OmniBot
 * Handles logging and metrics collection
 */

import { paginateKV } from './utils/async-iterator.js';

// Telemetry batching
const telemetryBatch = [];
const BATCH_SIZE = 10;
const BATCH_TIMEOUT = 1000; // 1 second
let batchTimer = null;

function flushTelemetryBatch(env) {
  if (telemetryBatch.length === 0) return;
  
  const batch = [...telemetryBatch];
  telemetryBatch.length = 0;
  batchTimer = null;
  
  // Send batch
  const batchData = {
    events: batch,
    batchId: crypto.randomUUID(),
    timestamp: Date.now()
  };
  
  env.TELEMETRY.put(`batch:${Date.now()}`, JSON.stringify(batchData), {
    expirationTtl: 86400 // 24 hours
  }).catch(err => console.error('Batch telemetry error:', err));
}

/**
 * Log telemetry event
 */
export async function logTelemetry(event, data, env) {
  if (!env.TELEMETRY) {
    // Fallback to console logging
    console.log(`[Telemetry] ${event}:`, JSON.stringify(data));
    return;
  }
  
  try {
    const telemetryData = {
      event,
      data,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    
    // Add to batch
    telemetryBatch.push(telemetryData);
    
    // Flush if batch is full
    if (telemetryBatch.length >= BATCH_SIZE) {
      flushTelemetryBatch(env);
    } else if (!batchTimer) {
      // Schedule flush if not already scheduled
      batchTimer = setTimeout(() => flushTelemetryBatch(env), BATCH_TIMEOUT);
    }
    
    console.log(`[Telemetry] Queued ${event}:`, JSON.stringify(data));
  } catch (error) {
    console.error('Error logging telemetry:', error);
  }
}

/**
 * Query telemetry events efficiently with async iterator
 */
export async function* queryTelemetry(env, eventFilter = null, startTime = null, endTime = null) {
  if (!env.TELEMETRY) {
    return;
  }
  
  const prefix = eventFilter ? `telemetry:${eventFilter}:` : 'telemetry:';
  
  for await (const { key, value } of paginateKV(env.TELEMETRY, prefix, 50)) {
    if (!value) continue;
    
    try {
      const data = JSON.parse(value);
      
      // Apply time filters if specified
      if (startTime && data.timestamp < startTime) continue;
      if (endTime && data.timestamp > endTime) continue;
      
      yield data;
    } catch (error) {
      console.error('Error parsing telemetry data:', error);
    }
  }
}

/**
 * Get telemetry events
 */
export async function getTelemetry(event, limit = 100, env) {
  if (!env.TELEMETRY) {
    return [];
  }
  
  try {
    const list = await env.TELEMETRY.list({ prefix: `telemetry:${event}:` });
    const events = [];
    
    for (const key of list.keys.slice(-limit)) {
      const data = await env.TELEMETRY.get(key.name);
      if (data) {
        events.push(JSON.parse(data));
      }
    }
    
    return events.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error getting telemetry:', error);
    return [];
  }
}

/**
 * Get telemetry summary
 */
export async function getTelemetrySummary(env) {
  if (!env.TELEMETRY) {
    return {};
  }
  
  try {
    const events = ['login', 'chat', 'self_edit', 'error'];
    const summary = {};
    
    for (const event of events) {
      const eventData = await getTelemetry(event, 1000, env);
      summary[event] = {
        total: eventData.length,
        last_24h: eventData.filter(e => Date.now() - e.timestamp < 86400000).length,
        last_7d: eventData.filter(e => Date.now() - e.timestamp < 604800000).length,
        errors: eventData.filter(e => e.data.success === false).length
      };
    }
    
    return summary;
  } catch (error) {
    console.error('Error getting telemetry summary:', error);
    return {};
  }
}

/**
 * Clean up old telemetry data
 */
export async function cleanupTelemetry(env, maxAgeMs = 86400000 * 30) { // 30 days
  if (!env.TELEMETRY) {
    return;
  }
  
  try {
    const cutoff = Date.now() - maxAgeMs;
    const list = await env.TELEMETRY.list();
    
    for (const key of list.keys) {
      const timestamp = parseInt(key.name.split(':').pop());
      if (timestamp < cutoff) {
        await env.TELEMETRY.delete(key.name);
      }
    }
    
    console.log(`[Telemetry] Cleaned up telemetry data older than ${maxAgeMs}ms`);
  } catch (error) {
    console.error('Error cleaning up telemetry:', error);
  }
}

export default {
  logTelemetry,
  getTelemetry,
  getTelemetrySummary,
  cleanupTelemetry
};