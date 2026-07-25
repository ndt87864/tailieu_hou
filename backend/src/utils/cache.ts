import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<any>>();
let redisClient: Redis | null = null;
let isRedisReady = false;

// Khởi tạo Redis nếu có cấu hình
const redisUrl = process.env.REDIS_URL;
if (redisUrl && redisUrl.trim() !== "" && !redisUrl.includes("ENOTFOUND")) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 0,
      connectTimeout: 1000,
      retryStrategy: () => null,
      lazyConnect: false,
    });
    
    redisClient.on("connect", () => {
      console.log("📶 Connected to Redis for caching.");
      isRedisReady = true;
    });

    redisClient.on("error", (err: any) => {
      console.warn("⚠️ Redis cache error, falling back to in-memory store:", err.message);
      isRedisReady = false;
    });
  } catch (e) {
    console.error("❌ Failed to create Redis client:", e);
  }
}

/**
 * Lấy data từ cache. Trả về null nếu không có hoặc đã hết hạn.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redisClient && isRedisReady) {
    try {
      const val = await redisClient.get(key);
      if (val) {
        return JSON.parse(val) as T;
      }
      return null;
    } catch (err) {
      console.warn("⚠️ Redis get failed, fallback to memory:", err);
    }
  }

  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Lưu data vào cache với TTL (milliseconds).
 * @param ttlMs - thời gian sống tính bằng ms (default 60s)
 */
export async function cacheSet<T>(key: string, data: T, ttlMs = 60_000): Promise<void> {
  if (redisClient && isRedisReady) {
    try {
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      await redisClient.set(key, JSON.stringify(data), "EX", ttlSec);
      return;
    } catch (err) {
      console.warn("⚠️ Redis set failed, fallback to memory:", err);
    }
  }

  memoryStore.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Xóa một key cụ thể khỏi cache.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  if (redisClient && isRedisReady) {
    try {
      await redisClient.del(key);
      return;
    } catch (err) {
      console.warn("⚠️ Redis del failed, fallback to memory:", err);
    }
  }

  memoryStore.delete(key);
}

/**
 * Xóa tất cả keys bắt đầu bằng prefix.
 */
export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  if (redisClient && isRedisReady) {
    try {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return;
    } catch (err) {
      console.warn("⚠️ Redis delete keys pattern failed, fallback to memory:", err);
    }
  }

  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
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
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  await cacheSet(key, data, ttlMs);
  return data;
}

