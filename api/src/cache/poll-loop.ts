import { cachedFetch } from './redis.js';

interface PollConfig<T> {
  key: string;
  source: string;
  intervalMs: number;
  fetcher: () => Promise<T>;
  onUpdate?: (data: T) => void;
}

const activePolls = new Map<string, ReturnType<typeof setInterval>>();

export function startPollLoop<T>(config: PollConfig<T>): () => void {
  const { key, source, intervalMs, fetcher, onUpdate } = config;

  async function poll() {
    try {
      const result = await cachedFetch(key, intervalMs, source, fetcher);
      onUpdate?.(result.data);
    } catch (err) {
      console.warn(`[Poll] ${key} failed:`, (err as Error).message);
    }
  }

  // Initial fetch
  poll();

  // Schedule periodic
  const timer = setInterval(poll, intervalMs);
  activePolls.set(key, timer);

  return () => {
    clearInterval(timer);
    activePolls.delete(key);
  };
}

export function stopAllPolls() {
  for (const [key, timer] of activePolls) {
    clearInterval(timer);
    activePolls.delete(key);
  }
}
