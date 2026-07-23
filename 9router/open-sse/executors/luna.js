import { DefaultExecutor } from "./default.js";
import { sanitizeHeaders } from "../utils/headerSanitizer.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";

/**
 * LunaExecutor - Handles chat.qwen.ai custom API format
 * Transforms between OpenAI format and Qwen's internal web chat API.
 * Protocol reference: D:\\ai_video\\luna-proxy\\src\\main\\proxy\\adapters\\qwen-ai.ts
 */
export class LunaExecutor extends DefaultExecutor {
  constructor() {
    super("luna");
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    return "https://chat.qwen.ai/api/v2/chat/completions";
  }

  resolveCookies(credentials) {
    const token = credentials?.apiKey || credentials?.accessToken || "";
    const rawCookies = credentials?.providerSpecificData?.cookies || "";
    const cookies = typeof rawCookies === "string" ? rawCookies.trim() : "";
    if (!token) return cookies;
    const hasTokenCookie = cookies
      .split(";")
      .map((part) => part.trim().toLowerCase())
      .some((part) => part.startsWith("token="));
    if (hasTokenCookie) return cookies;
    return cookies ? `token=${token}; ${cookies}` : `token=${token}`;
  }

  buildHeaders(credentials, stream = true, chatId = null) {
    const token = credentials?.apiKey || credentials?.accessToken || "";
    const cookies = this.resolveCookies(credentials);

    const headers = {
      "Content-Type": "application/json",
      "Accept": stream ? "text/event-stream" : "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Authorization": `Bearer ${token}`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Chromium";v="131", "Google Chrome";v="131", "Not/A)Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "source": "web",
      "Origin": "https://chat.qwen.ai",
      "Referer": chatId
        ? `https://chat.qwen.ai/c/${chatId}`
        : "https://chat.qwen.ai/",
      "X-Request-Id": this.uuid(),
      "Timezone": new Date().toString(),
      "Version": "0.2.50",
      "bx-v": "2.5.36",
      "x-accel-buffering": "no",
    };

    if (cookies) {
      headers["Cookie"] = cookies;
    } else {
      console.warn(
        "[Luna] Warning: No cookies provided. This may cause Bad_Request error.",
      );
    }

