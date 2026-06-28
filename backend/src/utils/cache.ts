/**
 * Simple in-memory TTL cache
 * Không cần Redis/external dependency.
 * Phù hợp cho data ít thay đổi (categories, documents grouped, stats).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Date.now() + ttlMs
}

const store = new Map<string, CacheEntry<any>>();

/**
 * Lấy data từ cache. Trả về null nếu không có hoặc đã hết hạn.
 */
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Lưu data vào cache với TTL (milliseconds).
 * @param ttlMs - thời gian sống tính bằng ms (default 60s)
 */
export function cacheSet<T>(key: string, data: T, ttlMs = 60_000): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Xóa một key cụ thể khỏi cache.
 */
export function cacheInvalidate(key: string): void {
  store.delete(key);
}

/**
 * Xóa tất cả keys bắt đầu bằng prefix.
 * Ví dụ: cacheInvalidatePrefix("docs") xóa "docs:grouped", "docs:all", ...
 */
export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Wrapper tiện dụng: nếu cache miss thì gọi fetcher, lưu kết quả vào cache.
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  cacheSet(key, data, ttlMs);
  return data;
}
