import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/localDb", () => ({
  getSettings: vi.fn(),
}));

vi.mock("@/models", () => ({
  createProviderConnection: vi.fn(),
}));

vi.mock("@/lib/oauth/utils/server", () => ({
  startCodexProxy: vi.fn(),
  stopCodexProxy: vi.fn(),
  registerCodexSession: vi.fn(),
  getCodexSessionStatus: vi.fn(),
  clearCodexSession: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status || 200,
      body,
      json: async () => body,
    })),
    redirect: vi.fn((url) => ({ status: 307, url })),
  },
}));

const generateAuthData = vi.fn();
vi.mock("@/lib/oauth/providers", () => ({
  generateAuthData,
  getProvider: vi.fn(),
  exchangeTokens: vi.fn(),
  requestDeviceCode: vi.fn(),
  pollForToken: vi.fn(),
}));

describe("OAuth redirect origin handling", () => {
  const originalBaseUrl = process.env.BASE_URL;
  const originalPublicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  function restoreEnv(key, value) {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreEnv("BASE_URL", originalBaseUrl);
    restoreEnv("NEXT_PUBLIC_BASE_URL", originalPublicBaseUrl);
  });

  it("prefers the request origin over env values", async () => {
    process.env.BASE_URL = "http://localhost:20128";
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:20128";

    const { getPublicOrigin } = await import("../../src/lib/auth/oidc.js");
    const request = new Request("https://9router-olive.vercel.app/api/auth/oidc/start", {
      headers: {
        host: "9router-olive.vercel.app",
        "x-forwarded-proto": "https",
      },
    });

    expect(getPublicOrigin(request)).toBe("https://9router-olive.vercel.app");
  });

  it("falls back to the request origin when redirect_uri is omitted", async () => {
    const { GET } = await import("../../src/app/api/oauth/[provider]/[action]/route.js");

    generateAuthData.mockReturnValue({
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth?...",
      state: "state-123",
      codeVerifier: "verifier-123",
      codeChallenge: "challenge-123",
      redirectUri: "https://9router-olive.vercel.app/callback",
      flowType: "authorization_code",
      fixedPort: undefined,
      callbackPath: "/callback",
    });

    const request = new Request("https://9router-olive.vercel.app/api/oauth/codex/authorize", {
      headers: {
        host: "9router-olive.vercel.app",
        "x-forwarded-proto": "https",
      },
    });

    const response = await GET(request, { params: Promise.resolve({ provider: "codex", action: "authorize" }) });

    expect(generateAuthData).toHaveBeenCalledWith(
      "codex",
      "https://9router-olive.vercel.app/callback",
      undefined
    );
    expect(response.body.redirectUri).toBe("https://9router-olive.vercel.app/callback");
  });
});
