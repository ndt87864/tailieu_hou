import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { compress } from "hono/compress";
import dotenv from "dotenv";

import authRouter from "./routes/auth.js";
import docsRouter from "./routes/docs.js";
import questionsRouter from "./routes/questions.js";
import adminRouter from "./routes/admin.js";
import examRouter from "./routes/exam.js";
import pricingRouter from "./routes/pricingContent.js";
import pricingPackagesRouter from "./routes/pricingPackages.js";
import { authMiddleware } from "./middlewares/auth.js";
import { securityHeaders } from "./middlewares/security.js";
import { timeout } from "./middlewares/timeout.js";
import { rateLimiter } from "./middlewares/rateLimiter.js";

dotenv.config();

const app = new Hono();

// Global Middlewares
app.use("*", securityHeaders);
app.use("*", timeout(15000)); // Timeout 15s để bảo vệ resource
app.use("/api/v1/auth/*", rateLimiter(20, 60000)); // Auth endpoints: 20 req/phút
app.use("/api/v1/*", rateLimiter(100, 60000)); // API chung: 100 req/phút
app.use("*", logger());
app.use("*", compress()); // Nén Gzip/Brotli giảm bandwidth truyền tải dữ liệu
app.use("*", cors({ origin: "*", credentials: true }));
app.use("*", authMiddleware);

// Global Error Handler
app.onError((err, c) => {
  console.error("Unhandled Global Error:", err);
  return c.json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" 
      ? "Đã xảy ra sự cố ngoài ý muốn. Vui lòng liên hệ quản trị viên." 
      : err.message
  }, 500);
});

// Root health check
app.get("/api/v1/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount routes
app.route("/api/v1/auth", authRouter);
app.route("/api/v1/documents", docsRouter);
app.route("/api/v1/questions", questionsRouter);
app.route("/api/v1/admin", adminRouter);
app.route("/api/v1/exam", examRouter);
app.route("/api/v1/pricing-content", pricingRouter);
app.route("/api/v1/pricing-packages", pricingPackagesRouter);

const PORT = parseInt(process.env.PORT || "3001", 10);

const server = serve(
  { fetch: app.fetch, port: PORT },
  () => console.log(`🚀 Backend Hono running at http://localhost:${PORT}`)
);

// Graceful Shutdown - Đóng kết nối an toàn khi tắt/cập nhật server
const gracefulShutdown = () => {
  console.log("Shutting down server gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
