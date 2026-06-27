import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";

const authRouter = new Hono();

// Lấy profile cá nhân
authRouter.get("/profile", async (c) => {
  const user = c.get("user");
  const role = c.get("role");

  if (!user) {
    return c.json({ user: null, role: "guest" });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return c.json({ user, profile, role });
});

// Update profile của chính mình
authRouter.put("/profile", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { full_name, avatar_url } = body;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name,
      avatar_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ success: true, profile: data });
});

export default authRouter;
