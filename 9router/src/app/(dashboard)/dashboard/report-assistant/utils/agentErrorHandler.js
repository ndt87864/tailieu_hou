function tryParseJsonText(text) {
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
