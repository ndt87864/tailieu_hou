import type { MiddlewareHandler } from "hono";

interface LimitStore {
  count: number;
  resetTime: number;
}

const store = new Map<string, LimitStore>();

export const rateLimiter = (limit = 100, windowMs = 60000): MiddlewareHandler => {
  return async (c, next) => {
    // Lấy IP từ connection client hoặc proxy header
    const ip = c.req.header("x-forwarded-for") || "unknown-ip";
    const now = Date.now();
    
    let clientLimit = store.get(ip);
    
    if (!clientLimit || now > clientLimit.resetTime) {
      clientLimit = {
        count: 1,
        resetTime: now + windowMs
      };
      store.set(ip, clientLimit);
    } else {
      clientLimit.count++;
    }

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
