import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import dotenv from "dotenv";

import authRouter from "./routes/auth.js";
import docsRouter from "./routes/docs.js";
import questionsRouter from "./routes/questions.js";
import adminRouter from "./routes/admin.js";
import examRouter from "./routes/exam.js";
import { authMiddleware } from "./middlewares/auth.js";

dotenv.config();

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", cors({ origin: "*", credentials: true }));
app.use("*", authMiddleware);

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

const PORT = parseInt(process.env.PORT || "3001", 10);

serve(
  { fetch: app.fetch, port: PORT },
  () => console.log(`🚀 Backend Hono running at http://localhost:${PORT}`)
);
