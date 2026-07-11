import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { cacheGetOrSet, cacheInvalidate } from "../utils/cache.js";

const extensionConfigRouter = new Hono();

const CACHE_KEY = "extension_config:all";
const CACHE_TTL = 30 * 1000; // 30 giay

// GET /api/v1/extension-config
// Public -- extension fetch db_mode tu day, khong can auth
extensionConfigRouter.get("/", async (c) => {
  try {
    const config = await cacheGetOrSet(
      CACHE_KEY,
      async () => {
        const { data, error } = await supabaseAdmin
          .from("extension_config")
          .select("key, value");

        if (error) throw new Error(error.message);

        // Chuyen array [{key, value}] thanh object {key: value}
        return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
      },
      CACHE_TTL
    );

    return c.json({ config });
  } catch (err: any) {
    console.error("[extensionConfig] GET error:", err.message);
    return c.json({ config: { db_mode: "questions" } }); // fallback an toan
  }
});

// PATCH /api/v1/extension-config/:key  (chi admin)
// Cho phep cap nhat value tu dashboard noi bo neu can
extensionConfigRouter.patch("/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const { value } = await c.req.json();

    if (!value) return c.json({ error: "Thieu value" }, 400);

    const { error } = await supabaseAdmin
      .from("extension_config")
      .update({ value })
      .eq("key", key);

    if (error) throw new Error(error.message);

    // Xoa cache de lan fetch tiep se lay data moi
    await cacheInvalidate(CACHE_KEY);

    return c.json({ success: true, key, value });
  } catch (err: any) {
    console.error("[extensionConfig] PATCH error:", err.message);
    return c.json({ error: err.message }, 500);
  }
});

export default extensionConfigRouter;
