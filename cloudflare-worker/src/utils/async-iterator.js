/**
 * Efficient async iterator utilities for memory-conscious operations
 */

/**
 * Create async iterator for paginated KV results
 */
export async function* paginateKV(store, prefix, pageSize = 100) {
  let cursor = null;
  
  do {
    const { keys, list_complete } = await store.list({
      prefix,
      cursor,
      limit: pageSize
    });
    
    for (const key of keys) {
      const value = await store.get(key.name);
      yield { key: key.name, value };
    }
    
    cursor = list_complete ? null : keys[keys.length - 1]?.name;
  } while (cursor);
}

/**
 * Batch process items with memory efficiency
 */
export async function* batchProcess(items, batchSize = 10) {
  let batch = [];
  
  for (const item of items) {
    batch.push(item);
    
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * Memory-efficient map with async function
 */
export async function* asyncMap(iterable, mapFn) {
  for await (const item of iterable) {
    yield await mapFn(item);
  }
}

/**
 * Filter async iterator
 */
export async function* asyncFilter(iterable, filterFn) {
  for await (const item of iterable) {
    if (await filterFn(item)) {
      yield item;
    }
  }
}