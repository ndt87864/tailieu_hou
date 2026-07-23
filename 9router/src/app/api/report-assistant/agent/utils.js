export const REPORT_KNOWLEDGE_GLOBAL_USER = "global";
export const REPORT_OUTLINE_CONTENT_USER = `report_assistant_outlines_${REPORT_KNOWLEDGE_GLOBAL_USER}`;
export const REPORT_TEMPLATE_CONTENT_USER = `report_assistant_templates_${REPORT_KNOWLEDGE_GLOBAL_USER}`;

import {
  buildReportContext as buildCtx,
  reportContextPrompt as ctxPrompt,
  extractRequestedPages as reqPages
} from "./utils/contextHelpers";

export const buildReportContext = buildCtx;
export const reportContextPrompt = ctxPrompt;
export const extractRequestedPages = reqPages;

export function logAgentStep(stepName, details) {
  if (process.env.NODE_ENV !== "production") {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
    const detailStr = typeof details === "object" ? JSON.stringify(details, null, 2) : String(details);
    console.log(`\x1b[36m[AI Agent ${timestamp}]\x1b[0m \x1b[33m${stepName}\x1b[0m:`, detailStr);
  }
}

export function sanitizeReportDraftContent(content) {
  if (typeof content !== "string") return "";
  return content
    .replace(/^```markdown\s*/i, "")
    .replace(/^```txt\s*/i, "")
    .replace(/^```text\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hasSubstantiveDraftContent(content) {
  return /[a-zA-Z0-9\u00C0-\u1EF9]/u.test(String(content || ""));
}

export function sanitizeB49OpeningDraftContent(content) {
  const lines = String(content || "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  const firstSubsectionIdx = lines.findIndex((line) => {
    const trimmed = line.trim();
    return /^\s*(?:#{1,6}\s*)?\d+(?:\.\d+)+\.?\s+\S/.test(trimmed) || 
           /^\s*\*\*\d+(?:\.\d+)+\.?\s+/.test(trimmed);
  });

  if (firstSubsectionIdx < 0) return content;
  return lines.slice(firstSubsectionIdx).join("\n").trim();
}

export function shouldUseWebRagForSection(section, reportContext = null) {
  const normalized = normalizeOutlineMatchText(
    `${section?.title || ""} ${section?.description || ""} ${(section?.subsections || []).join(" ")}`,
  );

  if (!normalized) return false;
  if (isReferenceOnlySection(section) || isConclusionSection(section) || isOpeningSection(section)) {
    return false;
  }
  if (/\bket cau khoa luan|muc luc|loi cam on|loi mo dau\b/.test(normalized)) {
    return false;
  }

  return (
    reportContext?.financialAccounting ||
    /\b(thuc trang|phan tich|so lieu|bao cao|tai chinh|doanh thu|loi nhuan|hieu qua|2023|2024|2025)\b/.test(normalized) ||
    /\b(co so phap ly|quy dinh|van ban phap luat|phap luat hien hanh|luat)\b/.test(normalized)
  );
}

export function getLastCompletedYears(count = 3) {
  const endYear = new Date().getFullYear();
  return Array.from({ length: count }, (_, idx) => endYear - count + 1 + idx);
}

export function isFinancialAccountingSubject(text) {
  const normalized = normalizeOutlineMatchText(text);
  return /\b(tai chinh|ke toan|kiem toan|ngan hang|loi nhuan|doanh thu|chi phi|bctc|bao cao tai chinh|von|tai san|cong no|thanh khoan|sinh loi|roe|roa)\b/.test(normalized);
}

export function isLegalEconomicSubject(text) {
  const normalized = normalizeOutlineMatchText(text);
  return /\b(luat|phap luat|luat kinh te|kinh te luat|phap ly|hop dong|tranh chap|tu van phap luat|dich vu phap ly|to tung|tu phap|luat doanh nghiep|luat thuong mai|phap che)\b/.test(normalized);
}

export function extractTargetCompanyFromPrompt(prompt) {
  const text = cleanOutlineLine(prompt);
  const normalized = normalizeOutlineMatchText(text);
  const markers = [
    "cho cong ty ",
    "tai cong ty ",
    "cua cong ty ",
    "ve cong ty ",
    "cho doanh nghiep ",
    "tai doanh nghiep ",
    "cua doanh nghiep ",
    "cho thuong hieu ",
    "tai thuong hieu ",
    "cho chuoi ",
    "tai chuoi ",
  ];

  let start = -1;
  let markerLength = 0;
  for (const marker of markers) {
    const idx = normalized.lastIndexOf(marker);
    if (idx >= 0 && idx + marker.length > start) {
      start = idx + marker.length;
      markerLength = marker.length;
    }
  }

  if (start < 0 || markerLength === 0) return "";
  const candidate = text.slice(start).trim();
  const cleaned = candidate
    .replace(/\s+(?:dài|với|về|theo|trong|ngành|lĩnh vực)\b[\s\S]*$/i, "")
    .replace(/[.,;:]+$/g, "")
    .trim();
  return cleaned
    .split(/\s+/)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(" ");
}

export function inferStudyIssue(prompt, subject) {
  const normalized = normalizeOutlineMatchText(`${prompt || ""} ${subject || ""}`);
  const issueMap = [
    { test: /\bluat kinh te|kinh te luat|phap luat kinh te|phap ly kinh te|luat thuong mai|hop dong thuong mai|dich vu phap ly|cong ty luat\b/, value: "hoạt động pháp lý kinh tế và dịch vụ tư vấn pháp luật" },
    { test: /\bluat|phap luat|phap ly|hop dong|tranh chap|to tung|tu phap\b/, value: "hoạt động pháp lý và tuân thủ pháp luật" },
    { test: /\bnhan su|nguon nhan luc|hrm|lao dong\b/, value: "quản trị nguồn nhân lực" },
    { test: /\bmarketing|thuong hieu|truyen thong|ban hang online\b/, value: "hoạt động marketing" },
    { test: /\bban hang|doanh thu|kinh doanh|quan tri kinh doanh\b/, value: "hoạt động quản trị kinh doanh" },
    { test: /\btai chinh|ke toan|chi phi|loi nhuan\b/, value: "hiệu quả tài chính" },
    { test: /\bchuoi cung ung|kho|logistics|van hanh\b/, value: "hoạt động vận hành và chuỗi cung ứng" },
    { test: /\bbao cao tu dong|du lieu|dashboard|bi\b/, value: "ứng dụng báo cáo tự động trong quản trị kinh doanh" },
  ];
  return issueMap.find((item) => item.test.test(normalized))?.value || "vấn đề nghiên cứu theo chủ đề đã chọn";
}

export function isExplicitB49Report(text = "") {
  return /\b(?:ba49|b49)\b/i.test(String(text || ""));
}

export function isExplicitCareerOrientationReport(text = "") {
  return /\b(?:thuc tap dinh huong nghe nghiep|dinh huong nghe nghiep|career orientation|orient|sl06|sl07|el67)\b/i.test(
    String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
  );
}

export function adaptOutlineTitleToContext(title, reportContext) {
  if (!reportContext) return title;
  const issue = reportContext.studyIssue || "vấn đề nghiên cứu";
  const company = reportContext.targetCompany || "đơn vị được yêu cầu";

  const escapedIssue = issue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return cleanOutlineLine(title)
    .replace(/\([^)]*SV[^)]*\)/gi, "")
    .replace(/\((?:nếu có|neu co)\)/gi, "")
    .replace(/\b(?:vấn đề|van de)\s+(?:nghiên cứu|nghien cuu)\b/gi, issue)
    .replace(/\b(?:đơn vị|don vi)\b/gi, company)
    .replace(/\b[Tt]ại\s*…/g, `tại ${company}`)
    .replace(/\b[Tt]ại\s*\.\.\./g, `tại ${company}`)
    .replace(/…+/g, issue)
    .replace(/\.{3,}/g, issue)
    .replace(new RegExp(`${escapedIssue}\\s+${escapedIssue}`, "gi"), issue)
    .replace(new RegExp(`tại\\s+${escapedIssue}`, "gi"), `tại ${company}`)
    .replace(/\s+tại\s*$/i, ` tại ${company}`)
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseJsonBlock(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function arrayLines(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return Object.entries(item)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join("; ") : String(val || "")}`)
          .join(" | ");
      }
      return String(item || "").trim();
    }).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function formatTemplateStyleGuide(rawGuideText) {
  const parsed = parseJsonBlock(rawGuideText);
  if (!parsed || typeof parsed !== "object") {
    return String(rawGuideText || "").trim();
  }

  const sections = [
    ["Mẫu cấu trúc/bố cục", parsed.structure_patterns],
    ["Blueprint triển khai từng phần", parsed.section_blueprint],
    ["Bảng biểu, công thức và phép tính", parsed.tables_and_calculations],
    ["Sơ đồ/quy trình nên mô phỏng", parsed.diagram_patterns],
    ["Phong cách hành văn", parsed.writing_style],
    ["Trình bày/thẩm mỹ", parsed.visual_layout],
    ["Ranh giới không sao chép", parsed.anti_copy_rules || parsed.avoid_copying],
  ];

  return sections
    .map(([title, value]) => {
      const lines = arrayLines(value).slice(0, 8);
      return lines.length ? `### ${title}\n${lines.map((line) => `- ${line}`).join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function inferSectionTemplateExpectation(section, reportContext) {
  const normalized = normalizeOutlineMatchText(`${section?.title || ""} ${section?.description || ""}`);
  const expectations = [];

  if (/mo dau|tong quan/.test(normalized)) {
    expectations.push("Triển khai phần mở đầu theo logic báo cáo mẫu: lý do chọn đề tài -> mục tiêu -> đối tượng/phạm vi -> phương pháp -> kết cấu báo cáo.");
  }
  if (/co so ly luan|ly thuyet|khai niem|chi tieu/.test(normalized)) {
    expectations.push("Phần lý luận phải đi từ khái niệm, vai trò, hệ thống chỉ tiêu/công thức, nhân tố ảnh hưởng; không kể chuyện chung chung.");
  }
  if (/thuc trang|dac diem|gioi thieu/.test(normalized)) {
    expectations.push("Giới thiệu thực tế doanh nghiệp phải khớp với thông tin thật: cơ cấu tổ chức, quy trình phòng ban.");
  }
  if (/ket luan|kien nghi|giai phap/.test(normalized)) {
    expectations.push("Đưa ra giải pháp trực tiếp cho rủi ro thực tế được phân tích ở chương trước.");
  }
  return expectations.join(" ");
}

export function cleanOutlineLine(line) {
  return String(line || "")
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[\s\-\*\•\d\.\)\(ivxlcdmIVXLCDM]+[:.]?\s+/, "")
    .trim();
}

export function removeVietnameseTones(str) {
  if (typeof str !== "string") return "";
  let s = str;
  s = s.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  s = s.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  s = s.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  s = s.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  s = s.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  s = s.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  s = s.replace(/đ/g, "d");
  s = s.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  s = s.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  s = s.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  s = s.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  s = s.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  s = s.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  s = s.replace(/Đ/g, "D");
  s = s.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  s = s.replace(/\u02C6|\u0306|\u031B/g, "");
  return s;
}

export function normalizeOutlineMatchText(str) {
  return removeVietnameseTones(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isReferenceOnlySection(section) {
  const normalized = normalizeOutlineMatchText(section?.title || section || "");
  return (
    /^(?:\d+(?:\.\d+)*\.?\s*)?(?:tai lieu tham khao|references?|thu muc tai lieu)\b/.test(normalized) ||
    section?.is_reference_section === true
  );
}

export function isPresentationGuidelineHeading(line) {
  const normalized = normalizeOutlineMatchText(line);
  return /^(?:\d+(?:\.\d+)*\.?\s*)?(?:ngon ngu de viet|hinh thuc trinh bay|muc luc va tieu muc|viet tat|phu luc cua|cach trich dan|tai lieu tham khao|trinh bay bang bieu|trinh bay phuong trinh|cau truc do an|cau truc khoa luan|bo giao duc|truong dai hoc|phu luc)\b/.test(normalized);
}

export function isOutlineHeading(line) {
  const text = cleanOutlineLine(line);
  const normalized = normalizeOutlineMatchText(text);
  if (!text) return false;
  if (/^\[.*\]$/.test(text)) return false;
  if (isPresentationGuidelineHeading(text)) return false;
  if (/\b(msv|sv|lop)\b/.test(normalized) && /\.{3,}/.test(text)) return false;
  if (/^ket cau\b/.test(normalized)) return false;
  if (/^ngoai\s+muc\s+luc\b/.test(normalized)) return false;
  if (/^phan\s+(mo dau|ket luan|ket thuc)/.test(normalized)) return true;
  if (/^chuong\s+[\divxlcdm]+[\s:.]/.test(normalized)) return true;
  return /^\d+(?:\.\d+)*\.?\s*(?![\/.-])\S/.test(text);
}

export function sanitizeOutlineSubsections(subsections) {
  return (Array.isArray(subsections) ? subsections : [])
    .map(cleanOutlineLine)
    .filter((line) => isOutlineHeading(line));
}

export function stripOutlineNumberPrefix(line) {
  return cleanOutlineLine(line)
    .replace(/^(?:\d+(?:\.\d+)*|[IVXLCDM]+)\.?\s*/i, "")
    .trim();
}

export function isOpeningSection(section) {
  const title = typeof section === "string" ? section : (section?.title || "");
  const normalized = normalizeOutlineMatchText(title);

  if (/^\s*\d+\.\d+/.test(normalized)) {
    return false;
  }

  if (section && typeof section === "object") {
    if (section.parent_id || (section.level && section.level > 1)) {
      return false;
    }
  }

  return /^\s*(?:\d+\.|[ivxlcdm]+\.)?\s*(?:loi\s+mo\s+dau|phan\s+mo\s+dau|mo\s+dau|i\s+phan\s+mo\s+dau|dat\s+van\s+de)\b/.test(normalized);
}

export function isB49OpeningSection(section) {
  return isOpeningSection(section) && isInternshipB49ReportSection(section);
}

export function isConclusionSection(section) {
  const normalized = normalizeOutlineMatchText(section?.title || section || "");
  return /\b(ket luan|ket thuc|iii\. ket luan)\b/.test(normalized) && !/\bchuong\b/.test(normalized);
}

export function isInternshipB49ReportSection(section) {
  const text = normalizeOutlineMatchText(
    `${section?.title || ""} ${section?.description || ""} ${Array.isArray(section?.subsections) ? section.subsections.join(" ") : ""}`,
  );
  return (
    !!section?.reportContext?.internshipReport ||
    isExplicitB49Report(text)
  );
}

export function isCareerOrientationReportSection(section) {
  if (isInternshipB49ReportSection(section)) return false;
  const text = normalizeOutlineMatchText(
    `${section?.title || ""} ${section?.description || ""} ${Array.isArray(section?.subsections) ? section.subsections.join(" ") : ""}`,
  );
  return (
    !!section?.reportContext?.careerOrientationReport ||
    isExplicitCareerOrientationReport(text)
  );
}

export function calculateTargetWordsForSection(item, totalWords, contentSections) {
  if (isReferenceOnlySection(item)) return 0;
  if (!totalWords || totalWords <= 0) return Math.round(1000 * 1.35);

  const isB49Report = isInternshipB49ReportSection(item);
  const isCareerReport = isCareerOrientationReportSection(item);
  const introTarget = (isB49Report || isCareerReport)
    ? Math.max(80, Math.min(140, Math.round(totalWords * 0.015)))
    : Math.max(500, Math.min(800, Math.round(totalWords * 0.08)));
  const concTarget = (isB49Report || isCareerReport)
    ? Math.max(250, Math.min(400, Math.round(totalWords * 0.04)))
    : Math.max(300, Math.min(500, Math.round(totalWords * 0.05)));

  let result = 1000;
  if (isOpeningSection(item)) {
    result = introTarget;
  } else if (isConclusionSection(item)) {
    result = concTarget;
  } else if ((isB49Report || isCareerReport) && item?.level >= 3) {
    result = Math.max(250, Math.min(800, Math.round(totalWords * 0.035)));
  } else {
    const mainSections = contentSections.filter((s) => !isOpeningSection(s) && !isConclusionSection(s));
    const remainingWords = Math.max(1000, totalWords - introTarget - concTarget);
    result = mainSections.length ? Math.round(remainingWords / mainSections.length) : 1500;
  }

  return Math.round(result * 1.35);
}

export function getChapterNumber(section, fallbackNumber) {
  const normalized = normalizeOutlineMatchText(section?.title || section || "");
  const match = normalized.match(/\bchuong\s+(\d+|[ivxlcdm]+)\b/i);
  if (!match) return fallbackNumber;
  const raw = match[1].toLowerCase();
  const roman = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  return Number(raw) || roman[raw] || fallbackNumber;
}

export function isUsableParsedOutline(outline) {
  const items = Array.isArray(outline) ? outline : [];
  if (items.length < 2) return false;

  const joined = items
    .flatMap((item) => [item?.title, ...(Array.isArray(item?.subsections) ? item.subsections : [])])
    .filter(Boolean)
    .map(normalizeOutlineMatchText)
    .join(" ");

  if (!joined) return false;

  const hasReportStructure =
    /\b(chuong|phan|mo dau|tong quan|co so ly thuyet|co so ly luan|thuc trang|phan tich|giai phap|kien nghi|ket luan)\b/.test(joined);
  const guidelineHits = [
    "ngon ngu de viet",
    "hinh thuc trinh bay",
    "muc luc va tieu muc",
    "viet tat",
    "phu luc cua",
    "cach trich dan",
    "trinh bay bang bieu",
  ].filter((term) => joined.includes(term)).length;

  return hasReportStructure && guidelineHits < Math.max(2, Math.ceil(items.length / 2));
}

export function safeParseJson(jsonString, fallback = null) {
  try {
    const cleaned = String(jsonString || "").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    if (!cleaned) return fallback;
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("JSON parse failed, using fallback:", err.message);
    return fallback;
  }
}

/**
 * Hậu kiểm chất lượng nội dung đã soạn thảo
 * @param {string} content - Nội dung văn bản
 * @param {Object} section - Thông tin mục đang viết
 * @param {Object} reportContext - Thông tin ngữ cảnh báo cáo
 * @returns {{ valid: boolean, reason: string }} Kết quả hậu kiểm
 */
export function validateDraftQuality(content, section, reportContext) {
  if (!content || typeof content !== "string") {
    return { valid: false, reason: "Nội dung trống rỗng." };
  }

  const wordCount = content.trim().split(/\s+/).length;
  const targetWords = section.target_words || 0;
  
  // 1. Kiểm tra độ dài tối thiểu (đạt ít nhất 55% target words, ngoại trừ kết luận và mở đầu ngắn)
  const isShortSection = isOpeningSection(section) || isConclusionSection(section);
  const minPercent = isShortSection ? 0.4 : 0.55;
  if (targetWords > 0 && wordCount < targetWords * minPercent) {
    return { 
      valid: false, 
      reason: `Nội dung quá ngắn (${wordCount} từ), chưa đạt mục tiêu tối thiểu là ${Math.round(targetWords * minPercent)} từ (mục tiêu đầy đủ ${targetWords} từ). Hãy viết chi tiết và sâu sắc hơn.` 
    };
  }

  // 2. Kiểm tra sự hiện diện của bảng biểu và sơ đồ cho tài chính/kế toán/pháp lý thực tế
  if (!isShortSection && !reportContext?.careerOrientationReport) {
    if (reportContext?.financialAccounting) {
      const hasTable = content.includes("|");
      if (!hasTable) {
        return {
          valid: false,
          reason: "Thiếu bảng phân tích số liệu tài chính hoặc bảng so sánh (bắt buộc phải có dạng bảng biểu Markdown với các cột năm tương ứng)."
        };
      }
    }
  }

  // 3. Kiểm tra sơ đồ Mermaid bắt buộc cho các tiểu mục quy trình của báo cáo BA49
  const diagramCheck = validateB49MermaidRequirement(content, section, reportContext);
  if (!diagramCheck.valid) {
    return diagramCheck;
  }

  return { valid: true, reason: "" };
}

/**
 * Danh sách tiểu mục BA49 bắt buộc phải có sơ đồ Mermaid (flowchart) theo prompt promptsB49.
 * Khóa là số thứ tự phân cấp của tiểu mục, giá trị là mô tả loại sơ đồ cần vẽ.
 */
const B49_REQUIRED_DIAGRAM_SECTIONS = {
  "1.1.2": "sơ đồ quy trình sản xuất - kinh doanh dạng Mermaid `flowchart TD`",
  "1.3.1": "sơ đồ cơ cấu tổ chức bộ máy dạng Mermaid `flowchart TD`",
  "1.3.2": "sơ đồ cơ cấu tổ chức bộ máy dạng Mermaid `flowchart TD`",
  "1.4.2": "sơ đồ luồng Mermaid `flowchart TD` cho từng quy trình quản trị (nhân sự, tài chính, truyền thông, công nghệ)",
};

/**
 * Trích số thứ tự phân cấp (vd "1.4.2") từ tiêu đề tiểu mục.
 * @param {Object|string} section - Mục đang xét
 * @returns {string} Số thứ tự phân cấp hoặc chuỗi rỗng nếu không tìm thấy
 */
function extractSectionNumber(section) {
  const title = typeof section === "string" ? section : (section?.title || "");
  const match = cleanOutlineLine(title).match(/^\s*#{0,6}\s*\*{0,2}\s*(\d+(?:\.\d+)+)/);
  return match ? match[1] : "";
}

/**
 * Đếm số sơ đồ Mermaid (flowchart/graph) trong nội dung.
 * Ưu tiên đếm theo số khối ```mermaid; nếu không có khối rào thì đếm số khai báo flowchart/graph.
 * @param {string} content - Nội dung văn bản đã soạn
 * @returns {number}
 */
function countMermaidDiagrams(content) {
  const text = String(content || "");
  const fencedBlocks = text.match(/```\s*mermaid[\s\S]*?```/gi);
  if (fencedBlocks && fencedBlocks.length > 0) {
    return fencedBlocks.length;
  }
  const declarations = text.match(/\b(?:flowchart|graph)\s+(?:TD|TB|LR|RL|BT)\b/gi);
  return declarations ? declarations.length : 0;
}

/**
 * Số sơ đồ tối thiểu bắt buộc cho một tiểu mục BA49 nhất định.
 * Mục 1.4.2 cần một sơ đồ cho từng quy trình quản trị (nhân sự, tài chính, truyền thông, công nghệ).
 */
const B49_MIN_DIAGRAM_COUNT = {
  "1.4.2": 4,
};

/**
 * Hậu kiểm yêu cầu sơ đồ Mermaid cho các tiểu mục quy trình của báo cáo BA49.
 * @param {string} content - Nội dung văn bản đã soạn
 * @param {Object} section - Thông tin mục đang viết
 * @param {Object} reportContext - Thông tin ngữ cảnh báo cáo
 * @returns {{ valid: boolean, reason: string }}
 */
function validateB49MermaidRequirement(content, section, reportContext) {
  const isB49 = !!reportContext?.internshipReport || isInternshipB49ReportSection(section);
  if (!isB49) return { valid: true, reason: "" };

  const sectionNumber = extractSectionNumber(section);
  const requirement = B49_REQUIRED_DIAGRAM_SECTIONS[sectionNumber];
  if (!requirement) return { valid: true, reason: "" };

  const diagramCount = countMermaidDiagrams(content);
  const minCount = B49_MIN_DIAGRAM_COUNT[sectionNumber] || 1;

  if (diagramCount < minCount) {
    const base = `Tiểu mục ${sectionNumber} bắt buộc phải có ${requirement}.`;
    const detail = minCount > 1
      ? ` Hiện chỉ phát hiện ${diagramCount} sơ đồ nhưng cần tối thiểu ${minCount} sơ đồ Mermaid riêng biệt (mỗi quy trình quản trị một khối \`\`\`mermaid với flowchart TD riêng), kèm chú thích "Sơ đồ ${sectionNumber}.x: ..." in nghiêng và đoạn thuyết minh chi tiết dưới mỗi sơ đồ.`
      : ` Bắt buộc phải có sơ đồ Mermaid (khối \`\`\`mermaid với flowchart TD) kèm chú thích "Sơ đồ ${sectionNumber}: ..." in nghiêng ngay bên dưới và đoạn thuyết minh chi tiết cho sơ đồ.`;
    return { valid: false, reason: `${base}${detail}` };
  }

  return { valid: true, reason: "" };
}
