const arenaProvider = {
  id: "arena",
  priority: 136,
  alias: "ar",
  uiAlias: "ar",
  display: {
    name: "Arena Proxy",
    icon: "arena",
    color: "#F59E0B",
    website: "https://arena.ai",
    notice: {
      signupUrl: "https://arena.ai/?mode=direct",
    },
  },
  category: "oauth",
  serviceKinds: ["llm", "image", "video", "webSearch"],
  searchViaChat: {
    defaultModel: "gpt-5-search",
  },
  transport: {
    baseUrl: "https://arena.ai/api/v1/chat/completions",
    format: "arena",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://arena.ai/?mode=direct",
      "Origin": "https://arena.ai",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
    },
  },
  models: [
    // Claude Models
    {
        "id": "claude-haiku-4-5-20251001",
        "name": "claude-haiku-4-5-20251001 (anthropic)"
    },
    {
        "id": "claude-sonnet-4-20250514",
        "name": "claude-sonnet-4-20250514 (googleVertexAnthropic)"
    },
    {
        "id": "claude-sonnet-4-20250514-thinking-32k",
        "name": "claude-sonnet-4-20250514-thinking-32k (googleVertexAnthropic)"
    },
    {
        "id": "claude-sonnet-4-5-20250929",
        "name": "claude-sonnet-4-5-20250929 (googleVertexAnthropic)"
    },
    {
        "id": "claude-sonnet-4-5-20250929-thinking-32k",
        "name": "claude-sonnet-4-5-20250929-thinking-32k (googleVertexAnthropic)"
    },
    {
        "id": "claude-sonnet-4-6",
        "name": "claude-sonnet-4-6 (googleVertexAnthropic)"
    },
    // DeepSeek Models
    {
        "id": "deepseek-v4-flash",
        "name": "deepseek-v4-flash"
    },
    {
        "id": "deepseek-v4-flash-dlp-test",
        "name": "deepseek-v4-flash-dlp-test"
    },
    {
        "id": "deepseek-v4-flash-thinking",
        "name": "deepseek-v4-flash-thinking (deepseekToolCalling)"
    },
    {
        "id": "deepseek-v4-pro",
        "name": "deepseek-v4-pro"
    },
    {
        "id": "deepseek-v4-pro-thinking",
        "name": "deepseek-v4-pro-thinking (deepseekToolCalling)"
    },
    // Gemini/Gemma Models
    {
        "id": "gemini-2.0-flash-001",
        "name": "gemini-2.0-flash-001 (google)"
    },
    {
        "id": "gemini-2.5-flash",
        "name": "gemini-2.5-flash (googleVertex)"
    },
    {
        "id": "gemini-2.5-pro",
        "name": "gemini-2.5-pro (googleVertex)"
    },
    {
        "id": "gemini-2.5-pro-grounding",
        "name": "gemini-2.5-pro-grounding (googleVertex)"
    },
    {
        "id": "gemini-2.5-pro-grounding-exp",
        "name": "gemini-2.5-pro-grounding-exp"
    },
    {
        "id": "gemini-3-flash",
        "name": "gemini-3-flash"
    },
    {
        "id": "gemini-3-flash (thinking-minimal)",
        "name": "gemini-3-flash (thinking-minimal) (googleVertexGlobalWithThoughtSignatures)"
    },
    {
        "id": "gemini-3-flash-grounding",
        "name": "gemini-3-flash-grounding (googleVertexGlobalSearch)"
    },
    {
        "id": "gemini-3-pro",
        "name": "gemini-3-pro"
    },
    {
        "id": "gemini-3.1-flash-lite-preview",
        "name": "gemini-3.1-flash-lite-preview (googleVertexGlobalWithThoughtSignatures)"
    },
    {
        "id": "gemini-3.1-pro",
        "name": "gemini-3.1-pro"
    },
    {
        "id": "gemini-3.1-pro-preview",
        "name": "gemini-3.1-pro-preview"
    },
    {
        "id": "gemini-3.5-flash",
        "name": "gemini-3.5-flash"
    },
    {
        "id": "gemma-3-27b-it",
        "name": "gemma-3-27b-it (google)"
    },
    {
        "id": "gemma-3n-e4b-it",
        "name": "gemma-3n-e4b-it (google)"
    },
    {
        "id": "significant-otter",
        "name": "gemma-4-26b-a4b (googleWithThoughtSignatures)"
    },
    {
        "id": "pteronura",
        "name": "gemma-4-31b (googleWithThoughtSignatures)"
    },
    // GLM Models
    {
        "id": "glm-4.7",
        "name": "glm-4.7 (fireworks)"
    },
    {
        "id": "glm-5",
        "name": "glm-5 (siliconFlowToolCalling)"
    },
    {
        "id": "glm-5.1",
        "name": "glm-5.1 (siliconFlowToolCalling)"
    },
    {
        "id": "glm-5v-turbo",
        "name": "glm-5v-turbo (siliconFlowToolCalling)"
    },
    // GPT Models
    {
        "id": "gpt-4.1-2025-04-14",
        "name": "gpt-4.1-2025-04-14 (openai)"
    },
    {
        "id": "gpt-4.1-mini-2025-04-14",
        "name": "gpt-4.1-mini-2025-04-14 (openai)"
    },
    {
        "id": "gpt-5-chat",
        "name": "gpt-5-chat (openai)"
    },
    {
        "id": "gpt-5-high",
        "name": "gpt-5-high (openai)"
    },
    {
        "id": "gpt-5-high-new-system-prompt",
        "name": "gpt-5-high-new-system-prompt (openai)"
    },
    {
        "id": "gpt-5-high-no-system-prompt",
        "name": "gpt-5-high-no-system-prompt"
    },
    {
        "id": "gpt-5-medium",
        "name": "gpt-5-medium (openai)"
    },
    {
        "id": "gpt-5-mini-high",
        "name": "gpt-5-mini-high (openai)"
    },
    {
        "id": "gpt-5-nano-high",
        "name": "gpt-5-nano-high (openai)"
    },
    {
        "id": "gpt-5.1",
        "name": "gpt-5.1 (openai)"
    },
    {
        "id": "gpt-5.1-high",
        "name": "gpt-5.1-high (openai)"
    },
    {
        "id": "gpt-5.1-medium",
        "name": "gpt-5.1-medium (openai)"
    },
    {
        "id": "gpt-5.2",
        "name": "gpt-5.2"
    },
    {
        "id": "gpt-5.2-chat-latest",
        "name": "gpt-5.2-chat-latest (openai)"
    },
    {
        "id": "gpt-5.2-high",
        "name": "gpt-5.2-high (openai)"
    },
    {
        "id": "gpt-5.3-chat-latest",
        "name": "gpt-5.3-chat-latest (openai)"
    },
    {
        "id": "gpt-5.4",
        "name": "gpt-5.4"
    },
    {
        "id": "gpt-5.4-high",
        "name": "gpt-5.4-high"
    },
    {
        "id": "gpt-5.4-medium",
        "name": "gpt-5.4-medium"
    },
    {
        "id": "gpt-5.4-no-system-prompt",
        "name": "gpt-5.4-no-system-prompt"
    },
    {
        "id": "gpt-5.5-instant",
        "name": "gpt-5.5-instant (openaiResponses)"
    },
    {
        "id": "gpt-oss-120b",
        "name": "gpt-oss-120b (fireworks)"
    },
    {
        "id": "gpt-oss-20b",
        "name": "gpt-oss-20b (fireworks)"
    },
    // Grok Models
    {
        "id": "grok-3-mini-beta",
        "name": "grok-3-mini-beta (xaiPublic)"
    },
    {
        "id": "grok-3-mini-high",
        "name": "grok-3-mini-high (xaiPublic)"
    },
    {
        "id": "grok-4.20-beta-0309-reasoning",
        "name": "grok-4.20-beta-0309-reasoning (xaiApi)"
    },
    {
        "id": "grok-4.20-beta1",
        "name": "grok-4.20-beta1 (xaiApi)"
    },
    {
        "id": "grok-4.20-multi-agent-beta-0309",
        "name": "grok-4.20-multi-agent-beta-0309 (xaiMultiAgent)"
    },
    {
        "id": "grok-4.3",
        "name": "grok-4.3 (xaiApi)"
    },
    {
        "id": "grok-4.3-high",
        "name": "grok-4.3-high"
    },
    {
        "id": "grok-build-0.1",
        "name": "grok-build-0.1 (xaiPublic)"
    },
    // Hailuo Models
    {
        "id": "hailuo-02-fast",
        "name": "hailuo-02-fast (fal)"
    },
    {
        "id": "hailuo-02-pro",
        "name": "hailuo-02-pro (fal)"
    },
    {
        "id": "hailuo-02-standard",
        "name": "hailuo-02-standard (fal)"
    },
    {
        "id": "hailuo-2.3",
        "name": "hailuo-2.3 (minimax)"
    },
    {
        "id": "hailuo-2.3-fast",
        "name": "hailuo-2.3-fast (minimax)"
    },
    // Kimi Models
    {
        "id": "kimi-k2-0711-preview",
        "name": "kimi-k2-0711-preview (moonshot)"
    },
    {
        "id": "kimi-k2-0905-preview",
        "name": "kimi-k2-0905-preview (moonshot)"
    },
    {
        "id": "kimi-k2-thinking-turbo",
        "name": "kimi-k2-thinking-turbo (moonshot)"
    },
    {
        "id": "kimi-k2.5-instant",
        "name": "kimi-k2.5-instant (moonshot)"
    },
    {
        "id": "kimi-k2.5",
        "name": "kimi-k2.5-thinking (moonshot)"
    },
    {
        "id": "kimi-k2.6",
        "name": "kimi-k2.6"
    },
    {
        "id": "kimi-k2.7-code",
        "name": "kimi-k2.7-code"
    },
    {
        "id": "Max",
        "name": "Max (boss-bandit)"
    },
    // Mimo Models
    {
        "id": "mimo-v2-flash",
        "name": "mimo-v2-flash (xiaomiV1)"
    },
    {
        "id": "mimo-v2-flash (thinking)",
        "name": "mimo-v2-flash (thinking) (xiaomiV1)"
    },
    {
        "id": "mimo-v2-omni",
        "name": "mimo-v2-omni (xiaomiV1)"
    },
    {
        "id": "mimo-v2-pro",
        "name": "mimo-v2-pro (xiaomiV1)"
    },
    {
        "id": "mimo-v2.5",
        "name": "mimo-v2.5 (xiaomiV1)"
    },
    {
        "id": "mimo-v2.5-pro",
        "name": "mimo-v2.5-pro (xiaomiV1)"
    },
    // Minimax Models
    {
        "id": "minimax-m1",
        "name": "minimax-m1 (minimax)"
    },
    {
        "id": "minimax-m2",
        "name": "minimax-m2 (minimax)"
    },
    {
        "id": "minimax-m2-preview",
        "name": "minimax-m2-preview (minimax)"
    },
    {
        "id": "minimax-m2.1-preview",
        "name": "minimax-m2.1-preview (minimaxAnthropic)"
    },
    {
        "id": "minimax-m2.5",
        "name": "minimax-m2.5 (minimaxAnthropic)"
    },
    {
        "id": "deep-octo",
        "name": "minimax-m2.7 (minimaxAnthropic)"
    },
    {
        "id": "minimax-m2.7",
        "name": "minimax-m2.7"
    },
    {
        "id": "minimax-m3",
        "name": "minimax-m3"
    },
    // Qwen Models
    {
        "id": "qwen-vl-max-2025-08-13",
        "name": "qwen-vl-max-2025-08-13 (alibaba)"
    },
    {
        "id": "qwen3-235b-a22b",
        "name": "qwen3-235b-a22b (alibaba)"
    },
    {
        "id": "qwen3-235b-a22b-instruct-2507",
        "name": "qwen3-235b-a22b-instruct-2507 (alibaba)"
    },
    {
        "id": "qwen3-235b-a22b-no-thinking",
        "name": "qwen3-235b-a22b-no-thinking (alibaba)"
    },
    {
        "id": "qwen3-235b-a22b-thinking-2507",
        "name": "qwen3-235b-a22b-thinking-2507 (alibaba)"
    },
    {
        "id": "qwen3-30b-a3b",
        "name": "qwen3-30b-a3b (alibaba)"
    },
    {
        "id": "qwen3-30b-a3b-instruct-2507",
        "name": "qwen3-30b-a3b-instruct-2507 (alibaba)"
    },
    {
        "id": "qwen3-coder-480b-a35b-instruct",
        "name": "qwen3-coder-480b-a35b-instruct (alibaba)"
    },
    {
        "id": "qwen3-max-2025-09-23",
        "name": "qwen3-max-2025-09-23 (alibaba)"
    },
    {
        "id": "qwen3-max-2025-09-26",
        "name": "qwen3-max-2025-09-26 (alibaba)"
    },
    {
        "id": "qwen3-max-2025-10-30",
        "name": "qwen3-max-2025-10-30"
    },
    {
        "id": "qwen3-max-preview",
        "name": "qwen3-max-preview (alibaba)"
    },
    {
        "id": "qwen3-max-thinking",
        "name": "qwen3-max-thinking (alibaba)"
    },
    {
        "id": "qwen3-next-80b-a3b-instruct",
        "name": "qwen3-next-80b-a3b-instruct (alibaba)"
    },
    {
        "id": "qwen3-next-80b-a3b-thinking",
        "name": "qwen3-next-80b-a3b-thinking (alibaba)"
    },
    {
        "id": "qwen3-omni-flash",
        "name": "qwen3-omni-flash (alibaba)"
    },
    {
        "id": "qwen3-vl-235b-a22b-instruct",
        "name": "qwen3-vl-235b-a22b-instruct (alibaba)"
    },
    {
        "id": "qwen3-vl-235b-a22b-thinking",
        "name": "qwen3-vl-235b-a22b-thinking (alibaba)"
    },
    {
        "id": "qwen3-vl-8b-instruct",
        "name": "qwen3-vl-8b-instruct (alibaba)"
    },
    {
        "id": "qwen3-vl-8b-thinking",
        "name": "qwen3-vl-8b-thinking (alibaba)"
    },
    {
        "id": "qwen3.5-122b-a10b",
        "name": "qwen3.5-122b-a10b (alibaba)"
    },
    {
        "id": "qwen3.5-122b-a10b-code",
        "name": "qwen3.5-122b-a10b-code (alibaba)"
    },
    {
        "id": "qwen3.5-27b",
        "name": "qwen3.5-27b (alibaba)"
    },
    {
        "id": "qwen3.5-27b-code",
        "name": "qwen3.5-27b-code (alibaba)"
    },
    {
        "id": "qwen3.5-35b-a3b",
        "name": "qwen3.5-35b-a3b (alibaba)"
    },
    {
        "id": "qwen3.5-35b-a3b-code",
        "name": "qwen3.5-35b-a3b-code (alibaba)"
    },
    {
        "id": "qwen3.5-397b-a17b",
        "name": "qwen3.5-397b-a17b (alibaba)"
    },
    {
        "id": "qwen3.5-flash",
        "name": "qwen3.5-flash (alibaba)"
    },
    {
        "id": "kiteki",
        "name": "qwen3.5-max-preview (alibaba)"
    },
    {
        "id": "qwen3.6-27b",
        "name": "qwen3.6-27b (alibaba)"
    },
    {
        "id": "kizen-alpha",
        "name": "qwen3.6-max-preview (alibaba)"
    },
    {
        "id": "qwen3.6-max-preview",
        "name": "qwen3.6-max-preview (alibabaToolCall)"
    },
    {
        "id": "qwen3.6-plus",
        "name": "qwen3.6-plus"
    },
    {
        "id": "qwen3.6-plus-preview",
        "name": "qwen3.6-plus-preview (alibaba)"
    },
    {
        "id": "qwen3.7-max",
        "name": "qwen3.7-max (alibaba)"
    },
    {
        "id": "korin",
        "name": "qwen3.7-max-20260517 (alibabaToolCall)"
    },
    {
        "id": "melyora",
        "name": "qwen3.7-max-preview (alibaba)"
    },
    {
        "id": "qwen3.7-plus",
        "name": "qwen3.7-plus (alibaba)"
    },
    {
        "id": "may-alpha",
        "name": "qwen3.7-plus-preview (alibaba)"
    },
    {
        "id": "qwq-32b",
        "name": "qwq-32b (alibaba)"
    },
    // Codex Models
    {
        "id": "gpt-5.1-codex",
        "name": "gpt-5.1-codex (openaiResponses)"
    },
    {
        "id": "gpt-5.1-codex-max",
        "name": "gpt-5.1-codex-max (openaiResponses)"
    },
    {
        "id": "gpt-5.1-codex-mini",
        "name": "gpt-5.1-codex-mini (openaiResponses)"
    },
    {
        "id": "gpt-5.2-codex",
        "name": "gpt-5.2-codex (openaiResponses)"
    },
    {
        "id": "gpt-5.3-codex",
        "name": "gpt-5.3-codex (openaiResponsesWithPhase)"
    },
    // Search Models
    {
        "id": "claude-sonnet-4-5-search",
        "name": "claude-sonnet-4-5-search (anthropicSearch)"
    },
    {
        "id": "claude-sonnet-4-6-search",
        "name": "claude-sonnet-4-6-search (anthropicSearch)"
    },
    {
        "id": "gpt-5-search",
        "name": "gpt-5-search (openaiResponses)"
    },
    {
        "id": "gpt-5.1-search",
        "name": "gpt-5.1-search (openaiResponses)"
    },
    {
        "id": "gpt-5.1-search-sp",
        "name": "gpt-5.1-search-sp (openaiResponses)"
    },
    {
        "id": "gpt-5.2-search",
        "name": "gpt-5.2-search (openaiResponses)"
    },
    {
        "id": "gpt-5.2-search-non-reasoning",
        "name": "gpt-5.2-search-non-reasoning (openaiResponses)"
    },
    {
        "id": "grok-4-1-fast-search",
        "name": "grok-4-1-fast-search (xaiResponsesSearch)"
    },
    {
        "id": "grok-4-search",
        "name": "grok-4-search (xaiSearch)"
    },
    // Image Models
    {
        "id": "flux-1-kontext-max",
        "name": "flux-1-kontext-max"
    },
    {
        "id": "gemini-2.5-flash-image-preview (nano-banana)",
        "name": "gemini-2.5-flash-image-preview (nano-banana) (google-genai)"
    },
    {
        "id": "gpt-image-1",
        "name": "gpt-image-1 (customOpenai)"
    },
    {
        "id": "gpt-image-1-high-fidelity",
        "name": "gpt-image-1-high-fidelity"
    },
    {
        "id": "gpt-image-2 (medium)",
        "name": "gpt-image-2 (medium)"
    },
    {
        "id": "grok-imagine-image",
        "name": "grok-imagine-image (xaiImage)"
    },
    {
        "id": "grok-imagine-image-quality",
        "name": "grok-imagine-image-quality (xaiImage)"
    },
    {
        "id": "blue-crab",
        "name": "grok-imagine-image-quality (20260519) (xaiImage)"
    },
    {
        "id": "imagen-3.0-generate-002",
        "name": "imagen-3.0-generate-002 (googleVertex)"
    },
    {
        "id": "imagen-4.0-fast-generate-001",
        "name": "imagen-4.0-fast-generate-001 (googleVertex)"
    },
    {
        "id": "imagen-4.0-generate-001",
        "name": "imagen-4.0-generate-001 (googleVertex)"
    },
    {
        "id": "imagen-4.0-ultra-generate-001",
        "name": "imagen-4.0-ultra-generate-001 (googleVertex)"
    },
    {
        "id": "qwen-image-2.0",
        "name": "qwen-image-2.0 (alibaba)"
    },
    {
        "id": "qwen-image-2.0-pro",
        "name": "qwen-image-2.0-pro (alibaba)"
    },
    {
        "id": "qwen-image-2512",
        "name": "qwen-image-2512 (alibaba)"
    },
    {
        "id": "qwen-image-edit",
        "name": "qwen-image-edit (alibaba)"
    },
    {
        "id": "qwen-image-edit-2511",
        "name": "qwen-image-edit-2511 (alibaba)"
    },
    {
        "id": "uni-1.1-max",
        "name": "uni-1.1-max (lumaImagePublic)"
    },
    // Video Models
    {
        "id": "grok-imagine-video",
        "name": "grok-imagine-video (xai)"
    },
    {
        "id": "grok-imagine-video-1.5-preview-720p",
        "name": "grok-imagine-video-1.5-preview-720p (xai)"
    },
    {
        "id": "veo-2",
        "name": "veo-2 (googleVertex)"
    },
    {
        "id": "veo-3.1-audio",
        "name": "veo-3.1-audio (googleVertex)"
    },
    {
        "id": "veo-3.1-audio-1080p",
        "name": "veo-3.1-audio-1080p (googleVertex)"
    },
    {
        "id": "veo-3.1-audio-4k",
        "name": "veo-3.1-audio-4k (googleVertex)"
    },
    {
        "id": "veo-3.1-fast-audio",
        "name": "veo-3.1-fast-audio (googleVertex)"
    },
    {
        "id": "veo-3.1-fast-audio-1080p",
        "name": "veo-3.1-fast-audio-1080p (googleVertex)"
    },
    {
        "id": "veo-3.1-fast-audio-4k",
        "name": "veo-3.1-fast-audio-4k (googleVertex)"
    }
],
  oauth: {
    baseUrl: "https://arena.ai",
    fakeHeaders: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://arena.ai/",
      "Origin": "https://arena.ai",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
    },
    captureConfig: {
      loginUrl: "https://arena.ai/?mode=direct",
      cdpPort: 9222,
      timeout: 300000,
      pollInterval: 2000,
    },
  },
  features: {
    usage: false,
  },
};

