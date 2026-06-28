import type { MiddlewareHandler } from "hono";
import { supabaseClient, supabaseAdmin } from "../config/db.js";
import { cacheGetOrSet } from "../utils/cache.js";

// Cache auth kết quả theo JWT token — TTL 5 phút
// Tránh 2 round-trips Supabase cho mỗi request
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 phút

interface AuthResult {
  userId: string | null;
  role: string;
  user: any;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    c.set("user", null);
    c.set("role", "guest");
    return await next();
  }

  const token = authHeader.split(" ")[1];

  // Cache key dùng 32 ký tự cuối của token (tránh lưu cả token quá dài)
  const cacheKey = `auth:${token.slice(-32)}`;

  const result = await cacheGetOrSet<AuthResult>(
    cacheKey,
    async () => {
      // Chạy song song: verify token + fetch profile (nếu token hợp lệ)
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);

      if (error || !user) {
        return { userId: null, role: "guest", user: null };
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      return {
        userId: user.id,
        role: profile?.role || "free",
        user,
      };
    },
    AUTH_CACHE_TTL
  );

  c.set("user", result.user);
  c.set("role", result.role);
  await next();
};
