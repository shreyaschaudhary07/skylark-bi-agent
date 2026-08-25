/**
 * In-memory cache with TTL for Monday.com data
 * Prevents excessive API calls while keeping data fresh
 */

const cache = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get a cached value if it exists and hasn't expired
 */
function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Set a cached value with optional TTL
 */
function set(key, value, ttl = DEFAULT_TTL) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
    cachedAt: new Date().toISOString(),
  });
}

/**
 * Clear all cached data
 */
function clear() {
  cache.clear();
}

/**
 * Get cache stats
 */
function stats() {
  const entries = [];
  for (const [key, entry] of cache.entries()) {
    entries.push({
      key,
      cachedAt: entry.cachedAt,
      expiresIn: Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000)),
      expired: Date.now() > entry.expiresAt,
    });
  }
  return { size: cache.size, entries };
}

module.exports = { get, set, clear, stats };
