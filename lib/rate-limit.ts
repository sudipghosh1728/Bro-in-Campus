type RateRecord = { count: number; resetAt: number };
const globalRateLimit = globalThis as unknown as { rateLimit?: Map<string, RateRecord> };
const store = globalRateLimit.rateLimit ?? new Map<string, RateRecord>();
if (!globalRateLimit.rateLimit) globalRateLimit.rateLimit = store;

/** In-memory guard for a single app instance. Use Redis behind the same interface when horizontally scaling. */
export function allowRequest(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}
