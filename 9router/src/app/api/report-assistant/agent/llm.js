import { getApiKeys } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { getDefaultModel } from "@/shared/constants/models";
import { ensureRestrictedUserResources } from "@/lib/restrictedUserProvisioning";

const CLI_TOKEN_SALT = "9r-cli-auth";
const REPORT_LLM_TIMEOUT_MS = Number.parseInt(process.env.REPORT_AGENT_LLM_TIMEOUT_MS || "180000", 10);
const REPORT_LLM_MAX_ATTEMPTS = Number.parseInt(process.env.REPORT_AGENT_LLM_MAX_ATTEMPTS || "1", 10);
const REPORT_MAX_COMBO_MODELS = Number.parseInt(process.env.REPORT_AGENT_MAX_COMBO_MODELS || "2", 10);
const REPORT_COMBO_STRATEGY = String(process.env.REPORT_AGENT_COMBO_STRATEGY || "round-robin").trim().toLowerCase();
const REPORT_MAX_ACCOUNT_FALLBACKS = Number.parseInt(process.env.REPORT_AGENT_MAX_ACCOUNT_FALLBACKS || "2", 10);
const REPORT_ASSISTANT_LUNA_MODEL_PREFIX = "ln/";
const REPORT_ASSISTANT_ARENA_MODEL_PREFIX = "ar/";

export function isLunaModelId(modelId) {
  return String(modelId || "").startsWith(REPORT_ASSISTANT_LUNA_MODEL_PREFIX);
}

export function isArenaModelId(modelId) {
  return String(modelId || "").startsWith(REPORT_ASSISTANT_ARENA_MODEL_PREFIX);
}

export function getReportAssistantFallbackModel() {
  return "gemini-1.5-flash";
}

export function getReportAssistantLunaModelId() {
  const lunaModel = getDefaultModel("luna");
  return lunaModel ? `${REPORT_ASSISTANT_LUNA_MODEL_PREFIX}${lunaModel}` : getReportAssistantFallbackModel();
}

export function getReportAssistantArenaModelId() {
  const arenaModel = getDefaultModel("arena");
  return arenaModel ? `${REPORT_ASSISTANT_ARENA_MODEL_PREFIX}${arenaModel}` : getReportAssistantFallbackModel();
}

export function normalizeReportAssistantModelId(modelId, lunaActive, arenaActive) {
  const requested = String(modelId || "").trim();
  const fallback = getReportAssistantFallbackModel();
  const lunaModelId = getReportAssistantLunaModelId();
  const arenaModelId = getReportAssistantArenaModelId();

  if (lunaActive) {
    return isLunaModelId(requested) ? requested : lunaModelId;
  }

  if (arenaActive) {
    return isArenaModelId(requested) ? requested : arenaModelId;
  }

  // When neither is active, allow the requested model (which is the chat model) directly.
  return requested || fallback;
}

/**
 * Lấy API key nội bộ tương ứng với từng tài khoản.
 * Mỗi tài khoản (Minh, Trang, Thu, Thủy, Nga) dùng đúng 1 key riêng theo thứ tự.
 * @param {string} [rawUsername] - username gốc của người dùng (chưa map)
 */
export async function getInternalApiKey(rawUsername) {
  try {
    await ensureRestrictedUserResources(rawUsername);
    const keys = await getApiKeys();
    const activeKeys = keys.filter((key) => key.isActive !== false);
    if (!activeKeys.length) return null;

    // Use the first active key in this user's own DB partition.
    return activeKeys[0].key;
  } catch {
    return null;
  }
}

export function getBaseUrl(request = null) {
  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }

    const host = request.headers.get("host");
    if (host) {
      const protocol = request.url?.startsWith("https://") ? "https" : "http";
      return `${protocol}://${host}`;
    }

    try {
      return new URL(request.url).origin;
    } catch { }
  }

  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:20128";
}

// Helper to sleep/pause
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function buildInternalFetchHeaders(authToken = null, contentType = null) {
  const headers = {
    "x-9r-cli-token": await getConsistentMachineId(CLI_TOKEN_SALT),
    "x-9r-report-agent": "true",
  };
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (authToken) {
    headers.Cookie = `auth_token=${authToken}`;
  }
  return headers;
}

const BACKUP_MODELS = ["gemini-1.5-flash", "gemini-2.5-flash", "gpt-4o-mini", "gemini-1.5-pro"];
const LUNA_BACKUP_MODELS = ["ln/qwen3.8-max", "ln/qwen3.7-max", "ln/qwen3.6-plus", "gemini-1.5-flash", "gpt-4o-mini"];
const ARENA_BACKUP_MODELS = ["ar/claude-3-5-sonnet-20241022", "gemini-1.5-flash", "gpt-4o-mini"];

