import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { DefaultExecutor } from "./default.js";
import { sanitizeHeaders } from "../utils/headerSanitizer.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";
import arenaProvider from "../providers/registry/arena.js";

const execAsync = promisify(exec);

/**
 * ArenaExecutor - Handles arena.ai nextjs-api evaluation stream endpoints.
 * Transforms between OpenAI format and Arena's custom upstream API.
 */
export class ArenaExecutor extends DefaultExecutor {
  constructor() {
    super("arena");
    this.cachedModels = null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Generates a standard-compliant UUIDv7
   */
  uuid7() {
    const now = Date.now();
    const ts = now.toString(16).padStart(12, "0");
    
    const r1 = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, "0");
    const r2 = (Math.floor(Math.random() * 0x4000) | 0x8000).toString(16);
    const r3 = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
    const r4 = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
    
    // Format: 8-4-4-4-12
    return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${r1}-${r2}-${r3}${r4}`;
  }

  /**
   * Reads LMArena models mapping from the local filesytem D:\arena_ai\models.json
   */
  getModelId(publicName) {
    if (!this.cachedModels) {
      try {
        const modelsPath = ["D:", "arena_ai", "models.json"].join("/");
        const data = fs.readFileSync(modelsPath, "utf8");
        this.cachedModels = JSON.parse(data);
      } catch (e) {
        console.error("[ArenaExecutor] Failed to read models.json from D:/arena_ai/models.json:", e);
        this.cachedModels = [];
      }
    }
    const found = this.cachedModels.find(
      (m) => m.publicName === publicName || m.name === publicName || m.id === publicName
    );
    return found ? found.id : publicName;
  }

  resolveChatId(body, credentials) {
    const candidates = [
      body?.arenaChatId,
      body?.arena_chat_id,
      body?.chatId,
      body?.conversationId,
      body?.providerSpecificData?.arenaChatId,
      body?.providerSpecificData?.arena_chat_id,
      credentials?.providerSpecificData?.arenaChatId,
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  }

  mergeMessagesToUserContent(messages) {
    let systemContent = "";
    let userContent = "";

    for (const msg of messages || []) {
      if (!msg) continue;
      let content = "";
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((p) => p && p.type === "text" && typeof p.text === "string")
          .map((p) => p.text);
        content = textParts.join("\n");
      }
      if (!content) continue;

      if (msg.role === "system") {
        systemContent += (systemContent ? "\n\n" : "") + content;
      } else if (msg.role === "user") {
        userContent = content; // last user message wins
      }
    }

    if (systemContent) {
      userContent = `${systemContent}\n\nUser: ${userContent}`;
    }

    return userContent;
  }

  /**
   * Extracts the raw cookie string from credentials.
   * credentials.cookies may be stored as:
   *   - a raw cookie header string: "cf_clearance=abc; arena-auth-prod-v1=xyz"
   *   - or providerSpecificData.cookies
   */
  extractCookies(credentials) {
    // Priority: accessToken-level cookies saved during capture
    const raw =
      credentials?.cookies ||
      credentials?.providerSpecificData?.cookies ||
      "";
    return typeof raw === "string" ? raw.trim() : "";
  }

  /**
   * Build Arena-specific request headers.
   * Injects the Authorization Bearer token AND the Cookie header
   * (including cf_clearance) from the credentials captured at connect time.
   */
  buildHeaders(credentials, stream = true) {
    const baseHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://arena.ai/?mode=direct",
      "Origin": "https://arena.ai",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
    };

    // Inject Authorization
    const token = credentials?.accessToken || credentials?.apiKey || "";
    if (token) {
      baseHeaders["Authorization"] = `Bearer ${token}`;
    }

    // Dynamically inject Cookie header from saved credentials
    const cookieStr = this.extractCookies(credentials);
    if (cookieStr) {
      baseHeaders["Cookie"] = cookieStr;
    }

    if (stream) {
      baseHeaders["Accept"] = "text/event-stream";
    }

    return baseHeaders;
  }


  async transformRequest(model, body, stream, credentials, chatId) {
    const messages = body.messages || [];
    const prompt = this.mergeMessagesToUserContent(messages);
    const modelId = this.getModelId(model);

    const userMessageId = this.uuid7();
    const modelAMessageId = this.uuid7();

    const registryModel = arenaProvider.models.find(
      (m) => m.id === model || m.name === model || modelId === m.id
    );
    const group = registryModel?.group || "";
    const kind = registryModel?.kind || "";

    let modality = "chat";
    const lowerModelId = modelId.toLowerCase();
    if (
      group === "Image" ||
      kind === "image" ||
      lowerModelId.includes("image") ||
      lowerModelId.includes("imagen") ||
      lowerModelId.includes("flux") ||
      lowerModelId.includes("seedream") ||
      lowerModelId.includes("autumn") ||
      lowerModelId.includes("wan2.7") ||
      lowerModelId.includes("instant-ramen") ||
      lowerModelId.startsWith("uni-") ||
      lowerModelId === "blue-crab"
    ) {
      modality = "image";
    } else if (
      group === "Search" ||
      kind === "webSearch" ||
      lowerModelId.includes("search") ||
      lowerModelId.includes("grounding")
    ) {
      modality = "search";
    } else if (
      group === "Codex" ||
      lowerModelId.includes("codex")
    ) {
      modality = "webdev";
    }

    const payload = {
      modelAId: modelId,
      userMessageId,
      modelAMessageId,
      userMessage: {
        content: prompt,
        experimental_attachments: [],
        metadata: {},
      },
      modality,
      recaptchaV3Token: "",
    };

    if (chatId) {
      payload.id = chatId;
    } else {
      payload.id = this.uuid7();
      payload.mode = "direct-battle";
    }

    return payload;
  }


  processArenaLine(line, model) {
    let trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      trimmed = trimmed.slice(5).trim();
    }
    if (!trimmed) return null;
    if (trimmed === "[DONE]") return null;

    if (trimmed.startsWith("ag:")) {
      const chunkData = trimmed.slice(3);
      try {
        const text = JSON.parse(chunkData);
        return { type: "reasoning", content: text };
      } catch (e) {
        return null;
      }
    }

    if (trimmed.startsWith("a0:")) {
      const chunkData = trimmed.slice(3);
      try {
        const text = JSON.parse(chunkData);
        return { type: "content", content: text };
      } catch (e) {
        return null;
      }
    }

    if (trimmed.startsWith("a2:")) {
      const chunkData = trimmed.slice(3);
      try {
        const arr = JSON.parse(chunkData);
        if (Array.isArray(arr)) {
          let content = "";
          for (const item of arr) {
            if (item.type === "image") {
              content += `\n![Generated Image](${item.image})\n`;
            } else if (item.type === "webdev" && item.event) {
              const ev = item.event;
              if (ev.type === "init" && Array.isArray(ev.files)) {
                content += `\n### Initialize Web App files:\n`;
                for (const f of ev.files) {
                  content += `\n**File: \`${f.path}\`**\n\`\`\`${f.contentType || ""}\n${f.content}\n\`\`\`\n`;
                }
              } else if (ev.type === "title") {
                content += `\n**App Title**: ${ev.title}\n`;
              }
            }
          }
          if (content) {
            return { type: "content", content };
          }
        }
      } catch (e) {
        return null;
      }
    }

    if (trimmed.startsWith("ac:")) {
      const chunkData = trimmed.slice(3);
      try {
        const obj = JSON.parse(chunkData);
        if (obj.toolCallId === "citation-source" && obj.argsTextDelta) {
          const delta = JSON.parse(obj.argsTextDelta);
          if (delta.source) {
            const s = delta.source;
            const citation = `\n[^${s.id}]: [${s.title || s.url}](${s.url})\n`;
            return { type: "content", content: citation };
          }
        }
      } catch (e) {
        return null;
      }
    }

    if (trimmed.startsWith("ad:")) {
      const chunkData = trimmed.slice(3);
      try {
        const metadata = JSON.parse(chunkData);
        const finishReason = metadata.finishReason || "stop";
        return { type: "finish", finishReason };
      } catch (e) {
        return null;
      }
    }

    if (trimmed.startsWith("{")) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj.choices && obj.choices[0]) {
          const delta = obj.choices[0].delta || {};
          if (delta.reasoning_content) {
            return { type: "reasoning", content: delta.reasoning_content };
          }
          if (delta.content) {
            return { type: "content", content: delta.content };
          }
        }
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  formatOpenAIChunk(event, model, chunkId) {
    if (event.type === "reasoning") {
      const chunk = {
        id: chunkId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          delta: { reasoning_content: event.content },
          finish_reason: null,
        }],
      };
      return `data: ${JSON.stringify(chunk)}\n\n`;
    }

    if (event.type === "content") {
      const chunk = {
        id: chunkId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          delta: { content: event.content },
          finish_reason: null,
        }],
      };
      return `data: ${JSON.stringify(chunk)}\n\n`;
    }

    if (event.type === "finish") {
      const chunk = {
        id: chunkId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: event.finishReason || "stop",
        }],
      };
      return `data: ${JSON.stringify(chunk)}\n\n`;
    }

    return null;
  }

  async getRecaptchaToken() {
    try {
      const { stdout } = await execAsync("python c:/Users/admin/tailieu_hou/9router/scratch/get_recaptcha_token.py");
      const match = stdout.match(/TOKEN_START\r?\n([\s\S]*?)\r?\nTOKEN_END/);
      if (match && match[1]) {
        return match[1].trim();
      }
      console.error("[ArenaExecutor] Failed to parse recaptcha token from output:", stdout);
      return "";
    } catch (e) {
      console.error("[ArenaExecutor] Error fetching recaptcha token:", e);
      return "";
    }
  }

  async execute({ model, body, stream, credentials, signal, log, proxyOptions = null }) {
    try {
      const existingChatId = this.resolveChatId(body, credentials);
      const url = existingChatId
        ? `https://arena.ai/nextjs-api/stream/post-to-evaluation/${existingChatId}`
        : `https://arena.ai/nextjs-api/stream/create-evaluation`;

      const headers = this.buildHeaders(credentials, true);
      headers["Content-Type"] = "text/plain;charset=UTF-8";

      for (let attempt = 0; attempt < 3; attempt++) {
        const transformedBody = await this.transformRequest(model, body, stream, credentials, existingChatId);
        const recaptchaToken = await this.getRecaptchaToken();
        transformedBody.recaptchaV3Token = recaptchaToken;
        const chatId = transformedBody.id;

        console.log("[ArenaExecutor Debug] Url:", url);
        console.log("[ArenaExecutor Debug] Headers:", JSON.stringify(headers, null, 2));
        console.log("[ArenaExecutor Debug] Body:", JSON.stringify(transformedBody, null, 2));

        const response = await proxyAwareFetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(transformedBody),
          signal,
        }, proxyOptions);

        if (!response.ok) {
          const errorText = await response.text();
          const recaptchaFailed = response.status === 403 && /recaptcha validation failed/i.test(errorText);
          if (recaptchaFailed && attempt < 2) {
            console.warn(`[ArenaExecutor] reCAPTCHA rejected on attempt ${attempt + 1}, retrying with a fresh token.`);
            continue;
          }
          // Preserve the original error text for proper rate limit detection
          const error = new Error(errorText);
          error.status = response.status;
          throw error;
        }

        if (!stream || body.stream === false) {
          return await this.handleNonStreamingResponse(response, model, url, headers, transformedBody, chatId);
        }

        const webStream = await this.transformResponseStream(response.body, model, chatId);

        return {
          response: new Response(webStream, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          }),
          url,
          headers,
          transformedBody,
          sessionChatId: chatId,
          sessionMessageId: null,
        };
      }

      throw new Error("Arena API error: reCAPTCHA validation failed after 3 attempts");
    } catch (error) {
      if (error.name === "AbortError") throw error;
      // Preserve the original error with status code for proper rate limit handling
      throw error;
    }
  }


  async handleNonStreamingResponse(response, model, url, headers, transformedBody, chatId) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let reasoningText = "";
    let buffer = "";
    const chunkId = `chatcmpl-${this.uuid7()}`;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const event = this.processArenaLine(line, model);
          if (!event) continue;
          if (event.type === "reasoning") {
            reasoningText += event.content;
          } else if (event.type === "content") {
            fullContent += event.content;
          }
        }
      }

      if (buffer.trim()) {
        const event = this.processArenaLine(buffer, model);
        if (event) {
          if (event.type === "reasoning") {
            reasoningText += event.content;
          } else if (event.type === "content") {
            fullContent += event.content;
          }
        }
      }
    } catch (error) {
      throw new Error(`Arena non-stream error: ${error.message}`);
    }

    const completionResponse = {
      id: chunkId,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: fullContent,
          reasoning_content: reasoningText || undefined,
        },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    return {
      response: new Response(JSON.stringify(completionResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      url,
      headers,
      transformedBody,
      sessionChatId: chatId,
      sessionMessageId: null,
    };
  }

  async transformResponseStream(inputStream, model, chatId) {
    const reader = inputStream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const self = this;
    let buffer = "";
    const chunkId = `chatcmpl-${this.uuid7()}`;

    return new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();

          if (done) {
            if (buffer.trim()) {
              const event = self.processArenaLine(buffer, model);
              if (event) {
                const chunk = self.formatOpenAIChunk(event, model, chunkId);
                if (chunk) controller.enqueue(encoder.encode(chunk));
              }
            }
            const finalChunk = {
              id: chunkId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: model,
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const event = self.processArenaLine(line, model);
            if (event) {
              const chunk = self.formatOpenAIChunk(event, model, chunkId);
              if (chunk) {
                controller.enqueue(encoder.encode(chunk));
              }
            }
          }
        } catch (err) {
          console.error("[Arena] Stream pull error:", err);
          controller.error(err);
        }
      },

      cancel() {
        reader.cancel().catch(() => {});
      },
    });
  }
}

export default ArenaExecutor;
