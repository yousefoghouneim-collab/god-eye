import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      console.warn('[Redis] Connection error (will retry):', err.message);
    });
  }
  return redis;
}

export interface CachedData<T> {
  data: T;
  fetchedAt: number;
  source: string;
  ttl: number;
}

const stampedeLocks = new Map<string, Promise<unknown>>();

/** Get from cache, or fetch + cache with stampede protection. */
export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  source: string,
  fetcher: () => Promise<T>,
): Promise<CachedData<T>> {
  const r = getRedis();
  try {
    const raw = await r.get(key);
    if (raw) {
      const cached = JSON.parse(raw) as CachedData<T>;
      if (Date.now() - cached.fetchedAt < ttlMs) {
        return cached;
      }
    }
  } catch {
    // Redis may be down — fall through to fetch
  }

  // Stampede lock: only one in-flight fetch per key
  const existing = stampedeLocks.get(key);
  if (existing) {
    return existing as Promise<CachedData<T>>;
  }

  const fetchPromise = (async () => {
    try {
      const data = await fetcher();
      const entry: CachedData<T> = {
        data,
        fetchedAt: Date.now(),
        source,
        ttl: ttlMs,
      };
      try {
        await r.set(key, JSON.stringify(entry), 'PX', ttlMs * 2);
      } catch {
        // Redis write failed — data is still usable
      }
      return entry;
    } finally {
      stampedeLocks.delete(key);
    }
  })();

  stampedeLocks.set(key, fetchPromise);
  return fetchPromise;
}

/** Read cached data without triggering a fetch. Returns null if not cached. */
export async function readCache<T>(key: string): Promise<CachedData<T> | null> {
  try {
    const raw = await getRedis().get(key);
    if (raw) return JSON.parse(raw) as CachedData<T>;
  } catch {
    // Redis down
  }
  return null;
}
