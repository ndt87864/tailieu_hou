import {
  extractMetadataFromContent,
  injectCoverPageFull,
  generateEvaluationForm,
  normalizeMajorHeadingLevels,
  normalizeNumberedHeadingLevels,
} from "./reportCoverPage.js";

export {
  extractMetadataFromContent,
  injectCoverPageFull,
  generateEvaluationForm,
  normalizeMajorHeadingLevels,
  normalizeNumberedHeadingLevels,
};

export function textValue(val) {
  if (typeof val === "string") return val;
  return String(val || "");
}

export function removeVietnameseTones(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
}

export function normalizeForMatch(str) {
  return removeVietnameseTones(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMajorHeadingLine(line) {
  return normalizeForMatch(
    textValue(line)
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.+?)\*\*:?$/, "$1")
      .replace(/^(?:chuong|chapter|phan|muc)\s*\d+[:.-]?\s*/i, "")
      .replace(/^(?:[0-9ivxlcdm]+|[IVXLCDM]+)\.?\s*/i, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function isListItemLine(line) {
  const trimmed = textValue(line).trim();
  return /^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);
}

export function isMajorSectionHeadingLine(line) {
  if (isListItemLine(line)) return false;

  const trimmed = textValue(line).trim();
  if (trimmed.length > 150) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("đóng vai trò") ||
    lower.includes("là kết quả") ||
    lower.includes("chương này") ||
    lower.includes("tác giả") ||
    lower.includes("được chia thành") ||
    lower.includes("chúng ta") ||
    lower.includes("nghiên cứu này") ||
    lower.includes("xin cam đoan") ||
    lower.includes("cam đoan rằng") ||
    (trimmed.endsWith(".") && !/\d+\.$/.test(trimmed) && !/chương\s+\d+\.$/i.test(trimmed))
  ) {
    return false;
  }

  const normalized = normalizeMajorHeadingLine(line);
  if (!normalized) return false;
  return (
    /^loi mo dau\b/.test(normalized) ||
    /^mo dau\b/.test(normalized) ||
    /^phan mo dau\b/.test(normalized) ||
    /^phan noi dung\b/.test(normalized) ||
    /^chuong\s+([0-9ivxlcdm]+)\b/.test(normalized) ||
    /^chuong\s*(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\b/.test(
      normalized,
    ) ||
    /^chapter\s+\d+\b/.test(normalized) ||
    /^ket luan\b/.test(normalized) ||
    /^tai lieu tham khao\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^muc luc\b/.test(normalized) ||
    /^nhan xet kien tap\b/.test(normalized) ||
    /^xac nhan cua can bo huong dan\b/.test(normalized)
  );
}

export function isReferenceHeadingLine(line) {
  if (isListItemLine(line)) return false;
  const normalized = normalizeMajorHeadingLine(line);
  return (
    /^tai lieu tham khao\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^references?\b/.test(normalized) ||
    /^bibliograph/.test(normalized)
  );
}

export function splitReferenceBlocks(content) {
  const lines = textValue(content).split(/\r?\n/);
  const body = [];
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (isReferenceHeadingLine(line)) {
      if (current) blocks.push(current);
      current = { heading: line, lines: [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else {
      body.push(line);
    }
  }
  if (current) blocks.push(current);
  return { body: body.join("\n").trim(), blocks };
}

export function normalizeReferenceListItem(line, nextIndex) {
  const trimmed = textValue(line).trim();
  if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return "";
  if (isReferenceHeadingLine(trimmed)) return "";
  const match = trimmed.match(/^(?:[-*]\s+|\d+[.)]\s+)?(.+)$/);
  const item = (match?.[1] || trimmed).trim();
  if (!item) return "";
  return `${nextIndex}. ${item}`;
}

export function mergeDuplicateReferenceSections(content) {
  const { body, blocks } = splitReferenceBlocks(content);
  if (!blocks.length) return textValue(content).trim();

  const seen = new Set();
  const items = [];
  for (const block of blocks) {
    for (const rawLine of block.lines) {
      const item = normalizeReferenceListItem(rawLine, items.length + 1);
      if (!item) continue;
      const key = normalizeForMatch(item.replace(/^\d+[.)]\s*/, ""));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  const referenceSection = [
    "[PAGE_BREAK]",
    "## DANH MỤC TÀI LIỆU THAM KHẢO",
    ...items.map((item, index) => item.replace(/^\d+[.)]\s*/, `${index + 1}. `)),
  ].join("\n");

  return body ? `${body.trim()}\n\n${referenceSection}` : referenceSection;
}

export function isTocHeadingLine(line) {
  const normalized = normalizeMajorHeadingLine(line);
  return (
    /^muc luc\b/.test(normalized) || /^table of contents\b/.test(normalized)
  );
}

export function isLikelyTocEntryLine(line) {
  const raw = textValue(line).trim();
  const normalized = normalizeMajorHeadingLine(raw);
  if (!normalized) return false;
  if (/[.\u2026]{3,}\s*\d*\s*$/.test(raw)) return true;
  if (/^\d+(?:\.\d+)*\s+/.test(raw)) return true;
  return (
    /^phan\s+/.test(normalized) ||
    /^chuong\s+([0-9ivxlcdm]+)\b/.test(normalized) ||
    /^ket luan\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^tai lieu tham khao\b/.test(normalized)
  );
}

export function injectSectionPageBreaks(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let lastMajorHeading = "";
  let inTableOfContents = false;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (trimmed.toUpperCase() === "[PAGE_BREAK]") {
      out.push("[PAGE_BREAK]");
      inTableOfContents = false;
      continue;
    }

    if (isTocHeadingLine(trimmed)) {
      inTableOfContents = true;
      out.push(line);
      continue;
    }

    if (inTableOfContents && isLikelyTocEntryLine(trimmed)) {
      out.push(line);
      continue;
    }

    if (isMajorSectionHeadingLine(trimmed)) {
      const normalizedHeading = normalizeMajorHeadingLine(trimmed);
      if (normalizedHeading && normalizedHeading === lastMajorHeading) {
        continue;
      }

      const nextMeaningful =
        lines
          .slice(idx + 1)
          .map((nextLine) => nextLine.trim())
          .find(Boolean) || "";
      const previousMeaningful =
        out
          .slice()
          .reverse()
          .map((prevLine) => textValue(prevLine).trim())
          .find(Boolean) || "";
      const looksLikeChapterList =
        (nextMeaningful &&
          (isMajorSectionHeadingLine(nextMeaningful) ||
            /[.\u2026]{3,}\s*\d*\s*$/.test(nextMeaningful))) ||
        (previousMeaningful &&
          previousMeaningful.toUpperCase() !== "[PAGE_BREAK]" &&
          (isMajorSectionHeadingLine(previousMeaningful) ||
            /[.\u2026]{3,}\s*\d*\s*$/.test(previousMeaningful)));

      if (looksLikeChapterList) {
        out.push(line);
        lastMajorHeading = normalizedHeading;
        continue;
      }

      const lastMeaningful = out
        .slice()
        .reverse()
        .map((l) => textValue(l).trim().toUpperCase())
        .find((l) => l !== "") || "";
      let skipPageBreak = false;
      if (normalizedHeading === "nhan xet kien tap" || normalizedHeading === "nhan xet kien tap cua co quan" || normalizedHeading === "xac nhan cua can bo huong dan" || normalizedHeading === "nhan xet cua can bo huong dan" || normalizedHeading === "xac nhan cua don vi tiep nhan kien tap") {
        const lastPageBreakIdx = out.lastIndexOf("[PAGE_BREAK]");
        const currentPageContent = out.slice(lastPageBreakIdx + 1).join("\n").toLowerCase();
        if (currentPageContent.includes("cộng hòa xã hội") || currentPageContent.includes("cong hoa xa hoi")) {
          skipPageBreak = true;
        }
      }
      if (out.length > 0 && lastMeaningful !== "[PAGE_BREAK]" && !skipPageBreak) {
        out.push("[PAGE_BREAK]");
      }

      lastMajorHeading = normalizedHeading;
    } else if (trimmed) {
      lastMajorHeading = "";
      inTableOfContents = false;
    }

    out.push(line);
  }

  return out.join("\n").trim();
}

export function normalizeDisplayLineForDedup(line) {
  return normalizeForMatch(
    textValue(line)
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.+?)\*\*:?$/, "$1")
      .replace(/^\d+(?:\.\d+)*\s*/, "")
      .replace(/^[\-*•]\s+/, "")
      .replace(/\s+/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function stripDuplicateAdjacentDisplayLines(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let lastKey = "";
  let lastHeadingKey = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      lastKey = "";
      continue;
    }

    const normalized = normalizeDisplayLineForDedup(trimmed);
    const headingLike =
      isMajorSectionHeadingLine(trimmed) ||
      /^\*\*(.+?)\*\*:?\s*$/.test(trimmed);

    if (
      headingLike &&
      normalized &&
      (normalized === lastKey || normalized === lastHeadingKey)
    ) {
      continue;
    }

    out.push(line);
    lastKey = normalized;
    lastHeadingKey = headingLike ? normalized : "";
  }

  return out.join("\n").trim();
}

export function isStandaloneSeparatorLine(line) {
  const trimmed = textValue(line).trim();
  if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return false;
  return /^[-*_]{3,}$/.test(trimmed) || /^[-*_](?:\s*[-*_]){2,}$/.test(trimmed);
}

export function stripStandaloneSeparatorLines(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === "[PAGE_BREAK]") {
      out.push("[PAGE_BREAK]");
      continue;
    }
    if (isStandaloneSeparatorLine(trimmed)) continue;
    out.push(line);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removePageBreaksAfterHeadingOnly(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let segmentLines = [];

  for (const line of lines) {
    if (line.trim().toUpperCase() === "[PAGE_BREAK]") {
      if (!isHeadingOnlyReportBlock(segmentLines.join("\n"))) {
        out.push("[PAGE_BREAK]");
        segmentLines = [];
      }
      continue;
    }

    out.push(line);
    if (line.trim()) segmentLines.push(line);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isHeadingOnlyReportBlock(block) {
  const meaningfulLines = textValue(block)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (meaningfulLines.length === 0 || meaningfulLines.length > 3) return false;
  return meaningfulLines.every((line) => {
    if (line.toUpperCase() === "[PAGE_BREAK]") return true;
    return (
      isMajorSectionHeadingLine(line) ||
      /^#{1,6}\s+/.test(line) ||
      /^\*\*(.+?)\*\*:?\s*$/.test(line)
    );
  });
}

export function stripSupabaseReportLinks(content) {
  if (!content) return "";
  return String(content)
    .replace(/\[Tải\s+báo\s+cáo\s+tại\s+Supabase\].*?\n/gi, "")
    .replace(/\[Link\s+tải\s+báo\s+cáo\s+Supabase\].*?\n/gi, "");
}

export function ensurePageBreakBeforeConclusion(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (isMajorSectionHeadingLine(trimmed)) {
      const norm = normalizeMajorHeadingLine(trimmed);
      if (norm === "ket luan" || norm === "phan ket luan") {
        const lastMeaningful = out.slice().reverse().map(l => l.trim().toUpperCase()).find(l => l !== "") || "";
        if (out.length > 0 && lastMeaningful !== "[PAGE_BREAK]") {
          out.push("[PAGE_BREAK]");
        }
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

export function ensurePageBreakBeforeReferences(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (isReferenceHeadingLine(trimmed)) {
      const lastMeaningful = out.slice().reverse().map(l => l.trim().toUpperCase()).find(l => l !== "") || "";
      if (out.length > 0 && lastMeaningful !== "[PAGE_BREAK]") {
        out.push("[PAGE_BREAK]");
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

export function getReportTitleWithDownloadCounter() {
  if (typeof window === "undefined") return "Báo cáo hoàn chỉnh";
  try {
    const now = new Date();
    const dateKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
    const countKey = `report_download_count_${dateKey}`;
    let count = parseInt(localStorage.getItem(countKey) || "0", 10);
    if (count === 0) {
      count = 1;
      localStorage.setItem(countKey, "1");
    }
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `bc_${count}_${dd}_${mm}_${yyyy}`;
  } catch (e) {
    const now = new Date();
    return `bc_1_${String(now.getDate()).padStart(2, '0')}_${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;
  }
}

export function prepareReportContent(content, title = "", isDocx = false) {
  if (!content) return "";
  let cleanedContent = stripTrailingProseAfterSignature(content, title);
  cleanedContent = cleanedContent.replace(/\|\s*([^|]*?xác\s+nhận\s+của\s+cơ\s+quan[^|]*?)\s*\|/gi, "| **XÁC NHẬN CỦA CƠ QUAN**<br>*(Kí tên và đóng dấu)* |");

  if (shouldExcludeReferences(title, content)) {
    cleanedContent = cleanedContent.replace(/\[PAGE_BREAK\]\s*(?:#+\s*(?:danh\s+mục\s+)?tài\s+liệu\s+tham\s+khảo[\s\S]*)$/i, "");
    cleanedContent = cleanedContent.replace(/(?:#+\s*(?:danh\s+mục\s+)?tài\s+liệu\s+tham\s+khảo[\s\S]*)$/i, "");
  }

  const isBa49 = title.toLowerCase().includes("ba49") ||
    title.toLowerCase().includes("b49") ||
    title.toLowerCase().includes("kiến tập") ||
    content.toLowerCase().includes("ba49") ||
    content.toLowerCase().includes("b49") ||
    content.toLowerCase().includes("kiến tập");

  cleanedContent = cleanedContent
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return !isDocx;

      if (trimmed.startsWith("|") && trimmed.endsWith("|")) return true;
      if (trimmed.startsWith("```")) return true;
      if (/^[-*_]{3,}$/.test(trimmed)) return true;

      const cleanLine = trimmed
        .replace(/^[-*+•#\s|]+|[-*+•\s|]+$/g, "")
        .replace(/[\[\]()]/g, "")
        .trim();

      const hasAlphanumeric = /[a-zA-Z0-9\u00C0-\u1EF9]/u.test(cleanLine);
      if (!hasAlphanumeric) return false;

      const lower = cleanLine.toLowerCase();
      return lower !== "no text" &&
        lower !== "no_text" &&
        lower !== "notext" &&
        lower !== "no content" &&
        lower !== "no_content" &&
        lower !== "nocontent";
    })
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("###")) {
        return line.replace(/\*\*/g, "");
      }
      if (/^\s*(?:Bảng|BẢNG)\s+\d+(?:\.\d+)*[:.-]?\s+\S/i.test(trimmed)) {
        const cleanText = trimmed.replace(/^\*\*|\*\*$/g, "").trim();
        return `**${cleanText}**`;
      }
      if (/^\s*(?:Hình|HÌNH|Sơ đồ|SƠ ĐỒ|Biểu đồ|BIỂU ĐỒ)\s+\d+(?:\.\d+)*[:.-]?\s+\S/i.test(trimmed)) {
        const cleanText = trimmed.replace(/^\*|\*$/g, "").replace(/^\*\*|\*\*$/g, "").trim();
        return `*${cleanText}*`;
      }

      const isHeader = trimmed.startsWith("#");
      const isList = /^(?:[-*•+]|\d+[.)])\s/.test(trimmed);
      const isTable = trimmed.startsWith("|");
      const isCode = trimmed.startsWith("```");
      const isPageBreak = trimmed.toUpperCase() === "[PAGE_BREAK]";
      const isHtml = trimmed.startsWith("<");

      if (isHtml) return trimmed;
      if (!isHeader && !isList && !isTable && !isCode && !isPageBreak && !isHtml && trimmed) {
        if (/^[\t ]+/.test(line)) {
          return line.replace(/^[\t ]+/, "\t");
        }
      }
      return line;
    })
    .join("\n");

  if (isBa49 && !cleanedContent.includes("NHẬN XÉT KIẾN TẬP")) {
    const meta = extractMetadataFromContent(content, title);
    cleanedContent = cleanedContent.trim() + "\n" + generateEvaluationForm(meta);
  }

  const coverHtml = injectCoverPageFull(cleanedContent, title);
  let finalContent;
  if (cleanedContent.includes("TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI") || cleanedContent.includes("[LOGO_HOU]") || cleanedContent.includes("logo-hou.png") || cleanedContent.includes("cover-page-container")) {
    if (isBa49 && (cleanedContent.includes("TRUNG TÂM ĐÀO TẠO TRỰC TUYẾN") || !cleanedContent.includes("VIỆN ĐÀO TẠO VÀ PHÁT TRIỂN HỌC TẬP SUỐT ĐỜI"))) {
      const parts = cleanedContent.split("[PAGE_BREAK]");
      const remainingPart = parts.slice(1).join("[PAGE_BREAK]");
      finalContent = coverHtml.trim() + "\n\n" + remainingPart.trim();
    } else {
      finalContent = cleanedContent;
    }
  } else {
    finalContent = coverHtml.trim() ? (coverHtml.trim() + "\n\n" + cleanedContent) : cleanedContent;
  }

  finalContent = ensurePageBreakBeforeReferences(
    ensurePageBreakBeforeConclusion(
      removePageBreaksAfterHeadingOnly(
        normalizeNumberedHeadingLevels(
          normalizeMajorHeadingLevels(
            mergeDuplicateReferenceSections(
              stripDuplicateAdjacentDisplayLines(
                stripStandaloneSeparatorLines(stripSupabaseReportLinks(finalContent)),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  if (isDocx) {
    return finalContent.replace(/\n+/g, "\n");
  }

  finalContent = finalContent.replace(/\n{2,}/g, "\n\n");
  const lines = finalContent.split("\n");
  const processedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const prev = lines[i - 1];

    if (current.trim().startsWith("|") && current.trim().endsWith("|")) {
      if (prev !== undefined && !(prev.trim().startsWith("|") && prev.trim().endsWith("|")) && prev.trim() !== "") {
        processedLines.push("");
      }
    }
    processedLines.push(current);

    const next = lines[i + 1];
    if (current.trim().startsWith("|") && current.trim().endsWith("|")) {
      if (next !== undefined && !(next.trim().startsWith("|") && next.trim().endsWith("|")) && next.trim() !== "") {
        processedLines.push("");
      }
    }
  }
  return processedLines.join("\n");
}

export function isB49OpeningSection(section) {
  const reportContext = section?.reportContext || null;
  if (!reportContext?.internshipReport && !reportContext?.careerOrientationReport) return false;
  const normalizedTitle = normalizeForMatch(String(section?.title || ""));
  return /^\s*(?:loi mo dau|phan mo dau|mo dau|i phan mo dau)\b/.test(normalizedTitle);
}

export function stripTrailingProseAfterSignature(content, title) {
  if (!content) return "";
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let foundCutoff = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.toLowerCase().includes("bản nháp này được chuẩn bị") ||
      trimmed.toLowerCase().includes("báo cáo được tạo bởi") ||
      trimmed.toLowerCase().includes("trợ lý ai báo cáo")
    ) {
      foundCutoff = true;
    }
    if (!foundCutoff) {
      out.push(line);
    }
  }
  return out.join("\n").trim();
}

export function shouldExcludeReferences(title, content) {
  const normTitle = normalizeForMatch(title);
  if (normTitle.includes("ba49") || normTitle.includes("b49") || normTitle.includes("kiến tập")) return true;
  return false;
}

export function prepareReportContentForDocx(content, title = "") {
  const withPageBreaks = injectSectionPageBreaks(content);
  return prepareReportContent(withPageBreaks, title, true);
}
