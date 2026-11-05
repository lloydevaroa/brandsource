/**
 * Short-lived in-memory cache for heavy read-only loaders (full catalogue, full
 * category tree). Every product and category page used to run these in full, so a
 * burst of page loads or prefetches ran hundreds of identical queries at once and
 * starved the database. This shares one read per server instance per window:
 *
 * - fresh value: returned straight away
 * - a read already in flight: everyone waits on that one read
 * - expired value: the old value is served while one refresh runs
 * - a refresh fails: the old value keeps being served and the refresh retries shortly
 */
type Entry<T> = { at: number; value?: T; pending?: Promise<T> };

export function ttlCache<A extends unknown[], T>(ms: number, fn: (...args: A) => Promise<T>) {
  const store = new Map<string, Entry<T>>();
  const RETRY_MS = 10_000;

  return async (...args: A): Promise<T> => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const entry = store.get(key);

    if (entry?.value !== undefined && now - entry.at < ms) return entry.value;
    if (entry?.pending) return entry.value !== undefined ? entry.value : entry.pending;

    const pending = fn(...args).then(
      (value) => {
        store.set(key, { at: Date.now(), value });
        return value;
      },
      (err) => {
        const stale = store.get(key)?.value;
        if (stale !== undefined) {
          // Keep serving the old copy and try again in a few seconds.
          store.set(key, { at: Date.now() - ms + RETRY_MS, value: stale });
          return stale;
        }
        store.delete(key);
        throw err;
      },
    );
    store.set(key, { at: entry?.at ?? now, value: entry?.value, pending });
    return pending;
  };
}
