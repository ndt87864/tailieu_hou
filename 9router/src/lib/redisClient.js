let client = null;
let clientUrl = null;

// Lazy-loaded Redis client Proxy to prevent Next.js Edge Runtime (Middleware)
// from importing and bundle-compiling 'ioredis' which depends on Node.js 'net' module.
const redisProxy = new Proxy({}, {
  get(target, prop) {
    if (process.env.NEXT_RUNTIME === "edge") {
      return undefined;
    }
    if (!process.env.REDIS_URL) {
      try {
        const fs = require("fs");
        const path = require("path");
        const envPath = path.join(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, "utf8");
          for (const line of envContent.split(/\r?\n/)) {
            const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
            if (match) {
              const key = match[1].trim();
              let val = match[2].trim();
              if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
              process.env[key] = val;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
    const currentUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    if (!client || clientUrl !== currentUrl) {
      if (client) {
        try { client.disconnect(); } catch {}
      }
      try {
        // Only require ioredis in standard Node.js environments
        const Redis = require("ioredis");
        clientUrl = currentUrl;
        const options = {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          enableOfflineQueue: true,
        };
        if (clientUrl.startsWith("rediss:")) {
          options.tls = {
            rejectUnauthorized: false
          };
        }
        client = new Redis(clientUrl, options);
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
