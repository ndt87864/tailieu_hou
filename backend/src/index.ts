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
import crawlerAdminRouter from "./routes/crawlerAdmin.js";
import examRouter from "./routes/exam.js";
import pricingRouter from "./routes/pricingContent.js";
import pricingPackagesRouter from "./routes/pricingPackages.js";
import { authMiddleware } from "./middlewares/auth.js";
import { securityHeaders } from "./middlewares/security.js";
import { timeout } from "./middlewares/timeout.js";
import { rateLimiter } from "./middlewares/rateLimiter.js";
import { startRegistrationQueueWorker, stopRegistrationQueueWorker } from "./services/queueWorker.js";
import { supabaseAdmin } from "./config/db.js";
import { getGroupedDocumentsPreview, getGroupedDocumentsFull } from "./services/documentService.js";
import { getQuestionRatios } from "./middlewares/questionLimit.js";

dotenv.config();

const app = new Hono();

// Global Middlewares
app.use("*", cors({ origin: "*", credentials: true }));
app.use("*", securityHeaders);
app.use("*", timeout(15000)); // Timeout 15s để bảo vệ resource
app.use("/api/v1/auth/*", rateLimiter(20, 60000)); // Auth endpoints: 20 req/phút
app.use("/api/v1/*", rateLimiter(100, 60000)); // API chung: 100 req/phút
app.use("*", logger());
app.use("*", compress()); // Nén Gzip/Brotli giảm bandwidth truyền tải dữ liệu
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
app.route("/api/v1/admin/crawler", crawlerAdminRouter);
app.route("/api/v1/exam", examRouter);
app.route("/api/v1/pricing-content", pricingRouter);
app.route("/api/v1/pricing-packages", pricingPackagesRouter);

const PORT = parseInt(process.env.PORT || "3001", 10);

const preWarmConnectionAndCache = async () => {
  console.log("⚡ Pre-warming database connections and caching document structures...");
  const startTime = Date.now();
  try {
    await Promise.all([
      supabaseAdmin.from("categories").select("id").limit(1),
      supabaseAdmin.from("questions").select("id").limit(1),
      supabaseAdmin.from("documents").select("id").limit(1),
      supabaseAdmin.from("premium_user").select("id").limit(1),
      getQuestionRatios(), // Warm the ratio config cache
      getGroupedDocumentsPreview(false),
      getGroupedDocumentsPreview(true),
      getGroupedDocumentsFull(false),
      getGroupedDocumentsFull(true),
    ]);
    console.log(`⚡ Database connection & grouped document cache pre-warmed successfully in ${Date.now() - startTime}ms!`);
  } catch (error: any) {
    console.warn("⚠️ Pre-warming failed:", error?.message || error);
  }
};

const server = serve(
  { fetch: app.fetch, port: PORT },
  () => {
    console.log(`🚀 Backend Hono running at http://localhost:${PORT}`);
    startRegistrationQueueWorker();
    preWarmConnectionAndCache();

    // Heartbeat ping định kỳ 2 phút một lần để giữ ấm kết nối và chống bị swap container xuống Disk
    setInterval(async () => {
      try {
        await supabaseAdmin.from("categories").select("id").limit(1);
      } catch (error: any) {
        console.warn("⚠️ Heartbeat ping failed:", error?.message || error);
      }
    }, 120000);
  }
);

// Graceful Shutdown - Đóng kết nối an toàn khi tắt/cập nhật server
const gracefulShutdown = () => {
  console.log("Shutting down server gracefully...");
  stopRegistrationQueueWorker();
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
