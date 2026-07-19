import {
  cleanOutlineLine,
  adaptOutlineTitleToContext,
  isOutlineHeading,
  normalizeOutlineMatchText,
  sanitizeOutlineSubsections
} from "./utils";

export function outlineLevel(line) {
  const text = cleanOutlineLine(line);
  const normalized = normalizeOutlineMatchText(text);
  if (/^phan\s+/.test(normalized) || /^chuong\s+/.test(normalized)) return 1;
  const match = text.match(/^(\d+(?:\.\d+)*)\.?/);
  if (!match) return 1;
  return match[1].split(".").length + 1;
}

export function parseOutlineKnowledge(outlineKnowledge, reportContext = null) {
  const seen = new Set();
  const items = [];
  let currentTopLevel = null;
  const lines = String(outlineKnowledge || "").split(/\r?\n/);

  for (const rawLine of lines) {
    const title = adaptOutlineTitleToContext(cleanOutlineLine(rawLine), reportContext);
    if (!isOutlineHeading(title)) continue;

    const dedupeKey = title.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const level = outlineLevel(title);
    const normalized = normalizeOutlineMatchText(title);
    const isTopLevel = /^phan\s+/.test(normalized) || /^chuong\s+/.test(normalized);

    if (isTopLevel || !currentTopLevel) {
      currentTopLevel = {
        id: String(items.length + 1),
        title,
        level: isTopLevel ? 1 : level,
        subsections: [],
        description: reportContext
          ? `Mục chính theo đề cương đã chọn; triển khai cho đề tài "${reportContext.reportTitle}".`
          : "Mục chính lấy nguyên văn từ đề cương đã chọn; giữ đúng thứ tự và phạm vi.",
        source: "selected_outline",
        reportContext,
      };
      items.push(currentTopLevel);
      continue;
    }

    currentTopLevel.subsections.push(title);
  }

  for (const item of items) {
    item.subsections = sanitizeOutlineSubsections(item.subsections)
      .map((subsection) => adaptOutlineTitleToContext(subsection, reportContext));
    if (item.subsections?.length) {
      item.description = [
        reportContext
          ? `Bắt buộc triển khai đúng các mục con cho đề tài "${reportContext.reportTitle}", không đổi thứ tự, không thêm/bỏ mục:`
          : "Bắt buộc triển khai đúng các mục con theo đề cương đã chọn, không đổi thứ tự, không thêm/bỏ mục:",
        ...item.subsections.map((subsection) => `- ${subsection}`),
      ].join("\n");
    }
  }

  return items;
}
