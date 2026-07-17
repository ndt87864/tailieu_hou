// CJS reader for MITM standalone process. Reads mitmAlias from Redis cache.
const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
let redis;
let localCache = {};

try {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    enableOfflineQueue: false,
  });
  redis.on("error", (err) => console.warn("[Redis MITM] Client Error:", err.message));

  // Periodically refresh the cache from Redis (every 5 seconds)
  async function refreshCache() {
    try {
      const raw = await redis.get("9router:mitmAliases");
      if (raw) {
        localCache = JSON.parse(raw);
      }
    } catch (e) {
      console.warn("[Redis MITM] Failed to refresh aliases:", e.message);
    }
  }

  refreshCache();
  const timer = setInterval(refreshCache, 5000);
  if (timer.unref) timer.unref();
} catch (e) {
  console.warn("[Redis MITM] Failed to initialize Redis client:", e.message);
}

function getMitmAlias(toolName) {
  return localCache?.[toolName] || null;
}

module.exports = { getMitmAlias };
