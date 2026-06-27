import type { MiddlewareHandler } from "hono";
import { ROLE_HIERARCHY, type UserRole } from "../types/index.js";

export const requireRole = (requiredRole: UserRole): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get("user");
    const role: UserRole = c.get("role") || "free";

    if (!user) {
      return c.json({ error: "Unauthorized. Please login.", code: "UNAUTHORIZED" }, 401);
    }

    const userLevel = ROLE_HIERARCHY[role] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole];

    if (userLevel < requiredLevel) {
      return c.json(
        { error: `Forbidden. Requires role ${requiredRole} or higher.`, code: "FORBIDDEN" },
        403
      );
    }

    await next();
  };
};
