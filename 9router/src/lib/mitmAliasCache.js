// Redis cache for mitmAlias — read by standalone MITM server (no SQLite native binding).
// Source of truth = Supabase kv['mitmAlias']. Redis is a cache synced on app start
// and after every UI write.
import redis from "./redisClient.js";

// Sync entire mitmAlias map from DB → Redis
export async function syncToJson() {
  try {
    const { getMitmAlias } = await import("@/lib/db/repos/aliasRepo.js");
    const all = await getMitmAlias();
    if (redis) {
      await redis.set("9router:mitmAliases", JSON.stringify(all || {}));
    }
  } catch (e) {
    console.log("[mitmAliasCache] sync to Redis failed:", e.message);
  }
}

// Update cache for a single tool after UI saves to DB
export async function writeAliasForTool(tool, mappings) {
  try {
    if (redis) {
      const raw = await redis.get("9router:mitmAliases");
      let current = {};
      if (raw) {
        try { current = JSON.parse(raw); } catch { /* corrupted → reset */ }
      }
      current[tool] = mappings || {};
      await redis.set("9router:mitmAliases", JSON.stringify(current));
    }
  } catch (e) {
    console.log("[mitmAliasCache] write to Redis failed:", e.message);
  }
}
