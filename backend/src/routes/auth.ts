import { Hono } from "hono";
import { supabaseAdmin } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";

type Env = {
  Variables: {
    user: any;
    role: string;
  };
};

const authRouter = new Hono<Env>();

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

  if (profile) {
    const { data: ratioRecord } = await supabaseAdmin
      .from("question_ratios")
      .select("excel_ratio_unpaid, excel_ratio_paid")
      .eq("role", role || "free")
      .maybeSingle();

    profile.default_excel_unpaid = ratioRecord?.excel_ratio_unpaid ?? (role === "plus" ? 50 : (role === "free" ? 0 : 100));
    profile.default_excel_paid = ratioRecord?.excel_ratio_paid ?? (role === "free" ? 0 : 100);
  }

  return c.json({ user, profile, role });
});

// Update profile của chính mình
authRouter.put("/profile", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { full_name, avatar_url, phone } = body;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name,
      avatar_url,
      phone: phone ?? undefined,
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

// Lấy settings giao diện
authRouter.get("/ui-settings", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { data: settings, error } = await supabaseAdmin
    .from("ui_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  if (!settings) {
    return c.json({ theme_mode: "system", primary_color: "indigo" });
  }

  return c.json(settings);
});

// Update settings giao diện
authRouter.put("/ui-settings", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { theme_mode, primary_color } = await c.req.json();

  const { data: settings, error } = await supabaseAdmin
    .from("ui_settings")
    .upsert({
      user_id: user.id,
      theme_mode: theme_mode || "system",
      primary_color: primary_color || "indigo",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ success: true, settings });
});

export default authRouter;
