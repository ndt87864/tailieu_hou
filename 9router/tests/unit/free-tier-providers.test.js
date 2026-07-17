import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database functions
vi.mock("@/lib/localDb", () => ({
  getProviderConnections: vi.fn(),
  getCombos: vi.fn().mockResolvedValue([]),
  getCustomModels: vi.fn().mockResolvedValue([]),
  getModelAliases: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/disabledModelsDb", () => ({
  getDisabledModels: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/models", () => ({
  getProviderConnectionById: vi.fn(),
}));

const originalFetch = global.fetch;

describe("Free Tier Providers Models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("dynamically fetches models via modelsFetcher in buildModelsList", async () => {
    const { getProviderConnections } = await import("@/lib/localDb");
    getProviderConnections.mockResolvedValue([
      { id: "opencode-conn", provider: "opencode", isActive: true }
    ]);

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: "oc/deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free" },
          { id: "oc/deepseek-v4-pro", name: "DeepSeek V4 Pro" }
        ]
      })
    });
    global.fetch = fetchSpy;

    const { buildModelsList } = await import("@/app/api/v1/models/route.js");
    const models = await buildModelsList(["llm"]);

    expect(fetchSpy).toHaveBeenCalledWith("https://opencode.ai/zen/v1/models", expect.any(Object));
    // Since outputAlias for opencode is "oc", prefix is "oc", so the final model id is oc/deepseek-v4-flash-free
    expect(models).toContainEqual({
      id: "oc/deepseek-v4-flash-free",
      object: "model",
      owned_by: "oc"
    });
  });

  it("injects opencode implicit connection and fetches models dynamically even when other providers are connected in the DB", async () => {
    const { getProviderConnections } = await import("@/lib/localDb");
    getProviderConnections.mockResolvedValue([
      { id: "openrouter-conn", provider: "openrouter", isActive: true }
    ]);

    const fetchSpy = vi.fn().mockImplementation((url) => {
      if (url === "https://opencode.ai/zen/v1/models") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { id: "oc/deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free" }
            ]
          })
        });
      }
      if (url === "https://openrouter.ai/api/v1/models") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { id: "openrouter/some-model:free", name: "Some Free Model", pricing: { prompt: "0", completion: "0" }, context_length: 200000 }
            ]
          })
        });
      }
      return Promise.resolve({ ok: false });
    });
    global.fetch = fetchSpy;

    const { buildModelsList } = await import("@/app/api/v1/models/route.js");
    const models = await buildModelsList(["llm"]);

    expect(fetchSpy).toHaveBeenCalledWith("https://opencode.ai/zen/v1/models", expect.any(Object));
    expect(fetchSpy).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models", expect.any(Object));

    expect(models).toContainEqual({
      id: "oc/deepseek-v4-flash-free",
      object: "model",
      owned_by: "oc"
    });
    expect(models).toContainEqual({
      id: "openrouter/some-model:free",
      object: "model",
      owned_by: "openrouter"
    });
  });

  it("opencode custom models resolver handles model listing correctly", async () => {
    const { getProviderConnectionById } = await import("@/models");
    getProviderConnectionById.mockResolvedValue({
      id: "opencode-conn",
      provider: "opencode",
      isActive: true
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: "oc/deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free" },
          { id: "oc/deepseek-v4-pro", name: "DeepSeek V4 Pro" }
        ]
      })
    });
    global.fetch = fetchSpy;

    const { GET } = await import("@/app/api/providers/[id]/models/route.js");
    
    // Construct Next.js request & params
    const request = new Request("http://localhost/api/providers/opencode-conn/models");
    const params = Promise.resolve({ id: "opencode-conn" });

    const response = await GET(request, { params });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.provider).toBe("opencode");
    expect(body.models).toEqual([
      { id: "oc/deepseek-v4-flash-free", name: "oc/deepseek-v4-flash-free" }
    ]);
  });
});
