let client = null;

// Lazy-loaded Redis client Proxy to prevent Next.js Edge Runtime (Middleware)
// from importing and bundle-compiling 'ioredis' which depends on Node.js 'net' module.
const redisProxy = new Proxy({}, {
  get(target, prop) {
    if (process.env.NEXT_RUNTIME === "edge") {
      return undefined;
    }
    if (!client) {
      try {
        // Only require ioredis in standard Node.js environments
        const Redis = require("ioredis");
        const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
        client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          enableOfflineQueue: false,
        });
        client.on("error", (err) => console.warn("[Redis] Client Error:", err.message));
      } catch (e) {
        console.warn("[Redis] Failed to initialize Redis client:", e.message);
      }
    }
    const val = client?.[prop];
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  }
});

export default redisProxy;