export function extractLLMText(data) {
  const choice = data?.choices?.[0] || {};
  const message = choice.message || {};
  const content = message.content ?? choice.delta?.content ?? data?.output_text ?? data?.text ?? "";

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("");
  }
  return "";
}

// Call local completions API with Exponential Backoff Retries for Rate Limits (429/503)
export async function callLLM(modelId, messages, temperature = 0.3, authToken = null, rawUsername = null, baseUrlOverride = null, sessionState = null, options = {}) {
  const authContext = rawUsername;
  const maxAttempts = Number.isFinite(REPORT_LLM_MAX_ATTEMPTS) && REPORT_LLM_MAX_ATTEMPTS > 0 ? REPORT_LLM_MAX_ATTEMPTS : 1;
  const timeoutMs = Number.isFinite(options.timeout) && options.timeout > 0 ? options.timeout : (Number.isFinite(REPORT_LLM_TIMEOUT_MS) && REPORT_LLM_TIMEOUT_MS > 0 ? REPORT_LLM_TIMEOUT_MS : 180000);

  // Strictly execute request on ONLY the user-selected modelId (no fallback models)
  const currentModelId = modelId;
  let attempt = 0;
  let backoffMs = 2000;

  while (attempt < maxAttempts) {
    // Dynamic inactivity controller: reset timeout whenever any stream chunk (thinking or text) arrives
    const abortController = new AbortController();
    let inactivityTimer = setTimeout(() => {
      abortController.abort(new Error(`Hệ thống ngắt kết nối do mô hình ${currentModelId} không trả về dữ liệu quá ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    const resetInactivity = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        abortController.abort(new Error(`Hệ thống ngắt kết nối do mô hình ${currentModelId} không trả về dữ liệu quá ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
    };

    try {
      const baseUrl = baseUrlOverride || getBaseUrl();
      const headers = {
        "Content-Type": "application/json",
      };
      const internalApiKey = await getInternalApiKey(authContext);
      if (internalApiKey) {
        headers.Authorization = `Bearer ${internalApiKey}`;
      }
      headers["x-9r-cli-token"] = await getConsistentMachineId(CLI_TOKEN_SALT);
      headers["x-9r-report-agent"] = "true";
      headers["x-9r-fast-fail"] = "true";
      if (authContext) {
        headers["x-9r-raw-username"] = String(authContext);
      }
      if (Number.isFinite(REPORT_MAX_COMBO_MODELS) && REPORT_MAX_COMBO_MODELS > 0) {
        headers["x-9r-max-combo-models"] = String(REPORT_MAX_COMBO_MODELS);
      }
      if (REPORT_COMBO_STRATEGY === "round-robin" || REPORT_COMBO_STRATEGY === "fallback") {
        headers["x-9r-combo-strategy"] = REPORT_COMBO_STRATEGY;
      }
      if (Number.isFinite(REPORT_MAX_ACCOUNT_FALLBACKS) && REPORT_MAX_ACCOUNT_FALLBACKS > 0) {
        headers["x-9r-max-account-fallbacks"] = String(REPORT_MAX_ACCOUNT_FALLBACKS);
      }

      if (authToken) {
        headers["Cookie"] = `auth_token=${authToken}`;
      }

      const isStream = typeof options.onChunk === "function";

      const res = await fetch(`${baseUrl}/api/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: currentModelId,
          messages,
          temperature,
          stream: isStream,
          auto_search: false,
          ...(sessionState ? {
            lunaChatId: sessionState.lunaChatId || "",
            lunaParentMessageId: sessionState.lunaMessageId || "",
          } : {}),
        }),
        signal: abortController.signal,
      });

      if (process.env.NODE_ENV !== "production") {
        console.log(`[agent/route] LLM response model=${currentModelId} status=${res.status} attempt=${attempt + 1}/${maxAttempts} stream=${isStream}`);
      }

      // Handle Rate Limiting / Quota Exceeded (429) -> throw error immediately, no fallback
      if (res.status === 429) {
        clearTimeout(inactivityTimer);
        const errText = await res.text().catch(() => "");
        throw new Error(`Mô hình ${currentModelId} bị giới hạn hạn ngạch (429 Quota/Rate Limit): ${errText.slice(0, 180)}`);
      }

      // Handle server errors (502/503/504) -> retry if attempt < maxAttempts, else throw error
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        clearTimeout(inactivityTimer);
        const errText = await res.text().catch(() => "");
        attempt++;
        if (attempt >= maxAttempts) {
          throw new Error(`Mô hình ${currentModelId} gặp lỗi máy chủ (${res.status}): ${errText.slice(0, 180)}`);
        }
        const jitter = Math.floor(Math.random() * 1000);
        const sleepMs = Math.min(backoffMs, 5000) + jitter;
        console.warn(`[agent/route] LLM ${res.status}. Attempt ${attempt}/${maxAttempts}. Retrying same model in ${sleepMs}ms...`);
        await sleep(sleepMs);
        backoffMs *= 2;
        continue;
      }

      if (!res.ok) {
        clearTimeout(inactivityTimer);
        const errText = await res.text();
        throw new Error(`Mô hình ${currentModelId} phản hồi lỗi (${res.status}): ${errText.slice(0, 200)}`);
      }

      const lunaChatId = res.headers.get("x-luna-chat-id") || "";
      const lunaMessageId = res.headers.get("x-luna-message-id") || "";
      if (sessionState && lunaChatId) {
        sessionState.lunaChatId = lunaChatId;
      }
      if (sessionState && lunaMessageId) {
        sessionState.lunaMessageId = lunaMessageId;
      }

      if (isStream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullText = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            resetInactivity();

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;
              if (trimmed === "data: [DONE]") break;

              let jsonStr = trimmed;
              if (trimmed.startsWith("data: ")) {
                jsonStr = trimmed.slice(6);
              }

              try {
                const json = JSON.parse(jsonStr);
                
                // Detect provider level stream error payloads
                if (json.success === false || json.error || json.data?.code) {
                  const errCode = json.data?.code || json.error?.code || "";
                  const errDetails = json.data?.details || json.error?.message || json.message || "";
                  console.warn(`[callLLM] Stream returned error (${currentModelId}):`, errCode, errDetails);

                  if (errCode === "PARENT_NOT_FOUND" || String(errDetails).includes("parent_id")) {
                    if (sessionState) {
                      sessionState.lunaChatId = "";
                      sessionState.lunaMessageId = "";
                    }
                  }
                  throw new Error(`Lỗi stream từ mô hình ${currentModelId}: ${errDetails || errCode}`);
                }

                const choiceDelta = json.choices?.[0]?.delta || json.delta || json.choices?.[0] || json;
                const reasoning = choiceDelta?.reasoning_content || choiceDelta?.reasoning || json.reasoning || "";
                if (reasoning && typeof options.onThinking === "function") {
                  options.onThinking(reasoning);
                }

                const delta =
                  choiceDelta?.content ??
                  choiceDelta?.text ??
                  json.choices?.[0]?.text ??
                  json.choices?.[0]?.message?.content ??
                  json.delta?.content ??
                  json.content ??
                  json.text ??
                  "";

                if (delta) {
                  fullText += delta;
                  if (typeof options.onChunk === "function") {
                    options.onChunk(fullText);
                  }
                }
              } catch (e) {
                if (e.message?.startsWith("Lỗi stream từ mô hình")) {
                  throw e;
                }
              }
            }
          }
          clearTimeout(inactivityTimer);
          if (fullText.trim()) {
            return fullText;
          }
        } catch (streamErr) {
          clearTimeout(inactivityTimer);
          if (fullText.trim()) return fullText;
          throw streamErr;
        }

        throw new Error(`Luồng dữ liệu từ mô hình ${currentModelId} kết thúc mà không có nội dung văn bản.`);
      }

      const data = await res.json();
      clearTimeout(inactivityTimer);
      return extractLLMText(data);
    } catch (err) {
      attempt++;
      if (err.name === "AbortError" || err.message?.includes("timeout") || err.name === "TimeoutError" || err.message?.includes("stalled")) {
        throw new Error(`Mô hình ${currentModelId} không phản hồi/bị ngắt kết nối sau ${Math.round(timeoutMs / 1000)}s. Quy trình đã hủy.`);
      }
      if (attempt >= maxAttempts) {
        throw new Error(`Lỗi mô hình ${currentModelId}: ${err.message}`);
      }
      const sleepMs = backoffMs + Math.floor(Math.random() * 1000);
      console.warn(`[agent/route] Connection error on ${currentModelId}. Attempt ${attempt}/${maxAttempts}. Retrying in ${sleepMs}ms...`, err.message);
      await sleep(sleepMs);
      backoffMs *= 2;
    }
  }
  throw new Error(`Không thể kết nối mô hình ${modelId}: quy trình đã dừng.`);
}
