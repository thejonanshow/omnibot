/**
 * Usage tracking utilities
 */

export function getDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function getUsage(usageStore, provider) {
  const key = `usage:${provider}:${getDateKey()}`;
  const data = await usageStore.get(key);
  return data ? parseInt(data) : 0;
}

export async function incrementUsage(usageStore, provider) {
  const key = `usage:${provider}:${getDateKey()}`;
  const current = await getUsage(usageStore, provider);
  await usageStore.put(key, (current + 1).toString(), {
    expirationTtl: 86400
  });
  return current + 1;
}
