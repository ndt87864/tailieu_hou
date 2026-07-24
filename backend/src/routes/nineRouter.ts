import { Hono } from "hono";
import { requireRole } from "../middlewares/role.js";

const nineRouter = new Hono();

// Yêu cầu tối thiểu vai trò management (level >= 90: management & admin)
nineRouter.use("*", requireRole("management"));

const getNineRouterUrl = (): string => {
  const url = process.env.NINE_ROUTER_URL || "http://localhost:20128";
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

// Helper fetch có timeout an toàn, tự giải phóng timer và ngắt kết nối khi hết giờ
const fetchSingleEndpoint = async (url: string, timeoutMs: number = 4000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Endpoint kiểm tra trạng thái hoạt động của 9Router
nineRouter.get("/status", async (c) => {
  const targetBase = getNineRouterUrl();

  try {
    let response: Response;
    try {
      response = await fetchSingleEndpoint(`${targetBase}/api/v1/models`, 4000);
    } catch {
      // Fallback thử endpoint /v1/models với controller & timeout hoàn toàn độc lập
      response = await fetchSingleEndpoint(`${targetBase}/v1/models`, 4000);
    }

    if (response.ok || response.status === 401 || response.status === 403) {
      return c.json({
        ok: true,
        targetUrl: targetBase,
        statusCode: response.status,
        message: "9Router service is online and reachable.",
      });
    }

    return c.json(
      {
        ok: false,
        targetUrl: targetBase,
        statusCode: response.status,
        message: `9Router returned HTTP ${response.status}`,
      },
      502
    );
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        targetUrl: targetBase,
        error: err.name === "AbortError" ? "Connection timed out (4s)" : err.message,
        message: "Cannot connect to 9Router service.",
      },
      503
    );
  }
});

// Proxy tất cả các đường dẫn dưới /v1/* hoặc /* tới 9Router
nineRouter.all("/*", async (c) => {
  const targetBase = getNineRouterUrl();
  const subPath = c.req.path.replace(/^\/api\/v1\/nine-router/, "");
  const targetUrl = `${targetBase}${subPath}${
    c.req.url.includes("?") ? c.req.url.slice(c.req.url.indexOf("?")) : ""
  }`;

  const incomingHeaders = c.req.header();
  const forwardHeaders: Record<string, string> = {};

  // Bảo mật: Lọc bỏ các header nhạy cảm, loại bỏ JWT token của HOU (Authorization)
  const excludedHeaders = ["host", "connection", "content-length", "authorization", "cookie"];
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (!excludedHeaders.includes(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  }

  // Nếu trong file .env có cấu hình NINE_ROUTER_API_KEY riêng, sử dụng cho 9Router Gateway
  if (process.env.NINE_ROUTER_API_KEY) {
    forwardHeaders["authorization"] = `Bearer ${process.env.NINE_ROUTER_API_KEY}`;
  }

  try {
    let body: any = null;
    if (!["GET", "HEAD"].includes(c.req.method)) {
      body = await c.req.arrayBuffer();
    }

    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers: forwardHeaders,
      body: body ? body : undefined,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((val, key) => {
      if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
        responseHeaders.set(key, val);
      }
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.warn(`9Router Proxy Warning [${c.req.method} ${subPath}]: ${err?.message || err}`);
    return c.json(
      {
        error: "9Router Proxy Error",
        message: err.message || "Proxy connection failed",
      },
      502
    );
  }
});

export default nineRouter;
