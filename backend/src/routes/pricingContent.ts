import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";
import { cacheInvalidatePrefix, cacheGetOrSet } from "../utils/cache.js";

const pricingRouter = new Hono();

// Cache settings
const CACHE_PREFIX = "pricing_content";
const TTL = 300000; // 5 minutes

// 1. PUBLIC: Get all pricing content (ordered by number ascending)
pricingRouter.get("/", async (c) => {
  try {
    const data = await cacheGetOrSet(
      `${CACHE_PREFIX}:all`,
      async () => {
        const { data: content, error } = await supabaseAdmin
          .from("pricing_content")
          .select("*")
          .order("number", { ascending: true });

        if (error) throw error;
        return content || [];
      },
      TTL
    );
    return c.json({ content: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 2. ADMIN ONLY: Get pricing content
pricingRouter.get("/admin", requireRole("admin"), async (c) => {
  try {
    const { data: content, error } = await supabaseAdmin
      .from("pricing_content")
      .select("*")
      .order("number", { ascending: true });

    if (error) throw error;
    return c.json({ content: content || [] });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 3. ADMIN ONLY: Create a new step
pricingRouter.post("/admin", requireRole("admin"), async (c) => {
  try {
    const body = await c.req.json();
    const { number, text, links } = body;

    if (number === undefined || !text) {
      return c.json({ error: "number and text are required fields" }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("pricing_content")
      .insert({
        number: parseInt(number, 10),
        text,
        links: Array.isArray(links) ? links : [],
      })
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    await cacheInvalidatePrefix(CACHE_PREFIX);

    return c.json({ success: true, item: data }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 4. ADMIN ONLY: Update a step
pricingRouter.put("/admin/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { number, text, links } = body;

    const updates: any = {};
    if (number !== undefined) updates.number = parseInt(number, 10);
    if (text !== undefined) updates.text = text;
    if (links !== undefined) updates.links = Array.isArray(links) ? links : [];
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("pricing_content")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    await cacheInvalidatePrefix(CACHE_PREFIX);

    return c.json({ success: true, item: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 5. ADMIN ONLY: Delete a step
pricingRouter.delete("/admin/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  try {
    const { error } = await supabaseAdmin
      .from("pricing_content")
      .delete()
      .eq("id", id);

    if (error) throw error;

    // Invalidate cache
    await cacheInvalidatePrefix(CACHE_PREFIX);

    return c.json({ success: true, message: "Deleted successfully" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default pricingRouter;
