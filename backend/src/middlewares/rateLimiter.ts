import type { MiddlewareHandler } from "hono";
import { cacheGet, cacheSet } from "../utils/cache.js";

interface LimitStore {
  count: number;
  resetTime: number;
}

export const rateLimiter = (limit = 100, windowMs = 60000): MiddlewareHandler => {
  return async (c, next) => {
    // Lấy IP từ connection client hoặc proxy header
    const ip = c.req.header("x-forwarded-for") || "unknown-ip";
    const now = Date.now();
    const cacheKey = `ratelimit:${ip}`;
    
    let clientLimit = await cacheGet<LimitStore>(cacheKey);
    
    if (!clientLimit || now > clientLimit.resetTime) {
      clientLimit = {
        count: 1,
        resetTime: now + windowMs
      };
    } else {
      clientLimit.count++;
    }

    // Set TTL bằng với khoảng thời gian còn lại của window
    const remainingTtlMs = Math.max(1000, clientLimit.resetTime - now);
    await cacheSet(cacheKey, clientLimit, remainingTtlMs);

    c.header("X-RateLimit-Limit", limit.toString());
    c.header("X-RateLimit-Remaining", Math.max(0, limit - clientLimit.count).toString());
    c.header("X-RateLimit-Reset", Math.ceil(clientLimit.resetTime / 1000).toString());

    if (clientLimit.count > limit) {
      c.header("Retry-After", Math.ceil((clientLimit.resetTime - now) / 1000).toString());
      return c.json({
        error: "Too Many Requests",
        message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút."
      }, 429);
    }

    await next();
  };
};

