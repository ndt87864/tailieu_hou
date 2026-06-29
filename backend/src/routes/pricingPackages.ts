import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";
import { cacheInvalidatePrefix, cacheGetOrSet } from "../utils/cache.js";

const pricingPackagesRouter = new Hono();

// Cache settings
const CACHE_PREFIX = "pricing_packages";
const TTL = 300000; // 5 minutes

// 1. PUBLIC: Get all pricing packages
pricingPackagesRouter.get("/", async (c) => {
  try {
    const data = await cacheGetOrSet(
      `${CACHE_PREFIX}:all`,
      async () => {
        const { data: packages, error } = await supabaseAdmin
          .from("pricing_packages")
          .select("*")
          .order("display_order", { ascending: true });

        if (error) {
          console.warn("Could not fetch pricing_packages from database:", error.message);
          return [];
        }
        return packages || [];
      },
      TTL
    );
    return c.json({ packages: data });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 2. ADMIN ONLY: Get all pricing packages
pricingPackagesRouter.get("/admin", requireRole("admin"), async (c) => {
  try {
    const { data: packages, error } = await supabaseAdmin
      .from("pricing_packages")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("Could not fetch pricing_packages for admin from database:", error.message);
      return c.json({ packages: [] });
    }
    return c.json({ packages: packages || [] });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 3. ADMIN ONLY: Create a new package
pricingPackagesRouter.post("/admin", requireRole("admin"), async (c) => {
  try {
    const body = await c.req.json();
    const { name, price, savings, icon, features, display_order } = body;

    if (!name || !price) {
      return c.json({ error: "name and price are required fields" }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("pricing_packages")
      .insert({
        name,
        price,
        savings: savings || "",
        icon: icon || "free",
        features: Array.isArray(features) ? features : [],
        display_order: display_order !== undefined ? parseInt(display_order, 10) : 10,
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

// 4. ADMIN ONLY: Update a package
pricingPackagesRouter.put("/admin/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { name, price, savings, icon, features, display_order } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (price !== undefined) updates.price = price;
    if (savings !== undefined) updates.savings = savings;
    if (icon !== undefined) updates.icon = icon;
    if (features !== undefined) updates.features = Array.isArray(features) ? features : [];
    if (display_order !== undefined) updates.display_order = parseInt(display_order, 10);
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("pricing_packages")
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

// 5. ADMIN ONLY: Delete a package
pricingPackagesRouter.delete("/admin/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  try {
    const { error } = await supabaseAdmin
      .from("pricing_packages")
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

export default pricingPackagesRouter;
