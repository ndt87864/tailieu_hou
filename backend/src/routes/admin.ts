import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";

const adminRouter = new Hono();

// Chỉ Admin mới được truy cập các endpoint này
adminRouter.use("*", requireRole("admin"));

// Lấy danh sách toàn bộ profile
adminRouter.get("/users", async (c) => {
  const { data: users, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ users });
});

// Update role của một user
adminRouter.put("/users/:userId/role", async (c) => {
  const userId = c.req.param("userId");
  const { role } = await c.req.json();

  if (!["admin", "management", "ultra", "pro", "plus", "free"].includes(role)) {
    return c.json({ error: "Invalid role value" }, 400);
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ success: true, profile });
});

export default adminRouter;
