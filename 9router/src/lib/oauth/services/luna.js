/**
 * Luna Proxy Browser Capture Service
 * 
 * Captures Qwen AI JWT tokens from browser localStorage/cookies using Puppeteer,
 * mirroring the auth logic from luna-proxy's QwenAiAdapter and qwenAiCapture modules.
 * 
 * This is an alternative to the standard Qwen device_code OAuth flow —
 * it works by opening chat.qwen.ai in a browser and capturing the session token.
 */
import { LUNA_CONFIG } from "../constants/oauth.js";

// JWT decode helper
function decodeJwtPayload(jwt) {
  try {
    if (!jwt || typeof jwt !== "string") return null;
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = 4 - (base64.length % 4);
    const padded = padding !== 4 ? base64 + "=".repeat(padding) : base64;
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function readJsonLikeResponse(response) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const bodyText = await response.text();
  if (!bodyText) return { __empty: true };
  if (!contentType.includes("json") && !/^[\s\r\n]*[\[{]/.test(bodyText)) {
    return { __nonJson: true, text: bodyText };
  }
  try {
    return JSON.parse(bodyText);
  } catch {
    return { __nonJson: true, text: bodyText };
  }
}

/**
 * LunaService - Browser Capture Authentication for Qwen AI
 */
export class LunaService {
  constructor() {
    this.config = LUNA_CONFIG;
    this.puppeteer = null;
  }

  /**
   * Dynamically import puppeteer
   */
  async ensurePuppeteer() {
    if (this.puppeteer) return this.puppeteer;
    try {
      this.puppeteer = await import(/* webpackIgnore: true */ "puppeteer");
      return this.puppeteer;
    } catch (e) {
      const detail = String(e?.message || e || "").trim();
      throw new Error(
        [
          "Puppeteer could not be loaded in this runtime.",
          "This usually means the hosting build did not include the package, or the server environment cannot resolve it at runtime.",
          detail ? `Original error: ${detail}` : "",
          "If you want Luna capture on hosting, you also need a reachable Chrome/Chromium binary or a remote-debugging Chrome session. Installing puppeteer alone is not enough."
        ].filter(Boolean).join(" ")
      );
    }
  }

  /**
   * Detect the browser used by the dashboard request.
   */
  detectBrowserName(browserHint = {}) {
    const explicitName = String(browserHint?.browserName || "").toLowerCase();
    if (["chrome", "edge", "coccoc", "brave", "chromium"].includes(explicitName)) {
      return explicitName;
    }

    const userAgent = String(browserHint?.userAgent || browserHint?.requestUserAgent || "").toLowerCase();
    if (/coc_coc_browser|coccocbrowser|cocbrowser/.test(userAgent)) return "coccoc";
    if (/edgwebview|edg\//.test(userAgent)) return "edge";
    if (/brave/.test(userAgent)) return "brave";
    if (/chromium/.test(userAgent)) return "chromium";
    if (/chrome|crios/.test(userAgent)) return "chrome";
    return "";
  }

  /**
   * Read the user's Windows default HTTPS browser as a fallback when UA is ambiguous.
   */
  async detectWindowsDefaultBrowserName() {
    if (process.platform !== "win32") return "";
    try {
      const { execFile } = await import("child_process");
      const output = await new Promise((resolve) => {
        execFile(
          "reg",
          [
            "query",
            "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice",
            "/v",
            "ProgId",
          ],
          { windowsHide: true, timeout: 1500 },
          (_error, stdout) => resolve(stdout || ""),
        );
      });
      const progId = String(output).toLowerCase();
      if (progId.includes("coccoc") || progId.includes("coc_coc")) return "coccoc";
      if (progId.includes("brave")) return "brave";
      if (progId.includes("edge")) return "edge";
      if (progId.includes("chrome")) return "chrome";
    } catch {}
    return "";
  }

  getBrowserPathMap() {
    const localAppData = process.env.LOCALAPPDATA || "";
    const home = process.env.HOME || "";
    return {
      chrome: [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        `${home}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
      ],
      edge: [
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        `${localAppData}\\Microsoft\\Edge\\Application\\msedge.exe`,
        "/usr/bin/microsoft-edge-stable",
        "/usr/bin/microsoft-edge",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      ],
      coccoc: [
        "C:\\Program Files\\CocCoc\\Browser\\Application\\browser.exe",
        "C:\\Program Files (x86)\\CocCoc\\Browser\\Application\\browser.exe",
        `${localAppData}\\CocCoc\\Browser\\Application\\browser.exe`,
      ],
      brave: [
        "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        `${localAppData}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
        "/usr/bin/brave-browser",
        "/usr/bin/brave",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      ],
      chromium: [
        "C:\\Program Files\\Chromium\\Application\\chrome.exe",
        `${localAppData}\\Chromium\\Application\\chrome.exe`,
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ],
    };
  }

  getBrowserOrder(preferredBrowser, defaultBrowser) {
    const order = [];
    for (const name of [preferredBrowser, defaultBrowser, "chrome", "edge", "coccoc", "brave", "chromium"]) {
      if (name && !order.includes(name)) order.push(name);
    }
    return order;
  }

  isAllowedBrowserExecutable(filePath) {
    const value = String(filePath || "").toLowerCase();
    if (!value) return false;
    if (value.includes("webview")) return false;
    return (
      value.endsWith("chrome.exe") ||
      value.endsWith("msedge.exe") ||
      value.endsWith("brave.exe") ||
      value.endsWith("browser.exe") ||
      value.includes("/google chrome") ||
      value.includes("/microsoft edge") ||
      value.includes("/brave browser") ||
      value.endsWith("/google-chrome") ||
      value.endsWith("/google-chrome-stable") ||
      value.endsWith("/microsoft-edge") ||
      value.endsWith("/microsoft-edge-stable") ||
      value.endsWith("/brave-browser") ||
      value.endsWith("/brave") ||
      value.endsWith("/chromium") ||
      value.endsWith("/chromium-browser")
    );
  }

  /**
   * Find a working desktop browser executable.
   */
  async findBrowser(browserHint = {}) {
    const { access } = await import("fs/promises");
    const preferredBrowser = this.detectBrowserName(browserHint);
    const defaultBrowser = await this.detectWindowsDefaultBrowserName();
    const pathMap = this.getBrowserPathMap();
    for (const browserName of this.getBrowserOrder(preferredBrowser, defaultBrowser)) {
      for (const path of pathMap[browserName] || []) {
        if (!this.isAllowedBrowserExecutable(path)) continue;
        try {
          await access(path);
          return { executablePath: path, browserName };
        } catch {
          continue;
        }
      }
    }

    for (const browserPaths of Object.values(pathMap)) {
      for (const path of browserPaths || []) {
        if (!this.isAllowedBrowserExecutable(path)) continue;
        try {
          await access(path);
          return { executablePath: path, browserName: "detected" };
        } catch {
          continue;
        }
      }
    }

    return { executablePath: null, browserName: "" };
  }

  /**
   * Backwards-compatible helper for older call sites.
   */
  async findChrome() {
    const browser = await this.findBrowser({ browserName: "chrome" });
    return browser.executablePath;
  }

  /**
   * Normalize localStorage value — extract token from potential nested JSON
   */
  normalizeStorageValue(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";

    // If it's a JSON object with a token field
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed.value === "string") return parsed.value;
        if (typeof parsed.token === "string") return parsed.token;
        if (typeof parsed.accessToken === "string") return parsed.accessToken;
        if (typeof parsed.access_token === "string") return parsed.access_token;
      } catch {
        // Not valid JSON, return as-is
        return trimmed;
      }
    }

    return trimmed;
  }

  /**
   * Basic token format validation
   */
  isValidToken(token) {
    if (!token || typeof token !== "string") return false;
    if (token.length < 20) return false;
    if (token.length > 10000) return false;
    
    // Reject guest tokens
    try {
      const payload = decodeJwtPayload(token);
      if (payload?.email?.endsWith("@guest.com")) return false;
    } catch {}
    
    // JWT format check
    if (token.split(".").length === 3) return true;
    
    // Other token formats (32+ chars)
    return token.length >= 32;
  }

  isUnauthorizedAccountInfo(data) {
    const code = String(data?.code || data?.error || data?.error_code || "").toLowerCase();
    const details = String(data?.details || data?.message || data?.error_description || "").toLowerCase();
    const combined = `${code} ${details}`;
    return (
      data?.success === false ||
      code === "unauthorized" ||
      combined.includes("session has expired") ||
      combined.includes("token is no longer valid") ||
      combined.includes("sign in again") ||
      combined.includes("please sign in") ||
      combined.includes("not authenticated")
    );
  }

  buildCookieHeader(cookies) {
    return (cookies || [])
      .filter((cookie) => cookie?.name && cookie?.value)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  }

  /**
   * Validate token against Qwen AI API
   */
  async validateToken(token, cookies) {
    try {
      const baseHeaders = { ...this.config.fakeHeaders };
      const attempts = [
        { token, cookies, type: token ? "jwt" : "cookie" },
        token ? { token, cookies: "", type: "jwt" } : null,
        cookies ? { token: "", cookies, type: "cookie" } : null,
      ].filter(Boolean);
      let sawVerificationPage = false;

      for (const attempt of attempts) {
        const headers = { ...baseHeaders };
        if (attempt.token) headers.Authorization = `Bearer ${attempt.token}`;
        if (attempt.cookies) headers.Cookie = attempt.cookies;

        const response = await fetch(`${this.config.baseUrl}/api/v2/user/info`, {
          headers,
        });

        if (!response.ok) continue;

        const resJson = await readJsonLikeResponse(response);
        if (resJson.__nonJson) {
          sawVerificationPage = true;
          continue;
        }
        const data = resJson.data || resJson;
        if (this.isUnauthorizedAccountInfo(data)) {
          return { valid: false, error: data?.details || data?.message || data?.code || "Token is unauthorized" };
        }
        return { valid: true, data, type: attempt.type };
      }

      if (sawVerificationPage) {
        return { valid: false, captchaDetected: true, error: "Qwen returned access verification page" };
      }
    } catch {}

    return { valid: false };
  }

  /**
   * Detect whether a CDP endpoint belongs to a real desktop browser.
   */
  isUsableCdpEndpoint(versionInfo, browserHint = {}) {
    const browser = String(versionInfo?.Browser || "").toLowerCase();
    const userAgent = String(versionInfo?.["User-Agent"] || "").toLowerCase();
    const hintedUserAgent = String(browserHint?.userAgent || browserHint?.requestUserAgent || "").toLowerCase();
    const wsEndpoint = String(versionInfo?.webSocketDebuggerUrl || "").toLowerCase();
    const combined = `${browser}\n${userAgent}\n${wsEndpoint}`;

    if (!versionInfo?.webSocketDebuggerUrl) return false;
    if (/webview|edgwebview|webview2/.test(combined)) return false;
    if (/webview|edgwebview|webview2/.test(hintedUserAgent)) return false;
    if (!/^mozilla\//.test(userAgent)) return false;
    if (!/(chrome|chromium|edg\/|brave|coccoc|coc_coc|cocbrowser)/.test(userAgent)) return false;

    const preferredBrowser = this.detectBrowserName(browserHint);
    if (!preferredBrowser) return true;

    if (preferredBrowser === "edge") return /edge|edg\//.test(combined);
    if (preferredBrowser === "brave") return /brave/.test(combined);
    if (preferredBrowser === "coccoc") return /coccoc|coc_coc|cocbrowser/.test(combined);
    if (preferredBrowser === "chrome") return /chrome/.test(combined) && !/edge|edg\/|brave|coccoc/.test(combined);
    if (preferredBrowser === "chromium") return /chromium/.test(combined);
    return true;
  }

  /**
   * Connect to an existing desktop browser instance via CDP.
   */
  async connectCDP(browserHint = {}) {
    const puppeteer = await this.ensurePuppeteer();
    const http = await import("http");

    const detectCdpEndpoint = () => {
      return new Promise((resolve) => {
        const req = http.get(
          {
            host: "127.0.0.1",
            port: this.config.captureConfig.cdpPort,
            path: "/json/version",
            timeout: 1500,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              try {
                const json = JSON.parse(data);
                resolve(json || null);
              } catch {
                resolve(null);
              }
            });
          }
        );
        req.on("error", () => resolve(null));
        req.on("timeout", () => {
          req.destroy();
          resolve(null);
        });
      });
    };

    try {
      const versionInfo = await detectCdpEndpoint();
      if (!this.isUsableCdpEndpoint(versionInfo, browserHint)) return null;

      const browser = await puppeteer.connect({
        browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
        defaultViewport: null,
      });
      return browser;
    } catch {
      return null;
    }
  }

  /**
   * Launch a new isolated desktop browser instance
   */
  async launchBrowser(browserHint = {}) {
    const puppeteer = await this.ensurePuppeteer();
    const { executablePath, browserName } = await this.findBrowser(browserHint);
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const { mkdir } = await import("fs/promises");

    const tempDir = join(tmpdir(), `luna-${browserName || "browser"}-${Date.now()}`);
    try {
      await mkdir(tempDir, { recursive: true });
    } catch {}

    const launchOptions = {
      headless: false,
      userDataDir: tempDir,
      defaultViewport: null,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--start-maximized",
        "--disable-blink-features=AutomationControlled",
      ],
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    if (!executablePath) {
      throw new Error(
        "No supported desktop browser executable was found. Luna browser capture needs Chrome, Edge, Coc Coc, Brave, or Chromium; on hosting, use a server with a real browser installed or a remote-debugging browser session."
      );
    }

    const browser = await puppeteer.launch(launchOptions);
    // Attach the temp directory path so we can clean it up later
    browser.__tempDir = tempDir;
    browser.__browserName = browserName;
    browser.__executablePath = executablePath;
    return browser;
  }

  /**
   * Poll browser page for auth token in localStorage and cookies
   */
  async pollForToken(page, timeout = this.config.captureConfig.timeout) {
    const pollInterval = this.config.captureConfig.pollInterval;
    const startTime = Date.now();
    const tokenKey = this.config.captureConfig.localStorageTokenKey;

    while (Date.now() - startTime < timeout) {
      // Detect if user closed the tab/window
      if (page.isClosed()) {
        throw new Error("Cửa sổ đăng nhập đã bị đóng");
      }
      try {
        // Check localStorage
        const localStorageToken = await page.evaluate((key) => {
          try {
            return localStorage.getItem(key) || localStorage.getItem("accessToken") || null;
          } catch { return null; }
        }, tokenKey);

        const normalized = this.normalizeStorageValue(localStorageToken);

        // Check cookies as fallback. Use the page URL explicitly so Chromium returns
        // host-scoped cookies even during redirects.
        const cookies = await page.cookies(this.config.captureConfig.loginUrl);
        const cookieStr = this.buildCookieHeader(cookies);

        if (normalized && this.isValidToken(normalized)) {
          const validation = await this.validateToken(normalized, cookieStr);
          if (validation.valid) {
            return { token: normalized, cookies: cookieStr, captureMethod: "localStorage" };
          }
        }

        const tokenCookie = cookies.find((cookie) => cookie?.name === "token");
        if (tokenCookie && this.isValidToken(tokenCookie.value)) {
          const validation = await this.validateToken(tokenCookie.value, cookieStr);
          if (validation.valid) {
            return { token: tokenCookie.value, cookies: cookieStr, captureMethod: "cookie" };
          }
        }
      } catch (e) {
        // Page might not be fully loaded yet
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error("Authentication timeout: No token captured within the time limit");
  }

  /**
   * Main capture flow — connects to browser, navigates to Qwen AI, captures token
   * @param {number} timeout - Max wait time in ms
   * @param {AbortSignal} [signal] - Optional AbortSignal to cancel early
   */
  async captureToken(timeout = this.config.captureConfig.timeout, signal, options = {}) {
    let browser = null;
    let isCdp = false;
    let capturedPage = null;
    let isAborted = false;

    const abortHandler = () => {
      isAborted = true;
      if (browser) {
        try { isCdp ? browser.disconnect() : browser.close(); } catch {}
      }
    };
    signal?.addEventListener("abort", abortHandler, { once: true });

    try {
      const browserHint = {
        ...(options.browserHint || {}),
        requestUserAgent: options.requestUserAgent || "",
      };

      // Strategy 1: Try CDP only when the port belongs to a real matching desktop browser.
      browser = await this.connectCDP(browserHint);
      if (browser) {
        isCdp = true;
      } else {
        // Strategy 2: Launch the matching installed browser with a temp profile
        browser = await this.launchBrowser(browserHint);
        isCdp = false;
      }

      if (isAborted) throw new DOMException("Aborted", "AbortError");

      // Always open a fresh tab, matching luna-proxy behavior
      const page = await browser.newPage();
      capturedPage = page;

      if (isAborted) throw new DOMException("Aborted", "AbortError");

      // Navigate to Qwen AI login page
      await page.goto(this.config.captureConfig.loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: Math.min(30000, timeout),
      });

      if (isAborted) throw new DOMException("Aborted", "AbortError");

      // Poll for token
      const result = await this.pollForToken(page, timeout);

      return result;
    } catch (error) {
      if (error.name === "AbortError" || isAborted) {
        throw new Error("Capture cancelled by user");
      }
      throw error;
    } finally {
      signal?.removeEventListener("abort", abortHandler);

      if (capturedPage && isCdp) {
        // For CDP: only close the tab we opened, keep user's Chrome alive
        try { await capturedPage.close(); } catch {}
      }

      if (browser) {
        if (isCdp) {
          // CDP: disconnect from Chrome without killing the browser
          try { browser.disconnect(); } catch {}
        } else {
          // Launched browser: close the entire browser instance
          const tempDir = browser.__tempDir;
          try { await browser.close(); } catch {}

          // Clean up temp directory
          if (tempDir) {
            try {
              const { rm } = await import("fs/promises");
              await rm(tempDir, { recursive: true, force: true });
            } catch {}
          }
        }
      }
    }
  }

  /**
   * Save captured token to the server
   * (CLI-only — uses dynamic import to avoid Turbopack build issues)
   */
  async saveTokens(tokenData, accountInfo) {
    const configMod = await eval('import("../config/index.js")');
    const { server, token, userId } = configMod.getServerCredentials();

    const response = await fetch(`${server}/api/oauth/luna/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-User-Id": userId,
      },
      body: JSON.stringify({
        accessToken: tokenData.token,
        cookies: tokenData.cookies,
        captureMethod: tokenData.captureMethod,
        email: accountInfo?.email,
        displayName: accountInfo?.displayName || accountInfo?.nickname,
        accountInfo,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save tokens");
    }

    return await response.json();
  }
}
