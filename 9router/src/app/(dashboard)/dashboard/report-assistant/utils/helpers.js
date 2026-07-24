import {
  REPORT_ASSISTANT_LUNA_MODEL_PREFIX
} from "../constants";

export function tryParseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function extractAgentErrorMessage(errorText) {
  const parsed = tryParseJsonText(errorText);
  const message =
    parsed?.error?.message ||
    parsed?.error ||
    parsed?.message ||
    errorText ||
    "";
  return String(message || "").trim();
}

export function classifyAgentDraftError(status, errorText, fallbackError = null) {
  const rawMessage = extractAgentErrorMessage(errorText) || fallbackError?.message || "";
  const normalized = rawMessage.toLowerCase();
  const statusCode = Number(status) || 0;

  if ([400, 429, 501, 503].includes(statusCode)) {
    return {
      title: "Lỗi quá tải hệ thống",
      message:
        "Hệ thống đang quá tải hoặc model/API key hiện tại không thể xử lý yêu cầu tạo báo cáo.",
      detail: rawMessage || `HTTP ${statusCode}`,
    };
  }

  if ([502, 504].includes(statusCode) || /timeout|timed out|aborted|fetch failed|econnrefused|api|json|unexpected end|no content/i.test(rawMessage)) {
    return {
      title: "Hệ thống không tạo được nội dung",
      message:
        "API không trả về nội dung hợp lệ cho bước soạn thảo này. Quy trình Agent đã được dừng để tránh chạy tiếp với trạng thái lỗi.",
      detail: rawMessage || (statusCode ? `HTTP ${statusCode}` : "API không phản hồi"),
    };
  }

  if (normalized.includes("quota") || normalized.includes("resource_exhausted") || normalized.includes("credits")) {
    return {
      title: "Hết hạn mức API",
      message:
        "API key hoặc tài khoản model đã hết hạn mức nên không thể tiếp tục tạo nội dung báo cáo.",
      detail: rawMessage,
    };
  }

  return {
    title: "Soạn thảo mục báo cáo thất bại",
    message:
      "Quy trình Agent đã được dừng vì bước soạn thảo hiện tại gặp lỗi.",
    detail: rawMessage || (statusCode ? `HTTP ${statusCode}` : "Không có thông tin lỗi chi tiết"),
  };
}

export function extractTargetCompany(text) {
  if (!text) return "";
  const match = text.match(
    /(?:cho|của|về|tại)\s+(?:công ty|ngân hàng|tập đoàn|doanh nghiệp|đơn vị|cửa hàng|chuỗi)?\s*([A-ZÀ-Ỹa-zà-ỹ0-9\s\.\-]+?)(?:\s+mà|\s+nhưng|\s+để|\s+hoặc|\s+và|\s+theo|\s+ở|\s+tại|\s*$)/i,
  );
  return match ? match[1].trim() : "";
}

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function safeParse(val, fallback) {
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export function isReportAssistantLunaModel(modelId) {
  return String(modelId || "").startsWith(REPORT_ASSISTANT_LUNA_MODEL_PREFIX);
}

export function hasAgentResultCards(messages) {
  return (Array.isArray(messages) ? messages : []).some(
    (message) => message?.kind === "agent_result_cards",
  );
}

export function shouldAutoRestoreReportSession(session) {
  if (!session) return false;
  const modelId = String(session.modelId || "");
  if (!modelId.startsWith(REPORT_ASSISTANT_LUNA_MODEL_PREFIX)) {
    return false;
  }
  return !hasAgentResultCards(session.messages);
}

export function isAgentFinishedState(state) {
  if (!state) return false;
  if (state.current_step === "COMPLETED" || state.current_step === "CANCELLED") {
    return true;
  }

  const progress = Array.isArray(state.sections_progress) ? state.sections_progress : [];
  if (progress.length === 0) return false;

  return !progress.some(
    (section) => section?.status === "todo" || section?.status === "drafting" || section?.status === "stream_drafting",
  );
}

export function getReportAssistantLunaModels(models) {
  if (!Array.isArray(models)) return [];
  return models.filter((model) => isReportAssistantLunaModel(model?.id));
}

export function getReportAssistantChatModels(models, onlyCurrentProvider = true) {
  if (!Array.isArray(models)) return [];
  if (onlyCurrentProvider) {
    const lunaModels = getReportAssistantLunaModels(models);
    if (lunaModels.length > 0) {
      return lunaModels;
    }
  }

  return models.filter((model) => {
    const modelId = String(model?.id || "");
    return Boolean(modelId);
  });
}

export function getReportWorkflowDefaultModelId(models) {
  if (!Array.isArray(models) || models.length === 0) return "";
  return models[0]?.id || "";
}

export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function relTime(iso) {
  if (!iso) return "vừa xong";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.round(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.round(diff / 3600)} giờ trước`;
  return `${Math.round(diff / 86400)} ngày trước`;
}

export function historySyncSignature(username, sessions) {
  return JSON.stringify({
    username,
    sessions: Array.isArray(sessions) ? sessions : [],
  });
}

export function hasStreamingMessage(sessions) {
  return (Array.isArray(sessions) ? sessions : []).some((session) =>
    (Array.isArray(session?.messages) ? session.messages : []).some(
      (message) => message?.status === "streaming",
    ),
  );
}
