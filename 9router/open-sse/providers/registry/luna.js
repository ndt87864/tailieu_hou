export default {
  id: "luna",
  priority: 135,
  alias: "ln",
  uiAlias: "ln",
  display: {
    name: "Luna (Qwen Capture)",
    icon: "capture",
    color: "#8B5CF6",
    website: "https://chat.qwen.ai",
    notice: {
      signupUrl: "https://chat.qwen.ai",
    },
  },
  category: "oauth",
  serviceKinds: ["llm", "image", "video", "webSearch", "imageToText"],
  imageConfig: { baseUrl: "https://chat.qwen.ai/api/v2/chat/completions" },
  videoConfig: { baseUrl: "https://chat.qwen.ai/api/v2/chat/completions" },
  searchViaChat: {
    defaultModel: "qwen3.7-plus"
  },
  transport: {
    baseUrl: "https://portal.qwen.ai/v1/chat/completions",
  },
  models: [
    { id: "qwen3.8-max-preview", name: "Qwen 3.8 Max Preview" },
    { id: "qwen3.7-plus", name: "Qwen 3.7 Plus" },
    { id: "qwen3.7-max", name: "Qwen 3.7 Max" },
    { id: "qwen3.6-plus", name: "Qwen 3.6 Plus" },
    { id: "qwen3.6-max", name: "Qwen 3.6 Max" },
    { id: "qwen-latest-series-invite-beta-v16", name: "Qwen 3.7 Plus (Beta)" },
    { id: "qwen3.5-plus", name: "Qwen 3.5 Plus" },
    { id: "qwen3.5-flash", name: "Qwen 3.5 Flash" },
  ],
  oauth: {
    clientId: "f0304373b74a44d2b584a3fb70ca9e56",
    deviceCodeUrl: "https://chat.qwen.ai/api/v1/oauth2/device/code",
    tokenUrl: "https://chat.qwen.ai/api/v1/oauth2/token",
    scope: "openid profile email model.completion",
    codeChallengeMethod: "S256",
    refreshLeadMs: 1200000,
    baseUrl: "https://chat.qwen.ai",
    fakeHeaders: {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Ch-Ua": '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
    },
    captureConfig: {
      loginUrl: "https://chat.qwen.ai",
      cdpPort: 9222,
      timeout: 300000,
      pollInterval: 1000,
      localStorageTokenKey: "token",
    },
  },
  features: {
    usage: false,
  },
};