    return sanitizeHeaders(headers);
  }

  resolveChatId(body, credentials) {
    const candidates = [
      body?.lunaChatId,
      body?.luna_chat_id,
      body?.reportChatId,
      body?.report_chat_id,
      body?.providerSpecificData?.lunaChatId,
      body?.providerSpecificData?.luna_chat_id,
      body?.providerSpecificData?.reportChatId,
      credentials?.providerSpecificData?.lunaChatId,
      credentials?.providerSpecificData?.luna_chat_id,
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  resolveParentMessageId(body, credentials) {
    const candidates = [
      body?.lunaParentMessageId,
      body?.luna_parent_message_id,
      body?.reportParentMessageId,
      body?.report_parent_message_id,
      body?.providerSpecificData?.lunaParentMessageId,
      body?.providerSpecificData?.luna_parent_message_id,
      body?.providerSpecificData?.reportParentMessageId,
      credentials?.providerSpecificData?.lunaParentMessageId,
      credentials?.providerSpecificData?.luna_parent_message_id,
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  /**
   * Transform OpenAI messages into the single user-content string Qwen web expects.
   * Reference: qwen-ai.ts chatCompletion() message merging logic.
   */
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
        userContent = content; // last user message wins (single-turn)
      }
    }

    if (systemContent) {
      userContent = `${systemContent}\n\nUser: ${userContent}`;
    }

    return userContent;
  }

  transformRequest(model, body, stream, credentials, chatId, parentMessageId = null) {
    const messages = body.messages || [];
    const userContent = this.mergeMessagesToUserContent(messages);

    // Strip custom prefixes like "ln/" or "luna/"
    let cleanModel = model || "";
    if (cleanModel.startsWith("ln/")) {
      cleanModel = cleanModel.slice(3);
    } else if (cleanModel.startsWith("luna/")) {
      cleanModel = cleanModel.slice(5);
    }
    if (cleanModel.toLowerCase() === "qwen-3.7-plus") {
      cleanModel = "qwen3.7-plus";
    }

    const fid = this.uuid();
    const childId = this.uuid();
    const requestId = this.uuid();
    const ts = Math.floor(Date.now() / 1000);

    // Determine thinking mode from model name / request flags
    const modelLower = cleanModel.toLowerCase();
    const explicitThinkingMode = String(
      body.thinking_mode ||
        body.thinkingMode ||
        body.qwen_thinking_mode ||
        body.qwenThinkingMode ||
        "",
    ).toLowerCase();
    const reasoningEffort = String(
      body.reasoning_effort ||
        body.reasoning?.effort ||
        body.reasoningEffort ||
        "",
    ).toLowerCase();
    const requestedEnableThinking =
      typeof body.enable_thinking === "boolean"
        ? body.enable_thinking
        : typeof body.enableThinking === "boolean"
          ? body.enableThinking
          : undefined;

    let qwenThinkingMode = "Fast";
    if (explicitThinkingMode === "auto" || reasoningEffort === "auto") {
      qwenThinkingMode = "Auto";
    } else if (
      explicitThinkingMode === "thinking" ||
      explicitThinkingMode === "think" ||
      explicitThinkingMode === "on" ||
      ["low", "medium", "high", "xhigh", "max"].includes(reasoningEffort)
    ) {
      qwenThinkingMode = "Thinking";
    } else if (
      explicitThinkingMode === "fast" ||
      explicitThinkingMode === "off" ||
      explicitThinkingMode === "none" ||
      ["none", "minimal", "fast"].includes(reasoningEffort)
    ) {
      qwenThinkingMode = "Fast";
    } else if (
      requestedEnableThinking === true ||
      modelLower.includes("think") ||
      modelLower.includes("reason") ||
      modelLower.includes("r1")
    ) {
      qwenThinkingMode = "Thinking";
    } else if (requestedEnableThinking === false) {
      qwenThinkingMode = "Fast";
    }

    if (modelLower.includes("qwen3.7-plus") || modelLower.includes("invite-beta")) {
      qwenThinkingMode = "Fast";
    }

    if (modelLower.includes("3.8") || modelLower.includes("qwen3.8") || modelLower.includes("qwen-3.8")) {
      qwenThinkingMode = "Thinking";
    }

    const shouldEnableThinking = qwenThinkingMode !== "Fast";
    const shouldAutoThink = qwenThinkingMode === "Auto";

    const featureConfig = {
      thinking_enabled: shouldEnableThinking,
      output_schema: "phase",
      research_mode: "normal",
      auto_thinking: shouldAutoThink,
      thinking_mode: qwenThinkingMode,
      thinking_format: "summary",
      auto_search: body.auto_search !== false && body.enable_search !== false,
    };

    if (body.thinking_budget) {
      featureConfig.thinking_budget = body.thinking_budget;
    }

    const chatType = body.chat_type || body.chatType || "t2t";
    const subChatType = body.sub_chat_type || body.subChatType || chatType;
    const size = body.size || (chatType === "t2i" ? "16:9" : undefined);

    const qwenRequest = {
      request_id: requestId,
      stream: true,
      version: "2.1",
      incremental_output: true,
      chat_id: chatId,
      chat_mode: "normal",
      model: cleanModel,
      parent_id: parentMessageId || null,
      data: parentMessageId ? { id: parentMessageId } : undefined,
      messages: [
        {
          id: null,
          fid,
          parentId: parentMessageId || null,
          childrenIds: [childId],
          role: "user",
          content: userContent,
          user_action: "chat",
          files: [],
          timestamp: ts,
          models: [cleanModel],
          model: "",
          chat_type: chatType,
          feature_config: featureConfig,
          extra: { meta: { subChatType, size } },
          sub_chat_type: subChatType,
          parent_id: parentMessageId || null,
        },
      ],
      timestamp: ts + 1,
      file_ids: [],
      size: size,
    };

    return qwenRequest;
  }

  resolveChatTitle(body) {
    const candidates = [
      body?.lunaChatTitle,
      body?.luna_chat_title,
      body?.chatTitle,
      body?.title,
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "OpenAI_API_Chat";
  }

  extractDataLinePayload(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed.startsWith("data:")) return null;
    return trimmed.slice(5).trim();
  }

  extractQwenContentDelta(data) {
    const choice = data?.choices?.[0];
    const delta = choice?.delta || {};
    const content = typeof delta.content === "string" ? delta.content : "";
    const phase = delta.phase;
    const status = delta.status;
    const summaryParts = delta.extra?.summary_thought?.content;
    const summary = Array.isArray(summaryParts) ? summaryParts.join("\n") : "";
    const responseId = data?.["response.created"]?.response_id || data?.id || "";

    return { choice, delta, content, phase, status, summary, responseId };
  }

  extractAssistantContentFromMessage(msg) {
    if (!msg || msg.role !== "assistant") return null;
    if (Array.isArray(msg.content_list) && msg.content_list.length > 0) {
      const answerItem =
        msg.content_list.find((item) => (item.phase === "answer" || item.phase === "image_gen") && item.content) ||
        msg.content_list.find((item) => item.phase !== "think" && item.phase !== "thinking_summary" && item.content);
      if (answerItem?.content) return answerItem.content;
    }
    return msg.content || null;
  }

  async fetchCompletedChatContent(chatId, credentials, proxyOptions) {
    if (!chatId) return null;
    const url = `https://chat.qwen.ai/api/v2/chats/${chatId}`;
    const headers = this.buildHeaders(credentials, false, chatId);
    const res = await proxyAwareFetch(url, { method: "GET", headers }, proxyOptions);
    if (!res.ok) return null;
    const chatData = await res.json();
    const history = chatData?.data?.chat?.history;
    const messages = history?.messages || {};
    const currentId = history?.currentId;
    if (!currentId) return null;

    let targetMsg = messages[currentId];
    if (targetMsg && targetMsg.role === "user" && Array.isArray(targetMsg.childrenIds) && targetMsg.childrenIds.length > 0) {
      const lastChildId = targetMsg.childrenIds[targetMsg.childrenIds.length - 1];
      if (messages[lastChildId]) {
        targetMsg = messages[lastChildId];
      }
    }

    if (targetMsg && targetMsg.role === "assistant") {
      return this.extractAssistantContentFromMessage(targetMsg);
    }
    return null;
  }

  async createChat(model, credentials, proxyOptions, body = null) {
    const url = "https://chat.qwen.ai/api/v2/chats/new";
    const headers = this.buildHeaders(credentials, false);
    const title = this.resolveChatTitle(body);

    // Strip custom prefixes like "ln/" or "luna/"
    let cleanModel = model || "";
    if (cleanModel.startsWith("ln/")) {
      cleanModel = cleanModel.slice(3);
    } else if (cleanModel.startsWith("luna/")) {
      cleanModel = cleanModel.slice(5);
    }
    if (cleanModel.toLowerCase() === "qwen-3.7-plus") {
      cleanModel = "qwen3.7-plus";
    }

    const payload = {
      title: title,
      models: [cleanModel],
      chat_mode: "normal",
      chat_type: "t2t",
      timestamp: Date.now(),
      project_id: "",
    };

    const response = await proxyAwareFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }, proxyOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Create chat failed: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const resJson = await response.json();
    console.log("[Luna Debug] Create chat response:", JSON.stringify(resJson).slice(0, 1000));
    const chatId = this.extractChatId(resJson);
    if (chatId) {
      return chatId;
    }
    throw new Error(
      `No chat ID returned from Qwen (response keys: ${Object.keys(resJson || {}).join(", ")})`,
    );
  }

  extractChatId(resJson) {
    const candidates = [
      resJson?.data?.id,
      resJson?.data?.chat_id,
      resJson?.data?.chatId,
      resJson?.data?.chat?.id,
      resJson?.data?.conversation_id,
      resJson?.chat_id,
      resJson?.chatId,
      resJson?.id,
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  }

  /**
   * Clear user memory on chat.qwen.ai before starting a new report session.
   * Calls DELETE https://chat.qwen.ai/api/v2/user/memories
   */
  async clearMemories(credentials, proxyOptions, chatId = null) {
    try {
      const url = "https://chat.qwen.ai/api/v2/user/memories";
      const headers = this.buildHeaders(credentials, false, chatId);
      const response = await proxyAwareFetch(url, {
        method: "DELETE",
        headers,
      }, proxyOptions);

      if (response.ok) {
        console.log("[Luna] User memories cleared successfully before new session.");
      } else {
        console.warn(`[Luna] Clear memories response status: ${response.status}`);
      }
    } catch (err) {
      console.warn("[Luna] Clear memories error:", err?.message || err);
    }
  }

  /**
   * Ping /api/v2/users/status to activate the session before sending a completion.
   * Reference: qwen-ai.ts chatCompletion() pre-flight status call.
   */
  async postUserStatus(credentials, proxyOptions, chatId = null) {
    try {
      const url = "https://chat.qwen.ai/api/v2/users/status";
      const headers = this.buildHeaders(credentials, false, chatId);
      headers["content-type"] = "application/json";

      const payload = {
        typarms: {
          typarm1: "web",
          typarm2: "e0e0278b-638a-4b7e-b15b-8d5851fab963",
          typarm3: "prod",
          typarm4: "qwen_chat",
          typarm5: "product",
          typarm6: "",
          orgid: "tongyi",
          share_id: "",
          project_id: "",
          channel_type: "",
          community_type: "",
          from_id: "",
          cdn_version: "0.2.75",
          spmId: "a2ty_o01.29997173",
          aemPageId: "//chat.qwen.ai/c/",
          domain: "chat.qwen.ai",
        },
      };

      const response = await proxyAwareFetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }, proxyOptions);

      if (!response.ok) {
        console.warn(`[Luna] users/status ping failed: ${response.status}`);
      }
    } catch (err) {
      console.warn("[Luna] users/status ping error:", err?.message || err);
    }
  }

  /**
   * Fetch current user settings from Qwen Web via GET https://chat.qwen.ai/api/v2/users/user/settings
   */
  async getUserSettings(credentials, proxyOptions) {
    try {
      const url = "https://chat.qwen.ai/api/v2/users/user/settings";
      const headers = this.buildHeaders(credentials, false, null);
      const response = await proxyAwareFetch(
        url,
        {
          method: "GET",
          headers,
        },
        proxyOptions
      );

      if (!response.ok) return null;
      const resJson = await response.json().catch(() => null);
      if (resJson?.success === false || resJson?.data?.code === "unauthorized") {
        return {
          error: resJson?.data?.details || resJson?.data?.code || "Unauthorized",
          isUnauthorized: true,
        };
      }
      return resJson?.data || null;
    } catch (err) {
      console.warn("[Luna] getUserSettings error:", err?.message || err);
      return null;
    }
  }

  /**
   * Update system_prompt / personalization instruction on Qwen Web via POST https://chat.qwen.ai/api/v2/users/user/settings/update
   */
  async updateSystemPrompt(systemPrompt, credentials, proxyOptions, chatId = null) {
    // Vô hiệu hóa update instruction theo yêu cầu hệ thống.
    return { success: true, message: "updateSystemPrompt disabled" };
  }

  async execute({ model, body, stream, credentials, signal, log, proxyOptions = null, retryOverrides = null }) {
    try {
      const existingChatId = this.resolveChatId(body, credentials);
      const parentMessageId = this.resolveParentMessageId(body, credentials);

      // 1. Pre-flight: clear old memories if launching a new chat room
      if (!existingChatId) {
        await this.clearMemories(credentials, proxyOptions);
      }

      // Extract system prompt if present and update web settings
      const systemMessage = (body?.messages || []).find((m) => m?.role === "system");
      if (systemMessage && typeof systemMessage.content === "string") {
        await this.updateSystemPrompt(systemMessage.content, credentials, proxyOptions, existingChatId);
      }

      // 2. Pre-flight: activate the session (required to avoid Bad_Request)
      await this.postUserStatus(credentials, proxyOptions, existingChatId);

      // 2. Reuse the same chat room when a chat id is already known.
      const chatId = existingChatId || await this.createChat(model, credentials, proxyOptions, body);

      // 3. Build completion URL with query param ?chat_id=
      const baseUrl = this.buildUrl(model, stream, 0, credentials);
      const url = `${baseUrl}?chat_id=${chatId}`;

      // Qwen web API always uses SSE streaming — force SSE headers regardless of client preference.
      // When the caller wants non-streaming (stream===false), luna reads the full SSE to a single JSON
      // response in handleNonStreamingResponse. Using Accept: application/json breaks Qwen's response.
      const transformedBody = this.transformRequest(model, body, true, credentials, chatId);
      const transformedBodyWithParent = parentMessageId
        ? this.transformRequest(model, body, true, credentials, chatId, parentMessageId)
        : transformedBody;
      const headers = this.buildHeaders(credentials, true, chatId);

      const response = await proxyAwareFetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(transformedBodyWithParent),
        signal,
      }, proxyOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API error: ${response.status} - ${errorText.slice(0, 200)}`);
      }

      const assistantMessageId = transformedBodyWithParent?.messages?.[0]?.childrenIds?.[0] || null;

      // Handle non-streaming mode (e.g., /api/models/test)
      if (!stream || body.stream === false) {
        return await this.handleNonStreamingResponse(response, model, url, headers, transformedBodyWithParent, chatId);
      }

      // Transform Qwen SSE stream to OpenAI format for streaming
      const webStream = await this.transformResponseStream(response.body, model, assistantMessageId);

      const resHeaders = new Headers(response.headers);
      if (chatId) resHeaders.set("x-luna-chat-id", chatId);
      if (assistantMessageId) resHeaders.set("x-luna-message-id", assistantMessageId);

      return {
        response: new Response(webStream, {
          status: response.status,
          statusText: response.statusText,
          headers: resHeaders,
        }),
        url,
        headers,
        transformedBody: transformedBodyWithParent,
        sessionChatId: chatId,
        sessionMessageId: assistantMessageId,
      };
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new Error(`Luna executor error: ${error.message}`);
    }
  }

  checkQwenError(data) {
    if (!data) return;
    const isCaptcha = Array.isArray(data.ret) && data.ret.includes("FAIL_SYS_USER_VALIDATE");
    if (data.error || data.success === false || data.message === "Unauthorized" || data.message === "The chat is in progress" || isCaptcha) {
      console.warn("[Luna] Qwen error response:", JSON.stringify(data).slice(0, 500));
      const rawErr = data.error?.message || data.error || data.message || "";
      let errMsg = typeof rawErr === "object" ? JSON.stringify(rawErr) : String(rawErr || "");
      if (isCaptcha) {
        errMsg = "Qwen captcha validation required (FAIL_SYS_USER_VALIDATE)";
      }
      if (!errMsg) errMsg = "Unknown Qwen error";
      throw new Error(`Qwen stream error: ${errMsg}`);
    }
  }

  async handleNonStreamingResponse(response, model, url, headers, transformedBody, chatId = null) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let reasoningText = "";
    let summaryText = "";
    let buffer = "";
    let sessionMessageId = null;
    let fullRawResponse = "";
    let answerFinished = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullRawResponse += chunk;
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        // Qwen may emit the final "finished" event without a trailing newline and
        // then hold the connection open. Peek the leftover buffer: if it is a
        // complete terminal answer-side event, consume it now so we don't wait for
        // a `done` that never arrives on the keep-alive connection.
        const leftover = buffer.trim();
        if (leftover && this.extractDataLinePayload(leftover)) {
          const peek = this.processQwenLineWeb(leftover, model, sessionMessageId);
          if (peek.terminal) {
            lines.push(buffer);
            buffer = "";
          }
        }

        for (const line of lines) {
          const jsonStr = this.extractDataLinePayload(line);
          if (!jsonStr) continue;
          if (jsonStr === "[DONE]") { answerFinished = true; break; }

          try {
            const data = JSON.parse(jsonStr);
            this.checkQwenError(data);
            const { content, phase, status, summary, responseId } = this.extractQwenContentDelta(data);
            if (!sessionMessageId && responseId) {
              sessionMessageId = responseId.trim();
            }
            if (phase === "think" && status !== "finished") {
              reasoningText += content;
            } else if (phase === "thinking_summary") {
              if (summary && summary.length > summaryText.length) summaryText = summary;
            } else if ((phase === "answer" || phase === "image_gen" || phase == null) && content) {
              fullContent += content;
            }
            // Answer-side finished (not thinking_summary) marks the true end.
            const isThinking = phase === "think" || phase === "thinking_summary";
            if (status === "finished" && !isThinking) {
              answerFinished = true;
              break;
            }
          } catch (e) {
            if (e.message && e.message.startsWith("Qwen stream error:")) {
              throw e;
            }
            // Skip invalid JSON
          }
        }
        // Stop reading once the answer is complete — Qwen keeps the connection
        // alive after the final event, so waiting for `done` would hang.
        if (answerFinished) {
          await reader.cancel().catch(() => {});
          break;
        }
      }
      // Flush any remaining data left in the buffer after stream ends
      if (!answerFinished && buffer.trim()) {
        const lastJsonStr = this.extractDataLinePayload(buffer);
        if (lastJsonStr && lastJsonStr !== "[DONE]") {
          try {
            const data = JSON.parse(lastJsonStr);
            this.checkQwenError(data);
            const { content, phase, status, summary, responseId } = this.extractQwenContentDelta(data);
            if (!sessionMessageId && responseId) sessionMessageId = responseId.trim();
            if (phase === "think" && status !== "finished") {
              reasoningText += content;
            } else if (phase === "thinking_summary") {
              if (summary && summary.length > summaryText.length) summaryText = summary;
            } else if ((phase === "answer" || phase === "image_gen" || phase == null) && content) {
              fullContent += content;
            }
          } catch (e) {
            if (e.message && e.message.startsWith("Qwen stream error:")) {
              throw e;
            }
          }
        }
      }
    } catch (error) {
      console.error("[Luna] Failed to parse non-streaming response. Raw response snippet:", fullRawResponse.slice(0, 1000));
      throw new Error(`Luna non-stream error: ${error.message}`);
    }

    if (!fullContent && chatId) {
      try {
        console.log(`[Luna] Fetching full chat history for fallback: chatId=${chatId}`);
        const fetchedContent = await this.fetchCompletedChatContent(chatId, credentials, proxyOptions);
        if (fetchedContent) {
          fullContent = fetchedContent;
        }
      } catch (fallbackErr) {
        console.warn("[Luna] Failed to fetch full chat fallback content:", fallbackErr.message);
      }
    }

    if (!fullContent && (summaryText || reasoningText)) {
      fullContent = summaryText || reasoningText;
    }

    if (!fullContent) {
      console.warn("[Luna] Received empty content from Qwen. Raw response snippet:", fullRawResponse.slice(0, 1000));
      throw new Error("Qwen returned empty content");
    }

    const completionResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        message: { role: "assistant", content: fullContent },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    const resHeaders = new Headers();
    resHeaders.set("Content-Type", "application/json");
    if (chatId) resHeaders.set("x-luna-chat-id", chatId);
    if (sessionMessageId) resHeaders.set("x-luna-message-id", sessionMessageId);

    const body = JSON.stringify(completionResponse);
    return {
      response: new Response(body, {
        status: 200,
        headers: resHeaders,
      }),
      url,
      headers,
      transformedBody,
      sessionChatId: chatId,
      sessionMessageId,
    };
  }

  async transformResponseStream(inputStream, model, assistantMessageId = null) {
    const reader = inputStream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const self = this;
    let buffer = "";
    let isFirstChunk = true;
    let activeResponseId = assistantMessageId;
    let streamEnded = false;

    // Emit the final stop chunk + a single [DONE], release the upstream connection,
    // and close the downstream controller. Idempotent — safe to call once.
    const finish = (controller, extraChunk = null) => {
      if (streamEnded) return;
      streamEnded = true;
      if (extraChunk) {
        controller.enqueue(encoder.encode(extraChunk));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      // Release the keep-alive upstream connection so it doesn't hang open.
      reader.cancel().catch(() => {});
      controller.close();
    };

    return new ReadableStream({
      async pull(controller) {
        if (streamEnded) return;
        try {
          // Keep reading until we have something to enqueue, hit the terminal
          // event, or the upstream closes. A single reader.read() is NOT enough:
          // when the upstream splits the SSE into tiny slices (e.g. 1–7 bytes),
          // one read may only add a partial line to `buffer` — no complete line,
          // nothing to enqueue. Returning from pull() without enqueuing relies on
          // the consumer calling pull() again, which is not guaranteed by every
          // consumer and stalls timeout-based collectors. Loop here so each pull()
          // makes forward progress until it produces output or the stream ends.
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              let tail = null;
              if (buffer.trim()) {
                const result = self.processQwenLineWeb(buffer, model, activeResponseId);
                if (result.chunk) tail = result.chunk;
              }
              // Upstream closed without an explicit terminal event — synthesize a stop.
              const finalChunk = tail || `data: ${JSON.stringify({
                id: activeResponseId || `chatcmpl-${Date.now()}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
              })}\n\n`;
              finish(controller, finalChunk);
              return;
            }

            buffer += decoder.decode(value, { stream: true });

            if (isFirstChunk) {
              console.log("[Luna Debug] First raw chunk:", buffer.slice(0, 500));
              isFirstChunk = false;
            }

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            // Process complete lines. Then also peek at the leftover buffer: Qwen may
            // send the final "finished" event WITHOUT a trailing newline and then hold
            // the connection open (keep-alive), so it would otherwise stay stuck in
            // `buffer` until an upstream `done` that never comes. If the leftover parses
            // as a terminal event, act on it now.
            const pending = [...lines];
            const leftover = buffer.trim();
            if (leftover && self.extractDataLinePayload(leftover)) {
              const peek = self.processQwenLineWeb(leftover, model, activeResponseId);
              if (peek.terminal) {
                pending.push(buffer);
                buffer = "";
              }
            }

            let enqueuedAny = false;
            for (const line of pending) {
              const jsonStr = self.extractDataLinePayload(line);
              if (jsonStr && jsonStr !== "[DONE]") {
                try {
                  const data = JSON.parse(jsonStr);
                  const rId = data?.["response.created"]?.response_id || data?.id;
                  if (rId) {
                    activeResponseId = rId;
                  }
                } catch (e) {}
              }
              const result = self.processQwenLineWeb(line, model, activeResponseId);
              if (result.terminal) {
                // Real end of response: emit the final chunk, [DONE], and close now
                // instead of waiting for the keep-alive upstream to close on its own.
                finish(controller, result.chunk);
                return;
              }
              if (result.chunk) {
                controller.enqueue(encoder.encode(result.chunk));
                enqueuedAny = true;
              }
            }

            // Made forward progress this pull — hand control back so the consumer
            // can drain what we enqueued. Otherwise loop and read the next slice
            // rather than returning empty-handed.
            if (enqueuedAny) return;
          }
        } catch (err) {
          console.error("[Luna] Stream pull error:", err);
          controller.error(err);
        }
      },

      cancel() {
        reader.cancel().catch(() => {});
      }
    });
  }

  /**
   * Phase-aware SSE parser.
   * Qwen emits multiple phases per request: "think" -> "thinking_summary" -> "answer".
   * All phases carry delta.content that should be streamed to the client.
   *
   * Returns { chunk, terminal } where:
   *   - chunk: the SSE `data: ...\n\n` string to enqueue (or null when nothing to emit).
   *   - terminal: true only when this is the real end of the response. The caller is
   *     responsible for emitting a single `[DONE]` and closing the stream. This method
   *     never embeds `[DONE]` itself, so the marker is emitted exactly once.
   *
   * A `status: "finished"` on the `think`/`thinking_summary` phase marks the END OF
   * THINKING, not the end of the response — the `answer` phase follows. Only an
   * explicit `finish_reason: "stop"` or a `finished` status on an answer-side phase
   * (answer/image_gen/null) is treated as terminal.
   */
  processQwenLineWeb(line, model, activeResponseId = null) {
    const jsonStr = this.extractDataLinePayload(line);
    if (!jsonStr) return { chunk: null, terminal: false };
    if (jsonStr === "[DONE]") return { chunk: null, terminal: true };

    try {
      const data = JSON.parse(jsonStr);
      this.checkQwenError(data);
      const { choice, content, phase, status, responseId } = this.extractQwenContentDelta(data);
      if (!choice) return { chunk: null, terminal: false };

      const finalResponseId = responseId || activeResponseId || `chatcmpl-${Date.now()}`;
      const isThinking = phase === "think" || phase === "thinking_summary";
      const statusFinished = status === "finished" || (choice.delta && choice.delta.status === "finished");
      // Thinking-side "finished" only ends the thinking phase; the answer phase is still coming.
      const isTerminal = choice.finish_reason === "stop" || (statusFinished && !isThinking);

      if (content || phase === "thinking_summary") {
        const finishReason = isTerminal ? "stop" : (choice.finish_reason || null);
        const deltaObj = isThinking
          ? { reasoning_content: content, phase, extra: choice?.delta?.extra }
          : { content, phase, extra: choice?.delta?.extra };

        const openaiChunk = {
          id: finalResponseId,
          object: "chat.completion.chunk",
          created: data.created || Math.floor(Date.now() / 1000),
          model: model,
          choices: [{
            index: choice.index || 0,
            delta: deltaObj,
            finish_reason: finishReason,
          }],
        };

        return { chunk: `data: ${JSON.stringify(openaiChunk)}\n\n`, terminal: isTerminal };
      }

      // Forward explicit stop or finished status from Qwen Web (answer side, empty content).
      if (isTerminal) {
        const stopChunk = {
          id: finalResponseId,
          object: "chat.completion.chunk",
          created: data.created || Math.floor(Date.now() / 1000),
          model: model,
          choices: [{ index: choice.index || 0, delta: {}, finish_reason: "stop" }],
        };
        return { chunk: `data: ${JSON.stringify(stopChunk)}\n\n`, terminal: true };
      }
    } catch (e) {
      if (e.message && e.message.startsWith("Qwen stream error:")) {
        throw e;
      }
      // Skip invalid JSON
    }
    return { chunk: null, terminal: false };
  }
}

export default LunaExecutor;
