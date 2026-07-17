import { ARENA_CONFIG } from "../constants/oauth.js";

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

function decodeArenaAuthSessionToken(token) {
  try {
    const cleanToken = typeof token === "string" ? token.trim() : "";
    if (!cleanToken.startsWith("base64-")) return null;
    const b64 = cleanToken.slice("base64-".length);
    if (!b64) return null;
    const padding = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padding);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function cleanCookieValue(value) {
  let val = String(value || "").trim();
  try {
    val = decodeURIComponent(val).trim();
  } catch {}
  if (val.startsWith('"') && val.endsWith('"')) {
    val = val.slice(1, -1).trim();
  }
  if (val.startsWith("'") && val.endsWith("'")) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

function combineSplitArenaAuthCookies(cookiesList) {
  const parts = {};
  for (const cookie of cookiesList || []) {
    const name = String(cookie.name || "");
    const val = cleanCookieValue(cookie.value || "");
    if (name === "arena-auth-prod-v1.0") {
      parts[0] = val;
    } else if (name === "arena-auth-prod-v1.1") {
      parts[1] = val;
    }
  }
  if (parts[0] !== undefined && parts[1] !== undefined) {
    const combined = (parts[0] + parts[1]).strip ? (parts[0] + parts[1]).trim() : String(parts[0] + parts[1]).trim();
    const cleaned = cleanCookieValue(combined);
    return cleaned ? `base64-${cleaned.replace(/^base64-/, "")}` : null;
  } else if (parts[0] !== undefined) {
    const cleaned = cleanCookieValue(parts[0]);
    return cleaned ? `base64-${cleaned.replace(/^base64-/, "")}` : null;
  }
  return null;
}

async function clickTurnstile(page) {
  console.log("  🖱️  Attempting to click Cloudflare Turnstile...");
  try {
    const selectors = [
      '#lm-bridge-turnstile',
      '#lm-bridge-turnstile iframe',
      '#cf-turnstile',
      'iframe[src*="challenges.cloudflare.com"]',
      '[style*="display: grid"] iframe'
    ];

    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          // Check if iframe
          const frame = await element.contentFrame();
          if (frame !== null) {
            const innerSelectors = [
              "input[type='checkbox']",
              "div[role='checkbox']",
              "label"
            ];
            for (const innerSel of innerSelectors) {
              try {
                const inner = await frame.$(innerSel);
                if (inner) {
                  await inner.click({ delay: 50 });
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  return true;
                }
              } catch (e) {
                continue;
              }
            }
          }

          // Direct click
          try {
            await element.click({ delay: 50 });
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
          } catch (e) {}

          // Click by coordinates
          try {
            const box = await element.boundingBox();
            if (box) {
              const x = box.x + box.width / 2;
              const y = box.y + box.height / 2;
              await page.mouse.click(x, y);
              await new Promise(resolve => setTimeout(resolve, 2000));
              return true;
            }
          } catch (e) {}
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  } catch (e) {
    console.log("  ⚠️ Error clicking turnstile:", e);
    return false;
  }
}

/**
 * ArenaService - Browser Capture Authentication for Arena.ai
 */
export class ArenaService {
  constructor() {
    this.config = ARENA_CONFIG;
    this.puppeteer = null;
  }

  async ensurePuppeteer() {
    if (this.puppeteer) return this.puppeteer;
    try {
      this.puppeteer = await import("puppeteer");
      return this.puppeteer;
    } catch (e) {
      const detail = String(e?.message || e || "").trim();
      throw new Error(
        [
          "Puppeteer could not be loaded in this runtime.",
          detail ? `Original error: ${detail}` : ""
        ].filter(Boolean).join(" ")
      );
    }
  }

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

  isValidToken(token) {
    if (!token || typeof token !== "string") return false;
    if (token.length < 32) return false;
    return true;
  }

  buildCookieHeader(cookies) {
    return (cookies || [])
      .filter((cookie) => cookie?.name && cookie?.value)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  }

  async validateToken(token, cookies) {
    const cleanToken = typeof token === "string" ? token.trim() : "";
    if (!cleanToken) return { valid: false, error: "No token provided" };

    let session = null;
    let email = null;
    let expiresAt = null;

    if (cleanToken.startsWith("base64-")) {
      session = decodeArenaAuthSessionToken(cleanToken);
      if (session) {
        email = session.user?.email || (session.access_token ? decodeJwtPayload(session.access_token)?.email : null);
        expiresAt = session.expires_at || (session.access_token ? decodeJwtPayload(session.access_token)?.exp : null);
      }
    } else {
      const payload = decodeJwtPayload(cleanToken);
      if (payload) {
        email = payload.email || payload.preferred_username || payload.sub;
        expiresAt = payload.exp;
      }
    }

    if (!email) {
      return { valid: false, error: "Invalid token structure" };
    }

    if (expiresAt && expiresAt * 1000 < Date.now()) {
      return { valid: false, error: "Token has expired" };
    }

    return {
      valid: true,
      email,
      accountInfo: session || { email },
    };
  }

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
      if (!versionInfo?.webSocketDebuggerUrl) return null;

      const browser = await puppeteer.connect({
        browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
        defaultViewport: null,
      });
      return browser;
    } catch {
      return null;
    }
  }

  async launchBrowser(browserHint = {}) {
    const puppeteer = await this.ensurePuppeteer();
    const { executablePath, browserName } = await this.findBrowser(browserHint);
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const { mkdir } = await import("fs/promises");

    const tempDir = join(tmpdir(), `arena-${browserName || "browser"}-${Date.now()}`);
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
        "No supported desktop browser executable was found."
      );
    }

    const browser = await puppeteer.launch(launchOptions);
    browser.__tempDir = tempDir;
    browser.__browserName = browserName;
    browser.__executablePath = executablePath;
    return browser;
  }

  async pollForToken(page, timeout = this.config.captureConfig.timeout) {
    const pollInterval = this.config.captureConfig.pollInterval;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (page.isClosed()) {
        throw new Error("Cửa sổ đăng nhập đã bị đóng");
      }
      try {
        // Handle cloudflare turnstile if present
        await clickTurnstile(page);

        const cookies = await page.cookies(this.config.captureConfig.loginUrl);
        const cookieStr = this.buildCookieHeader(cookies);

        // Check for consolidated cookie
        const mainCookie = cookies.find((c) => c.name === "arena-auth-prod-v1");
        if (mainCookie && this.isValidToken(mainCookie.value)) {
          const combined = `base64-${cleanCookieValue(mainCookie.value).replace(/^base64-/, "")}`;
          const validation = await this.validateToken(combined, cookieStr);
          if (validation.valid) {
            return { token: combined, cookies: cookieStr, captureMethod: "cookie" };
          }
        }

        // Try to combine split cookies (.0 and .1)
        const combinedVal = combineSplitArenaAuthCookies(cookies);
        if (combinedVal && this.isValidToken(combinedVal)) {
          const validation = await this.validateToken(combinedVal, cookieStr);
          if (validation.valid) {
            return { token: combinedVal, cookies: cookieStr, captureMethod: "cookie_split" };
          }
        }
      } catch (e) {
        // Page might not be fully loaded or context destroyed
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error("Authentication timeout: No token captured within the time limit");
  }

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

      browser = await this.connectCDP(browserHint);
      if (browser) {
        isCdp = true;
      } else {
        browser = await this.launchBrowser(browserHint);
        isCdp = false;
      }

      if (isAborted) throw new DOMException("Aborted", "AbortError");

      const page = await browser.newPage();
      capturedPage = page;

      if (isAborted) throw new DOMException("Aborted", "AbortError");

      await page.goto(this.config.captureConfig.loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: Math.min(30000, timeout),
      });

      if (isAborted) throw new DOMException("Aborted", "AbortError");

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
        try { await capturedPage.close(); } catch {}
      }

      if (browser) {
        if (isCdp) {
          try { browser.disconnect(); } catch {}
        } else {
          const tempDir = browser.__tempDir;
          try { await browser.close(); } catch {}

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
}
