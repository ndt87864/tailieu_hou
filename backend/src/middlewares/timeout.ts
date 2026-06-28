import type { MiddlewareHandler } from "hono";

export const timeout = (durationMs = 10000): MiddlewareHandler => {
  return async (c, next) => {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("REQUEST_TIMEOUT"));
      }, durationMs);
    });

    try {
      await Promise.race([
        next(),
        timeoutPromise
      ]);
      clearTimeout(timeoutId!);
    } catch (err: any) {
      clearTimeout(timeoutId!);
      if (err.message === "REQUEST_TIMEOUT") {
        return c.json({
          error: "Request Timeout",
          message: "Yêu cầu mất quá nhiều thời gian xử lý và đã bị hủy để giải phóng tài nguyên hệ thống."
        }, 503);
      }
      throw err;
    }
  };
};