const ARENA_MEDIA_GROUPS = {
  Search: "webSearch",
  Image: "image",
  Video: "video",
};

function getArenaModelGroup(model) {
  const id = model.id.toLowerCase();
  const name = model.name.toLowerCase();

  if (id.includes("search") || id.includes("grounding")) return "Search";
  if (id.includes("image") || id.includes("imagen") || id.includes("flux-") || id === "blue-crab" || id === "uni-1.1-max") return "Image";
  if (id.includes("video") || id.startsWith("veo-") || id.startsWith("hailuo-")) return "Video";
  if (id.startsWith("claude-")) return "Claude";
  if (id.includes("codex")) return "Codex";
  if (id.startsWith("gpt-") || name.includes("(openai)")) return "OpenAI";
  if (id.startsWith("gemini-") || id.startsWith("gemma-") || id === "significant-otter" || id === "pteronura") return "Gemini / Gemma";
  if (id.startsWith("deepseek-")) return "DeepSeek";
  if (id.startsWith("glm-")) return "GLM";
  if (id.startsWith("grok-")) return "Grok";
  if (id.startsWith("kimi-") || id === "max") return "Kimi";
  if (id.startsWith("mimo-")) return "MiMo";
  if (id.startsWith("minimax-") || id === "deep-octo") return "MiniMax";
  if (id.startsWith("qwen") || id.startsWith("qwq-") || ["kiteki", "kizen-alpha", "korin", "melyora", "may-alpha"].includes(id)) return "Qwen";
  return "Other";
}

arenaProvider.models = arenaProvider.models.map((model) => {
  const group = getArenaModelGroup(model);
  return {
    ...model,
    group,
    ...(ARENA_MEDIA_GROUPS[group] ? { kind: ARENA_MEDIA_GROUPS[group] } : {}),
  };
});

export default arenaProvider;
