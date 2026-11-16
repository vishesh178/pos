const cache = new Map();

/**
 * High-performance cached fetch utility for static/semi-static data.
 * - Resolves instantly (0ms) from memory cache when available.
 * - Revalidates in the background (stale-while-revalidate pattern).
 * - Deduplicates concurrent in-flight requests for the same URL.
 */
export async function cachedFetch(url, options = {}, maxAgeMs = 5 * 60 * 1000) {
  const method = (options.method || 'GET').toUpperCase();
  // Only cache GET requests
  if (method !== 'GET') {
    const res = await fetch(url, options);
    return res.json();
  }

  const cached = cache.get(url);
  const now = Date.now();

  // If in cache and not expired, return immediately from memory
  if (cached && cached.data && now - cached.timestamp < maxAgeMs) {
    return cached.data;
  }

  // If an active in-flight request exists, reuse its promise
  if (cached && cached.promise) {
    return cached.promise;
  }

  const fetchPromise = fetch(url, options)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      cache.set(url, { data, timestamp: Date.now(), promise: null });
      return data;
    })
    .catch((err) => {
      if (cached && cached.data) {
        return cached.data;
      }
      cache.delete(url);
      throw err;
    });

  if (cached) {
    cached.promise = fetchPromise;
  } else {
    cache.set(url, { data: null, timestamp: 0, promise: fetchPromise });
  }

  // If we have existing data (stale), return it instantly while background fetch updates cache
  if (cached && cached.data) {
    return cached.data;
  }

  return fetchPromise;
}

/**
 * Invalidate cached items matching a URL string or pattern.
 */
export function invalidateCache(urlPattern) {
  if (!urlPattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(urlPattern)) {
      cache.delete(key);
    }
  }
}
