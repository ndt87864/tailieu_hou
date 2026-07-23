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
        "Tạo lại báo cáo bị lỗi do hệ thống quá tải. Nội dung báo cáo cũ đã được giữ nguyên ở cơ sở dữ liệu và chuyển về trạng thái hoàn thành (complete).",
      detail: rawMessage || `HTTP ${statusCode}`,
    };
  }

  if ([502, 504].includes(statusCode) || /timeout|timed out|aborted|fetch failed|econnrefused|api|json|unexpected end|no content/i.test(rawMessage)) {
    return {
      title: "Không thể tạo lại nội dung",
      message:
        "Tạo lại báo cáo bị lỗi kết nối hoặc phản hồi API. Nội dung báo cáo cũ đã được giữ nguyên ở cơ sở dữ liệu và chuyển về trạng thái hoàn thành (complete).",
      detail: rawMessage || (statusCode ? `HTTP ${statusCode}` : "API không phản hồi"),
    };
  }

  if (normalized.includes("quota") || normalized.includes("resource_exhausted") || normalized.includes("credits")) {
    return {
      title: "Hết hạn mức API",
      message:
        "API key hoặc tài khoản model đã hết hạn mức. Nội dung báo cáo cũ đã được giữ nguyên ở cơ sở dữ liệu và chuyển về trạng thái hoàn thành (complete).",
      detail: rawMessage,
    };
  }

  return {
    title: "Tạo lại báo cáo thất bại",
    message:
      "Tạo lại báo cáo bị lỗi. Nội dung báo cáo cũ đã được giữ nguyên ở cơ sở dữ liệu và chuyển về trạng thái hoàn thành (complete).",
    detail: rawMessage || (statusCode ? `HTTP ${statusCode}` : "Không có thông tin lỗi chi tiết"),
  };
}
