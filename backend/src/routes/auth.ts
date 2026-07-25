import { Hono } from "hono";
import { supabaseAdmin, supabaseClient } from "../config/db.js";
import { requireRole } from "../middlewares/role.js";

type Env = {
  Variables: {
    user: any;
    role: string;
  };
};

const authRouter = new Hono<Env>();

const getProfileWithRole = async (userId: string) => {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  const role = profile?.role || "free";

  if (profile) {
    const { data: ratioRecord } = await supabaseAdmin
      .from("question_ratios")
      .select("excel_ratio_unpaid, excel_ratio_paid")
      .eq("role", role)
      .maybeSingle();

    profile.default_excel_unpaid =
      ratioRecord?.excel_ratio_unpaid ?? (role === "plus" ? 50 : role === "free" ? 0 : 100);
    profile.default_excel_paid = ratioRecord?.excel_ratio_paid ?? (role === "free" ? 0 : 100);
  }

  return { profile, role };
};

authRouter.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");

    if (!email || !password) {
      return c.json({ error: "Email và mật khẩu là bắt buộc" }, 400);
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      return c.json({ error: error?.message || "Đăng nhập thất bại" }, 401);
    }

    const { profile, role } = await getProfileWithRole(data.user.id);

    return c.json({
      user: data.user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
      profile,
      role,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

authRouter.get("/google-url", async (c) => {
  try {
    const redirectTo = String(c.req.query("redirect_to") || "").trim();
    const redirectUrl = new URL(redirectTo);

    if (redirectUrl.protocol !== "https:" || !redirectUrl.hostname.endsWith(".chromiumapp.org")) {
      return c.json({ error: "redirect_to không hợp lệ" }, 400);
    }

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      return c.json({ error: error?.message || "Không tạo được URL đăng nhập Google" }, 400);
    }

    return c.json({ url: data.url });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Lấy profile cá nhân
authRouter.get("/profile", async (c) => {
  const user = c.get("user");
  const role = c.get("role");

  if (!user) {
    return c.json({ user: null, role: "guest" });
  }

  const { profile } = await getProfileWithRole(user.id);
  if (profile) {
    profile.avatar_url = profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
    profile.full_name = profile.full_name || user.user_metadata?.full_name || user.user_metadata?.name || profile.full_name;
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
