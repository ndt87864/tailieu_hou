import { describe, expect, it } from "vitest";

import arena from "../../open-sse/providers/registry/arena.js";

const model = (id) => arena.models.find((entry) => entry.id === id);

describe("Arena model classification", () => {
  it("groups LLM models by model family", () => {
    expect(model("claude-sonnet-4-6")).toMatchObject({ group: "Claude" });
    expect(model("gpt-5.4")).toMatchObject({ group: "OpenAI" });
    expect(model("gpt-5.3-codex")).toMatchObject({ group: "Codex" });
    expect(model("gemini-3.1-pro")).toMatchObject({ group: "Gemini / Gemma" });
    expect(model("deepseek-v4-pro")).toMatchObject({ group: "DeepSeek" });
  });

  it("moves image, video, and search models to media kinds", () => {
    expect(arena.serviceKinds).toEqual(expect.arrayContaining(["image", "video", "webSearch"]));
    expect(model("gpt-image-1")).toMatchObject({ group: "Image", kind: "image" });
    expect(model("veo-3.1-audio")).toMatchObject({ group: "Video", kind: "video" });
    expect(model("gpt-5-search")).toMatchObject({ group: "Search", kind: "webSearch" });
    expect(arena.searchViaChat.defaultModel).toBe("gpt-5-search");
  });
});
