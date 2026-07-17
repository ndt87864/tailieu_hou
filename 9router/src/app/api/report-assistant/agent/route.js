import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { makeKv } from "@/lib/db/helpers/kvStore";
import { getApiKeys } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { getResourceUsername, getApiKeyIndexForUser } from "@/lib/userResourceMapping";
import * as prompts from "./prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const agentStore = makeKv("report_agent_states");
const CLI_TOKEN_SALT = "9r-cli-auth";
const REPORT_LLM_TIMEOUT_MS = Number.parseInt(process.env.REPORT_AGENT_LLM_TIMEOUT_MS || "240000", 10);
const REPORT_LLM_MAX_ATTEMPTS = Number.parseInt(process.env.REPORT_AGENT_LLM_MAX_ATTEMPTS || "1", 10);
const REPORT_MAX_COMBO_MODELS = Number.parseInt(process.env.REPORT_AGENT_MAX_COMBO_MODELS || "2", 10);
const REPORT_MAX_ACCOUNT_FALLBACKS = Number.parseInt(process.env.REPORT_AGENT_MAX_ACCOUNT_FALLBACKS || "2", 10);
const REPORT_ENABLE_CRITIC = String(process.env.REPORT_AGENT_ENABLE_CRITIC || "false").toLowerCase() === "true";
const REPORT_RAG_FETCH_TIMEOUT_MS = Number.parseInt(process.env.REPORT_AGENT_RAG_FETCH_TIMEOUT_MS || "15000", 10);
let reportAgentStateTableUnavailable = false;

/**
 * Lấy API key nội bộ tương ứng với từng tài khoản.
 * Mỗi tài khoản (Minh, Trang, Thu, Thủy, Nga) dùng đúng 1 key riêng theo thứ tự.
 * @param {string} [rawUsername] - username gốc của người dùng (chưa map)
 */
async function getInternalApiKey(rawUsername) {
  try {
    const keys = await getApiKeys();
    const activeKeys = keys.filter((key) => key.isActive !== false);
    if (!activeKeys.length) return null;

    // Xác định index key theo username
    const keyIndex = getApiKeyIndexForUser(rawUsername);

    // Nếu tìm được mapping và có đủ key theo index → dùng key đó
    if (keyIndex >= 0 && keyIndex < activeKeys.length) {
      return activeKeys[keyIndex].key;
    }

    // Fallback: dùng key active đầu tiên
    return activeKeys[0].key;
  } catch {
    return null;
  }
}

function getBaseUrl(request = null) {
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
    } catch {}
  }

  // Priority order for base URL detection:
  // 1. Server-side BASE_URL (preferred for internal API calls)
  // 2. NEXT_PUBLIC_BASE_URL (fallback, works client and server)
  // 3. NEXT_PUBLIC_APP_URL (alternative naming)
  // 4. VERCEL_URL (Vercel deployment)
  // 5. Localhost for development
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
  // Fallback to localhost for development
  return "http://localhost:3000";
}

const REPORT_KNOWLEDGE_GLOBAL_USER = "global";
const REPORT_OUTLINE_CONTENT_USER = `report_assistant_outlines_${REPORT_KNOWLEDGE_GLOBAL_USER}`;
const REPORT_TEMPLATE_CONTENT_USER = `report_assistant_templates_${REPORT_KNOWLEDGE_GLOBAL_USER}`;

function getLastCompletedYears(count = 3) {
  const endYear = new Date().getFullYear() - 1;
  return Array.from({ length: count }, (_, idx) => endYear - count + 1 + idx);
}

function isFinancialAccountingSubject(text) {
  const normalized = normalizeOutlineMatchText(text);
  return /\b(tai chinh|ke toan|kiem toan|ngan hang|loi nhuan|doanh thu|chi phi|bctc|bao cao tai chinh|von|tai san|cong no|thanh khoan|sinh loi|roe|roa)\b/.test(normalized);
}

function isLegalEconomicSubject(text) {
  const normalized = normalizeOutlineMatchText(text);
  return /\b(luat|phap luat|luat kinh te|kinh te luat|phap ly|hop dong|doanh nghiep|thuong mai|tranh chap|tu van phap luat|dich vu phap ly|to tung|tu phap)\b/.test(normalized);
}

function extractTargetCompanyFromPrompt(prompt) {
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

function extractRequestedPages(prompt) {
  const match = String(prompt || "").match(/(\d+)\s*(?:trang|pages?)/i);
  const pages = match ? Number(match[1]) : 0;
  return Number.isFinite(pages) && pages > 0 ? pages : 0;
}

function inferStudyIssue(prompt, subject) {
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

function buildReportContext(userPrompt, subject, outlineSource) {
  const requestedPages = extractRequestedPages(userPrompt);
  const targetCompany = extractTargetCompanyFromPrompt(userPrompt) || "đơn vị được yêu cầu";
  const studyIssue = inferStudyIssue(userPrompt, `${subject || ""} ${outlineSource || ""}`);
  const reportTitle = `Khóa luận tốt nghiệp về ${studyIssue} tại ${targetCompany}`;
  const analysisYears = getLastCompletedYears(3);
  const financialAccounting = isFinancialAccountingSubject(`${userPrompt || ""} ${subject || ""} ${outlineSource || ""} ${studyIssue}`);
  const legalEconomic = isLegalEconomicSubject(`${userPrompt || ""} ${subject || ""} ${outlineSource || ""} ${studyIssue}`);

  return {
    userPrompt: String(userPrompt || "").trim(),
    subject: subject || "",
    outlineSource: outlineSource || "",
    targetCompany,
    studyIssue,
    reportTitle,
    requestedPages,
    targetWords: requestedPages ? requestedPages * 350 : 5000,
    analysisYears,
    analysisYearLabel: analysisYears.join(", "),
    financialAccounting,
    legalEconomic,
  };
}

function adaptOutlineTitleToContext(title, reportContext) {
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

function reportContextPrompt(reportContext, sectionCount = 1) {
  if (!reportContext) return "";
  const targetWords = reportContext.targetWords || 0;
  const sectionTarget = targetWords && sectionCount
    ? Math.max(450, Math.round(targetWords / Math.max(sectionCount, 1)))
    : 0;

  return [
    "YÊU CẦU GỐC CỦA NGƯỜI DÙNG - BẮT BUỘC TUÂN THỦ:",
    `- Yêu cầu: ${reportContext.userPrompt || "Không rõ"}`,
    `- Đề tài thực tế: ${reportContext.reportTitle}`,
    `- Đơn vị nghiên cứu: ${reportContext.targetCompany}`,
    `- Vấn đề nghiên cứu: ${reportContext.studyIssue}`,
    `- Giai đoạn số liệu bắt buộc: ${reportContext.analysisYearLabel || getLastCompletedYears(3).join(", ")}. Không dùng số liệu năm hiện tại vì năm hiện tại chưa kết thúc.`,
    reportContext.requestedPages ? `- Độ dài mục tiêu: khoảng ${reportContext.requestedPages} trang (~${targetWords} từ).` : "",
    sectionTarget ? `- Mục hiện tại nên viết khoảng ${sectionTarget} từ nếu không có chỉ dẫn khác.` : "",
    "- Đề cương Supabase chỉ là khung cấu trúc; không được giữ placeholder như '[Tên đơn vị]', 'đơn vị', 'vấn đề nghiên cứu', 'ABC'.",
    "- Báo cáo mẫu chỉ dùng để tham khảo văn phong/định dạng; tuyệt đối không lấy công ty, đề tài hoặc số liệu của báo cáo mẫu thay cho yêu cầu người dùng.",
    reportContext.financialAccounting
      ? "- Môn/chủ đề tài chính, kế toán, ngân hàng: bắt buộc có bảng số liệu 3 năm, công thức/phép tính chỉ tiêu, nhận xét sau bảng và sơ đồ/quy trình minh họa phù hợp. Nếu không có đủ số liệu từ web/tài liệu, hãy lập số liệu phân tích logic cho đúng giai đoạn 3 năm bắt buộc và trình bày như dữ liệu phân tích chính thức; tuyệt đối không chèn chú thích kiểu \"số liệu mô phỏng\", \"ước tính\", \"tham khảo\"."
      : "",
    reportContext.legalEconomic
      ? "- Môn/chủ đề luật kinh tế/pháp lý: bắt buộc xoay quanh cơ sở pháp lý, quy định hiện hành, thực trạng áp dụng tại đơn vị, rủi ro pháp lý, hợp đồng/tuân thủ/tranh chấp nếu phù hợp và giải pháp pháp lý. Không được chuyển sang quản trị kinh doanh, marketing hoặc tài chính nếu người dùng không yêu cầu."
      : "",
    reportContext.templateStyleGuide
      ? `\nQUY TẮC ĐÃ HỌC TỪ BÁO CÁO MẪU CHẤT LƯỢNG CAO - BẮT BUỘC NOI THEO HỢP LÝ, KHÔNG SAO CHÉP:\n${reportContext.templateStyleGuide}`
      : "",
  ].filter(Boolean).join("\n");
}

function parseJsonBlock(rawText) {
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

function arrayLines(value) {
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

function formatTemplateStyleGuide(rawGuideText) {
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

function inferSectionTemplateExpectation(section, reportContext) {
  const normalized = normalizeOutlineMatchText(`${section?.title || ""} ${section?.description || ""}`);
  const expectations = [];

  if (/mo dau|tong quan/.test(normalized)) {
    expectations.push("Triển khai phần mở đầu theo logic báo cáo mẫu: lý do chọn đề tài -> mục tiêu -> đối tượng/phạm vi -> phương pháp -> kết cấu báo cáo.");
  }
  if (/co so ly luan|ly thuyet|khai niem|chi tieu/.test(normalized)) {
    expectations.push("Phần lý luận phải đi từ khái niệm, vai trò, hệ thống chỉ tiêu/công thức, nhân tố ảnh hưởng; không kể chuyện chung chung.");
  }
  if (/phap ly|phap luat|luat|hop dong|tu van|tranh chap|tuan thu/.test(normalized)) {
    expectations.push("Phần luật/pháp lý phải nêu cơ sở pháp lý, nguyên tắc áp dụng, đối tượng điều chỉnh, quyền-nghĩa vụ/rủi ro và ví dụ tình huống tại đơn vị.");
  }
  if (/thuc trang|phan tich|danh gia|hieu qua|tai chinh|ke toan|ngan hang/.test(normalized)) {
    expectations.push("Phần phân tích phải có bảng, công thức/phép tính, nhận xét sau bảng và liên hệ trực tiếp với đơn vị nghiên cứu.");
  }
  if (/giai phap|kien nghi|de xuat/.test(normalized)) {
    expectations.push("Giải pháp phải bám vào hạn chế/nguyên nhân đã phân tích, có điều kiện thực hiện, tác động kỳ vọng và thứ tự ưu tiên.");
  }
  if (/ket luan|tai lieu tham khao|phu luc/.test(normalized)) {
    expectations.push("Phần kết luận/tài liệu tham khảo trình bày gọn, tổng hợp kết quả chính và giữ đúng chuẩn trích dẫn của báo cáo mẫu.");
  }
  if (reportContext?.financialAccounting) {
    expectations.push(`Với tài chính/kế toán/ngân hàng, số liệu chỉ dùng ${reportContext.analysisYearLabel || getLastCompletedYears(3).join(", ")}; bảng phân tích phải có công thức và nhận xét định lượng.`);
  }
  if (reportContext?.legalEconomic) {
    expectations.push("Với luật kinh tế, luôn ưu tiên căn cứ pháp luật hiện hành, thực trạng áp dụng tại đơn vị, rủi ro pháp lý, quy trình tuân thủ và kiến nghị hoàn thiện; không dùng khung quản trị kinh doanh làm trục chính.");
  }

  return expectations.join("\n");
}

function cleanOutlineLine(line) {
  return String(line || "")
    .replace(/^\uFEFF/, "")
    .replace(/^(?:dòng|dong)\s+\d+\s*:\s*/i, "")
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeReportDraftContent(content) {
  return String(content || "")
    .replace(/\s*\((?:Số liệu|Dữ liệu)\s+(?:mô phỏng|ước tính|tham khảo)[^)]{0,160}\)/gi, "")
    .replace(/\s*\((?:So lieu|Du lieu)\s+(?:mo phong|uoc tinh|tham khao)[^)]{0,160}\)/gi, "")
    .replace(/^\s*(?:Ghi chú|Lưu ý|Chú thích)\s*:\s*(?:Số liệu|Dữ liệu)\s+(?:mô phỏng|ước tính|tham khảo)[^\n]*(?:\n|$)/gim, "")
    .replace(/^\s*(?:Ghi chu|Luu y|Chu thich)\s*:\s*(?:So lieu|Du lieu)\s+(?:mo phong|uoc tinh|tham khao)[^\n]*(?:\n|$)/gim, "")
    .replace(/^\s*(?:Số liệu|Dữ liệu)\s+(?:mô phỏng|ước tính|tham khảo)[^\n]*(?:\n|$)/gim, "")
    .replace(/^\s*(?:So lieu|Du lieu)\s+(?:mo phong|uoc tinh|tham khao)[^\n]*(?:\n|$)/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeOutlineMatchText(line) {
  return cleanOutlineLine(line)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

// Returns true when a section is a references/bibliography list only - should not count toward word targets
function isReferenceOnlySection(titleOrSection) {
  const text = typeof titleOrSection === "string" ? titleOrSection : (titleOrSection?.title || "");
  const normalized = normalizeOutlineMatchText(text);
  return (
    /\btai lieu tham khao\b/.test(normalized) ||
    /\bdanh muc tai lieu tham khao\b/.test(normalized) ||
    /\bbibliograph/.test(normalized) ||
    /\breferences?\b/.test(normalized)
  );
}

function shouldUseWebRagForSection(section, reportContext = null) {
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

function isPresentationGuidelineHeading(line) {
  const normalized = normalizeOutlineMatchText(line);
  return /^(?:\d+(?:\.\d+)*\.?\s*)?(?:ngon ngu de viet|hinh thuc trinh bay|muc luc va tieu muc|viet tat|phu luc cua|cach trich dan|tai lieu tham khao|trinh bay bang bieu|trinh bay phuong trinh|cau truc do an|cau truc khoa luan|bo giao duc|truong dai hoc|phu luc)\b/.test(normalized);
}

function isOutlineHeading(line) {
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

function sanitizeOutlineSubsections(subsections) {
  return (Array.isArray(subsections) ? subsections : [])
    .map(cleanOutlineLine)
    .filter((line) => isOutlineHeading(line));
}

function stripOutlineNumberPrefix(line) {
  return cleanOutlineLine(line)
    .replace(/^(?:\d+(?:\.\d+)*|[IVXLCDM]+)\.?\s*/i, "")
    .trim();
}

function isOpeningSection(section) {
  const normalized = normalizeOutlineMatchText(section?.title || section || "");
  return /\b(mo dau|phan mo dau|loi mo dau|dat van de)\b/.test(normalized);
}

function isConclusionSection(section) {
  const normalized = normalizeOutlineMatchText(section?.title || section || "");
  return /\b(ket luan|ket thuc)\b/.test(normalized) && !/\bchuong\b/.test(normalized);
}

function getChapterNumber(section, fallbackNumber) {
  const normalized = normalizeOutlineMatchText(section?.title || section || "");
  const match = normalized.match(/\bchuong\s+(\d+|[ivxlcdm]+)\b/i);
  if (!match) return fallbackNumber;
  const raw = match[1].toLowerCase();
  const roman = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  return Number(raw) || roman[raw] || fallbackNumber;
}

function normalizeOutlineNumbering(outline) {
  if (!Array.isArray(outline)) return [];
  let chapterIndex = 0;

  return outline.map((item, index) => {
    const section = { ...item };
    const subsections = sanitizeOutlineSubsections(section.subsections);

    if (isOpeningSection(section) || isConclusionSection(section) || isReferenceOnlySection(section)) {
      section.subsections = subsections.map((subsection, subsectionIndex) => (
        `${subsectionIndex + 1}. ${stripOutlineNumberPrefix(subsection)}`
      ));
      return section;
    }

    const normalizedTitle = normalizeOutlineMatchText(section.title || "");
    const isChapter = /\bchuong\b/.test(normalizedTitle) || /^\d+\.\d+/.test(subsections[0] || "");
    if (isChapter) {
      chapterIndex = getChapterNumber(section, chapterIndex + 1);
      section.subsections = subsections.map((subsection, subsectionIndex) => (
        `${chapterIndex}.${subsectionIndex + 1}. ${stripOutlineNumberPrefix(subsection)}`
      ));
      return section;
    }

    section.subsections = subsections.map((subsection, subsectionIndex) => (
      `${index + 1}.${subsectionIndex + 1}. ${stripOutlineNumberPrefix(subsection)}`
    ));
    return section;
  });
}

function normalizeReportOutlineSections(outline) {
  const normalized = normalizeOutlineNumbering(outline);
  const result = [];
  let referenceSection = null;
  let hasConclusion = false;

  for (const item of normalized) {
    if (isReferenceOnlySection(item)) {
      referenceSection = referenceSection || {
        ...item,
        title: "DANH M\u1ee4C T\u00c0I LI\u1ec6U THAM KH\u1ea2O",
        description: "Li\u1ec7t k\u00ea m\u1ed9t danh m\u1ee5c t\u00e0i li\u1ec7u tham kh\u1ea3o duy nh\u1ea5t \u1edf cu\u1ed1i b\u00e1o c\u00e1o.",
        subsections: [],
        is_reference_section: true,
      };
      continue;
    }
    if (isConclusionSection(item)) {
      hasConclusion = true;
    }
    result.push(item);
  }

  if (!hasConclusion) {
    const inheritedReportContext = normalized.find((item) => item?.reportContext)?.reportContext || null;
    result.push({
      id: "ket_luan",
      title: "K\u1ebeT LU\u1eacN",
      description: "T\u1ed5ng h\u1ee3p k\u1ebft qu\u1ea3 nghi\u00ean c\u1ee9u, \u0111\u00e1nh gi\u00e1 nh\u1eefng n\u1ed9i dung ch\u00ednh, n\u00eau \u00fd ngh\u0129a th\u1ef1c ti\u1ec5n v\u00e0 \u0111\u1ecbnh h\u01b0\u1edbng/ki\u1ebfn ngh\u1ecb ph\u00f9 h\u1ee3p v\u1edbi \u0111\u1ec1 c\u01b0\u01a1ng.",
      level: 1,
      subsections: [
        "1. T\u00f3m t\u1eaft k\u1ebft qu\u1ea3 nghi\u00ean c\u1ee9u",
        "2. \u00dd ngh\u0129a th\u1ef1c ti\u1ec5n v\u00e0 ki\u1ebfn ngh\u1ecb",
      ],
      is_conclusion_section: true,
      reportContext: inheritedReportContext,
    });
  }

  if (referenceSection) result.push(referenceSection);
  return result;
}

function outlineLevel(line) {
  const text = cleanOutlineLine(line);
  const normalized = normalizeOutlineMatchText(text);
  if (/^phan\s+/.test(normalized) || /^chuong\s+/.test(normalized)) return 1;
  const match = text.match(/^(\d+(?:\.\d+)*)\.?/);
  if (!match) return 1;
  return match[1].split(".").length + 1;
}

function parseOutlineKnowledge(outlineKnowledge, reportContext = null) {
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

function isUsableParsedOutline(outline) {
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

function normalizeAgentState(state) {
  if (!state) return state;

  if (Array.isArray(state.outline)) {
    state.outline = normalizeReportOutlineSections(state.outline);
  }

  let progress = Array.isArray(state.sections_progress) ? state.sections_progress : [];
  const normalizedProgress = normalizeReportOutlineSections(progress);
  if (normalizedProgress.length !== progress.length) {
    state.sections_progress = normalizedProgress;
    progress = state.sections_progress;
  }
  for (let index = 0; index < progress.length; index++) {
    const section = progress[index];
    const normalizedSection = normalizedProgress[index];
    if (normalizedSection?.subsections) {
      section.subsections = normalizedSection.subsections;
    }

    if (section.status === "drafting" && String(section.content || "").trim()) {
      section.status = "done";
      section.feedback = section.feedback || "Auto-normalized from stale drafting state.";
    }
  }

  if (
    state.current_step !== "CANCELLED" &&
    progress.length > 0 &&
    !progress.some((p) => p.status === "todo" || p.status === "drafting")
  ) {
    state.current_step = "COMPLETED";
  }

  return state;
}

function buildAgentActivity(phase, message, details = {}) {
  return {
    phase,
    message,
    details,
    updatedAt: new Date().toISOString(),
  };
}

function setAgentActivity(state, section, phase, message, details = {}) {
  const activity = buildAgentActivity(phase, message, details);
  if (state) state.current_activity = activity;
  if (section) {
    section.activity = activity;
    section.activity_history = [
      ...(Array.isArray(section.activity_history) ? section.activity_history : []),
      activity,
    ].slice(-8);
  }
  return activity;
}

async function getAgentState(chatId) {
  if (!reportAgentStateTableUnavailable) {
    try {
      // Try Supabase first
      const { data, error } = await supabase
        .from("report_agent_states")
        .select("*")
        .eq("chat_id", chatId)
        .single();

      if (!error && data) {
        return { source: "supabase", data };
      }
      if (error?.code && error.code !== "PGRST116") {
        reportAgentStateTableUnavailable = true;
        console.warn("[agent/route] Supabase report_agent_states query unavailable, using KV:", error.message);
      }
    } catch (err) {
      reportAgentStateTableUnavailable = true;
      console.warn("[agent/route] Supabase state query failed, using fallback:", err.message);
    }
  }

  // Fallback to SQLite kv
  const localData = await agentStore.get(chatId);
  if (localData) {
    return { source: "sqlite", data: localData };
  }
  return { source: "none", data: null };
}

async function saveAgentState(chatId, username, stateData) {
  const now = new Date().toISOString();
  const payload = {
    chat_id: chatId,
    username: username || "admin",
    current_step: stateData.current_step || "PLANNING",
    current_activity: stateData.current_activity || null,
    outline: stateData.outline || [],
    sections_progress: stateData.sections_progress || [],
    updated_at: now,
  };

  let savedSupabase = false;
  if (!reportAgentStateTableUnavailable) {
    try {
      const { error } = await supabase
        .from("report_agent_states")
        .upsert({ ...payload, created_at: now }, { onConflict: "chat_id" });

      if (!error) {
        savedSupabase = true;
      } else if (error.code === "PGRST204" || error.code === "23502" || error.message) {
        reportAgentStateTableUnavailable = true;
        console.warn("[agent/route] Supabase report_agent_states unavailable, using KV only:", error.message);
      }
    } catch (err) {
      reportAgentStateTableUnavailable = true;
      console.warn("[agent/route] Supabase state save failed, saving locally:", err.message);
    }
  }

  // Always save to SQLite as a local backup and primary local fallback
  await agentStore.set(chatId, {
    ...payload,
    id: chatId,
    created_at: now,
  });

  return { savedSupabase };
}

// Helper to sleep/pause
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function buildInternalFetchHeaders(authToken = null, contentType = null) {
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

function timeoutSignal(ms) {
  const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : REPORT_RAG_FETCH_TIMEOUT_MS;
  return AbortSignal.timeout(timeoutMs);
}

// Call local completions API with Exponential Backoff Retries for Rate Limits (429/503)
async function callLLM(modelId, messages, temperature = 0.3, authToken = null, rawUsername = null, baseUrlOverride = null) {
  const authContext = rawUsername;
  const maxAttempts = Number.isFinite(REPORT_LLM_MAX_ATTEMPTS) && REPORT_LLM_MAX_ATTEMPTS > 0 ? REPORT_LLM_MAX_ATTEMPTS : 1;
  let attempt = 0;
  let backoffMs = 2000; // Start with a 2s delay
  const timeoutMs = Number.isFinite(REPORT_LLM_TIMEOUT_MS) && REPORT_LLM_TIMEOUT_MS > 0 ? REPORT_LLM_TIMEOUT_MS : 240000;

  while (attempt < maxAttempts) {
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
      if (Number.isFinite(REPORT_MAX_ACCOUNT_FALLBACKS) && REPORT_MAX_ACCOUNT_FALLBACKS > 0) {
        headers["x-9r-max-account-fallbacks"] = String(REPORT_MAX_ACCOUNT_FALLBACKS);
      }

      if (authToken) {
        headers["Cookie"] = `auth_token=${authToken}`;
      }

      const res = await fetch(`${baseUrl}/api/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature,
          stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Handle Rate Limiting (429) or Server Overloaded (503)
      if (res.status === 429 || res.status === 503 || res.status === 504) {
        attempt++;
        const errText = await res.text().catch(() => "");
        if (attempt >= maxAttempts) {
          throw new Error(`LLM Error: ${res.status} - ${errText.slice(0, 500)}`);
        }
        const jitter = Math.floor(Math.random() * 1000);
        const sleepMs = Math.min(backoffMs, 5000) + jitter;
        console.warn(`[agent/route] LLM ${res.status}. Attempt ${attempt}/${maxAttempts}. Retrying in ${sleepMs}ms... ${errText.slice(0, 180)}`);
        await sleep(sleepMs);
        backoffMs *= 2; // Exponential backoff
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM Error: ${res.status} - ${errText}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) {
        console.error("[agent/route] callLLM failed after all attempts:", err);
        throw err;
      }
      const sleepMs = backoffMs + Math.floor(Math.random() * 1000);
      console.warn(`[agent/route] Connection error. Attempt ${attempt}/${maxAttempts}. Retrying in ${sleepMs}ms...`, err.message);
      await sleep(sleepMs);
      backoffMs *= 2;
    }
  }
  throw new Error("Failed to contact LLM after multiple retries due to quota limits / overloading.");
}

export async function POST(request) {
  try {
    const authToken = request.cookies.get("auth_token")?.value || null;
    const body = await request.json();
    const {
      action,
      chatId,
      username: rawUsername,
      subject,
      modelId,
      userPrompt,
      outline,
      feedback,
      outlineKnowledge,
      templateKnowledge,
      outlineSource,
      runId,
    } = body || {};

    // Map restricted users to resource owner (Minh)
    // This ensures Trang, Thu, Thủy, Nga use resources from Minh's account
    const username = getResourceUsername(rawUsername || "admin");
    const requestBaseUrl = getBaseUrl(request);

    if (!chatId) {
      return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
    }

    // Keep modelId if it exists (such as '1' which represents combo ID or actual model id)
    let targetModelId = modelId;
    if (modelId === "none" || !modelId) {
      targetModelId = "gemini-1.5-flash";
    }

    const { data: currentState } = await getAgentState(chatId);

    // ── ACTION: INITIALIZE (PLANNING & OUTLINING) ──
    if (action === "init") {
      if (!userPrompt || !modelId) {
        return NextResponse.json({ error: "Missing userPrompt or modelId for init" }, { status: 400 });
      }

      const reportContext = buildReportContext(userPrompt, subject, outlineSource);
      if (runId) {
        reportContext.runId = runId;
      }

      const outlineKnowledgeText = String(outlineKnowledge || "").trim();
      const templateKnowledgeText = String(templateKnowledge || "").trim();
      let parsedOutline = [];

      if (templateKnowledgeText) {
        const templateStudySystem = prompts.templateStudySystem;
        const templateStudyUser = prompts.getTemplateStudyUser(
          reportContextPrompt(reportContext, 4),
          templateKnowledgeText
        );

        try {
          const templateGuide = await callLLM(
            targetModelId,
            [
              { role: "system", content: templateStudySystem },
              { role: "user", content: templateStudyUser },
            ],
            0.2,
            authToken,
            rawUsername,
            requestBaseUrl,
          );
          reportContext.templateStyleGuide = formatTemplateStyleGuide(templateGuide).slice(0, 7000);
        } catch (templateGuideErr) {
          console.warn("Failed to analyze template style guide:", templateGuideErr.message);
        }
      }

      if (outlineKnowledgeText) {
        const interpretSystemPrompt = prompts.interpretSystemPrompt;
        const interpretUserPrompt = prompts.getInterpretUserPrompt(
          reportContextPrompt(reportContext, 4),
          subject,
          outlineSource,
          outlineKnowledgeText,
          templateKnowledgeText,
          reportContext.templateStyleGuide
        );

        try {
          const llmResult = await callLLM(
            targetModelId,
            [
              { role: "system", content: interpretSystemPrompt },
              { role: "user", content: interpretUserPrompt },
            ],
            0.25,
            authToken,
            rawUsername,
            requestBaseUrl,
          );
          const cleanedJson = llmResult.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
          parsedOutline = JSON.parse(cleanedJson);
        } catch (interpretErr) {
          console.warn("Failed to interpret outline knowledge with LLM, trying parser fallback:", interpretErr.message);
          parsedOutline = parseOutlineKnowledge(outlineKnowledgeText, reportContext);
        }

        if (!isUsableParsedOutline(parsedOutline)) {
          parsedOutline = [];
        }
      }

      // If the selected Supabase outline is unavailable or is only a formatting appendix,
      // fall back to LLM planning for the selected subject.
      if (parsedOutline.length === 0) {
        const outlineExample = reportContext.legalEconomic
          ? `[
  {
    "id": "1",
    "title": "Mở đầu",
    "description": "Lý do chọn đề tài, mục tiêu, đối tượng, phạm vi, phương pháp nghiên cứu và kết cấu báo cáo",
    "subsections": ["1. Lý do chọn đề tài", "2. Mục tiêu và nhiệm vụ nghiên cứu", "3. Đối tượng và phạm vi nghiên cứu", "4. Phương pháp nghiên cứu", "5. Kết cấu báo cáo"]
  },
  {
    "id": "2",
    "title": "Chương 1: Cơ sở lý luận và pháp lý về hoạt động pháp lý kinh tế",
    "description": "Khái niệm, đặc điểm, vai trò, căn cứ pháp luật và các tiêu chí đánh giá hoạt động pháp lý kinh tế/dịch vụ tư vấn pháp luật",
    "subsections": ["1.1. Khái niệm và đặc điểm của hoạt động pháp lý kinh tế", "1.2. Cơ sở pháp luật điều chỉnh", "1.3. Vai trò của dịch vụ pháp lý đối với doanh nghiệp", "1.4. Tiêu chí đánh giá chất lượng hoạt động pháp lý"]
  },
  {
    "id": "3",
    "title": "Chương 2: Thực trạng hoạt động pháp lý kinh tế tại đơn vị nghiên cứu",
    "description": "Giới thiệu đơn vị, phân tích quy trình tư vấn/hợp đồng/tuân thủ, đánh giá kết quả, hạn chế và nguyên nhân",
    "subsections": ["2.1. Khái quát về đơn vị nghiên cứu", "2.2. Thực trạng quy trình cung cấp dịch vụ pháp lý", "2.3. Thực trạng tư vấn hợp đồng, tuân thủ và xử lý tranh chấp", "2.4. Đánh giá ưu điểm, hạn chế và nguyên nhân"]
  },
  {
    "id": "4",
    "title": "Chương 3: Giải pháp hoàn thiện hoạt động pháp lý kinh tế tại đơn vị nghiên cứu",
    "description": "Đề xuất giải pháp chuyên môn pháp lý, quy trình kiểm soát tuân thủ, chất lượng dịch vụ và kiến nghị thực hiện",
    "subsections": ["3.1. Định hướng hoàn thiện hoạt động pháp lý", "3.2. Giải pháp nâng cao chất lượng tư vấn và kiểm soát rủi ro pháp lý", "3.3. Kiến nghị đối với đơn vị và cơ quan liên quan"]
  },
  {
    "id": "5",
    "title": "Kết luận và tài liệu tham khảo",
    "description": "Tổng hợp kết quả nghiên cứu và danh mục văn bản pháp luật/tài liệu tham khảo",
    "subsections": ["1. Kết luận", "2. Tài liệu tham khảo"]
  }
]`
          : `[
  {
    "id": "1",
    "title": "Mở đầu",
    "description": "Lý do chọn đề tài, mục tiêu, đối tượng, phạm vi và phương pháp nghiên cứu",
    "subsections": ["1. Lý do chọn đề tài", "2. Mục tiêu nghiên cứu", "3. Đối tượng và phạm vi nghiên cứu", "4. Phương pháp nghiên cứu"]
  },
  {
    "id": "2",
    "title": "Chương 1: Cơ sở lý luận về vấn đề nghiên cứu",
    "description": "Khái niệm, vai trò, hệ thống tiêu chí đánh giá và nhân tố ảnh hưởng",
    "subsections": ["1.1. Khái niệm và vai trò", "1.2. Hệ thống tiêu chí đánh giá", "1.3. Các nhân tố ảnh hưởng"]
  },
  {
    "id": "3",
    "title": "Chương 2: Thực trạng vấn đề nghiên cứu tại đơn vị nghiên cứu",
    "description": "Giới thiệu đơn vị, phân tích thực trạng, đánh giá ưu điểm, hạn chế và nguyên nhân",
    "subsections": ["2.1. Khái quát về đơn vị nghiên cứu", "2.2. Phân tích thực trạng", "2.3. Đánh giá ưu điểm, hạn chế và nguyên nhân"]
  },
  {
    "id": "4",
    "title": "Chương 3: Giải pháp hoàn thiện vấn đề nghiên cứu",
    "description": "Đề xuất giải pháp và kiến nghị thực hiện",
    "subsections": ["3.1. Định hướng phát triển", "3.2. Giải pháp hoàn thiện", "3.3. Kiến nghị"]
  },
  {
    "id": "5",
    "title": "Kết luận và tài liệu tham khảo",
    "description": "Tổng kết kết quả nghiên cứu và danh mục tài liệu tham khảo",
    "subsections": ["1. Kết luận", "2. Tài liệu tham khảo"]
  }
]`;
        const systemPrompt = prompts.getOutlinePlannerSystem(outlineExample);
        const promptMsg = prompts.getOutlinePlannerUser(
          userPrompt,
          subject,
          outlineSource,
          templateKnowledgeText,
          reportContext.templateStyleGuide
        );
        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: promptMsg }
        ];

        const llmResult = await callLLM(targetModelId, messages, 0.4, authToken, rawUsername, requestBaseUrl);
        try {
          // Clean markdown block wrappers if LLM returned them
          const cleanedJson = llmResult.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
          parsedOutline = JSON.parse(cleanedJson);
        } catch (jsonErr) {
          console.warn("Failed to parse LLM outline JSON, using default:", jsonErr.message, llmResult);
          parsedOutline = [
            { id: "1", title: "Chương I: Tổng quan", description: "Giới thiệu chung về đề tài", reportContext },
            { id: "2", title: "Chương II: Nội dung chi tiết", description: "Phân tích thực trạng và số liệu", reportContext },
            { id: "3", title: "Chương III: Kết luận & Đề xuất", description: "Tóm tắt các kiến nghị", reportContext }
          ];
        }
      }

      parsedOutline = normalizeReportOutlineSections(parsedOutline.map((item) => ({
        ...item,
        title: adaptOutlineTitleToContext(item.title, reportContext),
        subsections: sanitizeOutlineSubsections(item.subsections)
          .map((subsection) => adaptOutlineTitleToContext(subsection, reportContext)),
        reportContext: item.reportContext || reportContext,
      }))).map((item) => ({
        ...item,
        style_guidance: item.style_guidance || inferSectionTemplateExpectation(item, reportContext),
      }));

      // Initialize sections_progress array
      // Content sections (exclude references-only) share the word budget; references section has no word target.
      const contentSections = parsedOutline.filter((item) => !isReferenceOnlySection(item));
      const sectionsProgress = parsedOutline.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        level: item.level || 1,
        subsections: item.subsections || [],
        style_guidance: item.style_guidance || inferSectionTemplateExpectation(item, item.reportContext || reportContext),
        reportContext: item.reportContext || reportContext,
        is_reference_section: isReferenceOnlySection(item),
        target_words: isReferenceOnlySection(item)
          ? 0
          : (reportContext.targetWords && contentSections.length
            ? Math.max(reportContext.requestedPages ? 300 : 900, Math.round(reportContext.targetWords / contentSections.length))
            : 1000),
        status: "todo", // todo, drafting, done
        content: "",
        feedback: "",
      }));

      const newState = {
        chat_id: chatId,
        current_step: "OUTLINING",
        current_activity: buildAgentActivity("outline_ready", "Agent đã lập đề cương và đang chờ bạn phê duyệt.", {
          actor: "Report Agent",
          sections: sectionsProgress.length,
        }),
        outline: parsedOutline,
        sections_progress: sectionsProgress,
      };

      await saveAgentState(chatId, username, newState);
      return NextResponse.json({ ok: true, state: newState });
    }

    // ── ACTION: APPROVE OUTLINE ──
    if (action === "approve_outline") {
      if (!currentState) {
        return NextResponse.json({ error: "State not found" }, { status: 404 });
      }

      const approvedOutline = normalizeReportOutlineSections(outline || currentState.outline);
      const contentSectionsApproved = approvedOutline.filter((item) => !isReferenceOnlySection(item));
      const sectionsProgress = approvedOutline.map((item) => {
        const existing = (currentState.sections_progress || []).find((p) => p.id === item.id);
        const reportContext = item.reportContext || existing?.reportContext || currentState.outline?.[0]?.reportContext || null;
        const isRefSection = isReferenceOnlySection(item);
        return {
          id: item.id,
          title: adaptOutlineTitleToContext(item.title, reportContext),
          description: item.description || item.title,
          level: item.level || existing?.level || 1,
          subsections: sanitizeOutlineSubsections(item.subsections || existing?.subsections || [])
            .map((subsection) => adaptOutlineTitleToContext(subsection, reportContext)),
          style_guidance: item.style_guidance || existing?.style_guidance || inferSectionTemplateExpectation(item, reportContext),
          reportContext,
          is_reference_section: isRefSection,
          target_words: isRefSection
            ? 0
            : (existing?.target_words ||
              (reportContext?.targetWords && contentSectionsApproved.length
                ? Math.max(reportContext?.requestedPages ? 300 : 900, Math.round(reportContext.targetWords / contentSectionsApproved.length))
                : 1000)),
          status: existing ? existing.status : "todo",
          content: existing ? existing.content : "",
          feedback: existing ? existing.feedback : "",
        };
      });

      const newState = {
        ...currentState,
        current_step: "DRAFTING",
        outline: approvedOutline,
        sections_progress: sectionsProgress,
      };
      setAgentActivity(newState, null, "drafting_queue_ready", "Agent đã nhận đề cương, chuẩn bị soạn từng mục.", {
        actor: "Report Agent",
        sections: sectionsProgress.length,
      });

      await saveAgentState(chatId, username, newState);
      return NextResponse.json({ ok: true, state: newState });
    }

    // ── ACTION: CANCEL AGENT RUN ──
    if (action === "cancel") {
      if (!currentState) {
        return NextResponse.json({ ok: true, state: null });
      }

      normalizeAgentState(currentState);
      currentState.current_step = "CANCELLED";
      currentState.cancelled_at = new Date().toISOString();
      setAgentActivity(currentState, null, "cancelled", "Người dùng đã hủy quy trình tạo báo cáo.", {
        actor: "User",
      });

      const progress = currentState.sections_progress || [];
      for (const section of progress) {
        if (section.status === "drafting") {
          section.status = String(section.content || "").trim() ? "done" : "cancelled";
        }
      }

      await saveAgentState(chatId, username || currentState.username, currentState);
      return NextResponse.json({ ok: true, state: currentState });
    }

    // ── ACTION: DRAFT NEXT SECTION ──
    if (action === "draft_next_background") {
      if (!currentState) {
        return NextResponse.json({ error: "State not found" }, { status: 404 });
      }

      if (currentState.current_step === "CANCELLED") {
        return NextResponse.json({ ok: true, state: currentState, message: "Agent run cancelled." });
      }

      normalizeAgentState(currentState);
      const progress = currentState.sections_progress || [];
      const alreadyDrafting = progress.find((p) => p.status === "drafting");
      if (alreadyDrafting) {
        return NextResponse.json({
          ok: true,
          queued: true,
          state: currentState,
          activeSectionId: alreadyDrafting.id,
          message: "A background worker is already processing this report.",
        });
      }

      const nextToDraft = progress.find((p) => p.status === "todo");

      if (!nextToDraft) {
        const allDoneState = {
          ...currentState,
          current_step: "COMPLETED",
        };
        await saveAgentState(chatId, username, allDoneState);
        return NextResponse.json({ ok: true, state: allDoneState, message: "All sections completed!" });
      }

      nextToDraft.status = "drafting";
      currentState.current_step = "DRAFTING";
      setAgentActivity(currentState, nextToDraft, "section_queued", `Agent đã đưa mục vào hàng chờ soạn thảo: ${nextToDraft.title}`, {
        actor: "Report Agent",
        sectionId: nextToDraft.id,
        background: true,
      });
      await saveAgentState(chatId, username, currentState);

      after(async () => {
        try {
          const headers = await buildInternalFetchHeaders(authToken, "application/json");
          fetch(`${requestBaseUrl}/api/report-assistant/agent`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              ...body,
              action: "draft_next_worker",
              chatId,
              username: rawUsername,
              modelId: targetModelId,
            }),
            cache: "no-store",
          }).catch((err) => {
            console.error("[agent/route] Background draft worker failed to start:", err);
          });
        } catch (err) {
          console.error("[agent/route] Background draft worker scheduling failed:", err);
        }
      });

      return NextResponse.json({
        ok: true,
        queued: true,
        state: currentState,
        activeSectionId: nextToDraft.id,
      });
    }

    if (action === "draft_next" || action === "draft_next_worker") {
      if (!currentState) {
        return NextResponse.json({ error: "State not found" }, { status: 404 });
      }

      if (currentState.current_step === "CANCELLED") {
        return NextResponse.json({ ok: true, state: currentState, message: "Agent run cancelled." });
      }

      normalizeAgentState(currentState);
      const progress = currentState.sections_progress || [];
      const nextToDraft = progress.find((p) => p.status === "todo" || p.status === "drafting");
      const activeReportContext =
        nextToDraft?.reportContext ||
        currentState.outline?.[0]?.reportContext ||
        progress.find((p) => p.reportContext)?.reportContext ||
        null;

      if (!nextToDraft) {
        const allDoneState = {
          ...currentState,
          current_step: "COMPLETED",
        };
        await saveAgentState(chatId, username, allDoneState);
        return NextResponse.json({ ok: true, state: allDoneState, message: "All sections completed!" });
      }

      // Mark section as drafting
      nextToDraft.status = "drafting";
      setAgentActivity(currentState, nextToDraft, "section_started", `Agent bắt đầu xử lý mục: ${nextToDraft.title}`, {
        actor: "Report Agent",
        sectionId: nextToDraft.id,
      });
      await saveAgentState(chatId, username, currentState);

      // 1. Search Planning (Heuristic RAG - 0ms)
      let supabaseQuery = "";
      let webQuery = "";
      
      const cleanTitle = stripOutlineNumberPrefix(nextToDraft.title);
      supabaseQuery = cleanTitle;
      webQuery = cleanTitle;

      if (activeReportContext) {
        const contextQuery = [
          activeReportContext.studyIssue,
          activeReportContext.targetCompany,
          activeReportContext.analysisYearLabel,
        ]
          .filter(Boolean)
          .join(" ");
        supabaseQuery = `${contextQuery} ${supabaseQuery}`.trim();
        webQuery = `${contextQuery} ${webQuery}`.trim();
      }

      setAgentActivity(currentState, nextToDraft, "search_plan_ready", "Agent đã lập truy vấn thông tin dạng heuristic cực nhanh (0ms).", {
        actor: "Planner",
        supabaseQuery,
        webQuery,
      });
      await saveAgentState(chatId, username, currentState);

      // 2. Execute Supabase RAG and Web RAG in parallel. Web RAG is limited
      // to data/current-law sections to avoid slow external calls on every chapter.
      let supabaseRAGContent = "";
      let webRAGContent = "";
      let webSources = [];
      const useWebRag = !!webQuery && shouldUseWebRagForSection(nextToDraft, activeReportContext);

      setAgentActivity(currentState, nextToDraft, "rag_parallel_started", useWebRag
        ? "Agent đang đọc tài liệu nội bộ và tìm kiếm web song song."
        : "Agent đang đọc tài liệu nội bộ; bỏ qua Web RAG cho mục này để tăng tốc.", {
        actor: "RAG",
        supabaseQuery,
        webQuery: useWebRag ? webQuery : "",
        webSkipped: !useWebRag,
      });
      await saveAgentState(chatId, username, currentState);

      const runSupabaseRag = async () => {
        if (!supabaseQuery || !username) return "";

        const baseUrl = requestBaseUrl;
        const knowledgeUsers = Array.from(
          new Set([username, REPORT_TEMPLATE_CONTENT_USER].filter(Boolean)),
        );
        const allItems = [];

        const dbResults = await Promise.allSettled(
          knowledgeUsers.map(async (knowledgeUser) => {
            const dbRes = await fetch(`${baseUrl}/api/knowledge-content?username=${encodeURIComponent(knowledgeUser)}`, {
              headers: await buildInternalFetchHeaders(authToken),
              signal: timeoutSignal(),
            });
            if (!dbRes.ok) {
              const errText = await dbRes.text().catch(() => "");
              throw new Error(`${knowledgeUser}: ${dbRes.status} ${errText.slice(0, 180)}`);
            }
            const dbData = await dbRes.json();
            return dbData.data || [];
          }),
        );

        for (const result of dbResults) {
          if (result.status === "fulfilled") {
            allItems.push(...result.value);
          } else {
            console.warn("[agent/route] Knowledge RAG failed:", result.reason?.message || result.reason);
          }
        }

        if (allItems.length === 0) return "";

        const queryWords = supabaseQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const rankedChunks = allItems
          .map((item) => {
            const text = item.content_text || "";
            let score = 0;
            for (const word of queryWords) {
              const regex = new RegExp(word, "gi");
              const matches = text.match(regex);
              if (matches) score += matches.length;
            }
            return { item, score };
          })
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2);

        if (rankedChunks.length === 0) return "";

        let content = `\n\n--- TRI THỨC NỘI BỘ TRUY XUẤT ĐƯỢC (Tài liệu mẫu liên quan) ---`;
        for (const rc of rankedChunks) {
          content += `\n\n[File: ${rc.item.filename} | Mục khớp]\n${rc.item.content_text.slice(0, 4000)}`;
        }
        content += `\n-----------------------------------------------------------`;
        return content;
      };

      const runWebRag = async () => {
        if (!useWebRag) return { content: "", sources: [] };

        const baseUrl = requestBaseUrl;
        const sources = [];
        let content = "";

        console.log("[agent/route] Web RAG Tavily query:", webQuery);
        const webRes = await fetch(`${baseUrl}/api/report-assistant/web-search`, {
          method: "POST",
          headers: await buildInternalFetchHeaders(authToken, "application/json"),
          body: JSON.stringify({ query: webQuery, mode: "fast" }),
          signal: timeoutSignal(),
        });

        if (!webRes.ok) {
          const errText = await webRes.text().catch(() => "");
          throw new Error(`${webRes.status} ${errText.slice(0, 300)}`);
        }

        const webData = await webRes.json();
        if (!webData.success || !webData.results) return { content: "", sources };

        const resObj = webData.results;
        content = `\n\n--- THÔNG TIN MỚI NHẤT TỪ GOOGLE SEARCH TRUY XUẤT ĐƯỢC ---`;
        if (resObj.answer) {
          content += `\n**Tóm tắt câu trả lời:** ${resObj.answer}`;
        }

        const searchResults = (resObj.results || []).slice(0, 2);
        for (const r of searchResults) {
          content += `\n\n- **[${r.title}](${r.url})**\n  *Nội dung:* ${r.content}`;
          if (r.url) {
            sources.push({
              title: r.title || r.url,
              url: r.url,
              type: "tavily",
            });
          }
        }
        content += `\n---------------------------------------------------------`;
        return { content, sources };
      };

      const [supabaseResult, webResult] = await Promise.allSettled([
        runSupabaseRag(),
        runWebRag(),
      ]);

      if (supabaseResult.status === "fulfilled") {
        supabaseRAGContent = supabaseResult.value || "";
      } else {
        console.warn("Execute Supabase RAG failed:", supabaseResult.reason?.message || supabaseResult.reason);
      }

      if (webResult.status === "fulfilled") {
        webRAGContent = webResult.value?.content || "";
        webSources = webResult.value?.sources || [];
      } else {
        console.warn("Execute Web RAG failed:", webResult.reason?.message || webResult.reason);
      }

      setAgentActivity(currentState, nextToDraft, "rag_parallel_ready", "Agent đã hoàn tất truy xuất tri thức cho mục này.", {
        actor: "RAG",
        internalMatched: !!supabaseRAGContent,
        webSources: webSources.length,
        webSkipped: !useWebRag,
      });
      await saveAgentState(chatId, username, currentState);

      // Construct drafting prompt (Scope Control)
      const previousDone = progress.filter((p) => p.status === "done");
      const lastDoneContent = previousDone.length > 0 ? previousDone[previousDone.length - 1].content : "";

      const layoutInstruction = prompts.getLayoutInstruction();
      const systemPrompt = prompts.getDraftingSystem({
        layoutInstruction,
        analysisYearsText: activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", "),
        financialAccounting: !!activeReportContext?.financialAccounting,
        legalEconomic: !!activeReportContext?.legalEconomic,
        reportContextPromptText: reportContextPrompt(activeReportContext, progress.length),
        outlineJsonString: JSON.stringify(currentState.outline, null, 2),
        lastDoneContent,
      });

      // If this is a references-only section, override to a specialized listing prompt
      const isRefSection = nextToDraft.is_reference_section || isReferenceOnlySection(nextToDraft);
      const userPromptMsg = isRefSection
        ? prompts.getReferencesUser(supabaseRAGContent, webRAGContent)
        : prompts.getDraftingUser({
            nextToDraftId: nextToDraft.id,
            nextToDraftTitle: nextToDraft.title,
            nextToDraftDescription: nextToDraft.description,
            styleGuidance: nextToDraft.style_guidance,
            targetWords: nextToDraft.target_words,
            subsections: nextToDraft.subsections,
            feedback,
            supabaseRAGContent,
            webRAGContent,
          });

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPromptMsg }
      ];

      setAgentActivity(currentState, nextToDraft, "drafting_content", "Agent đang soạn nội dung chi tiết cho mục này.", {
        actor: "Writer",
        model: targetModelId,
        sectionId: nextToDraft.id,
      });
      await saveAgentState(chatId, username, currentState);

      const draftResult = sanitizeReportDraftContent(await callLLM(targetModelId, messages, 0.5, authToken, rawUsername, requestBaseUrl));

      const { data: latestStateBeforeSave } = await getAgentState(chatId);
      if (latestStateBeforeSave?.current_step === "CANCELLED") {
        normalizeAgentState(latestStateBeforeSave);
        return NextResponse.json({ ok: true, state: latestStateBeforeSave, message: "Agent run cancelled." });
      }

      if (!REPORT_ENABLE_CRITIC) {
        nextToDraft.status = "done";
        nextToDraft.content = draftResult;
        nextToDraft.feedback = "";
        nextToDraft.web_sources = webSources;
        setAgentActivity(currentState, nextToDraft, "section_completed", "Mục này đã được soạn xong.", {
          actor: "Writer",
          approved: true,
          criticSkipped: true,
        });

        await saveAgentState(chatId, username, currentState);

        const stillTodo = progress.find((p) => p.status === "todo" || p.status === "drafting");
        if (!stillTodo) {
          currentState.current_step = "COMPLETED";
          setAgentActivity(currentState, null, "report_completed", "Tất cả mục trong báo cáo đã hoàn tất.", {
            actor: "Report Agent",
            sections: progress.length,
          });
          await saveAgentState(chatId, username, currentState);
        } else {
          // Auto-chain background worker to process the next section immediately without client roundtrip
          after(async () => {
            try {
              const headers = await buildInternalFetchHeaders(authToken, "application/json");
              fetch(`${requestBaseUrl}/api/report-assistant/agent`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  ...body,
                  action: "draft_next_background",
                  chatId,
                  username: rawUsername,
                  modelId: targetModelId,
                }),
                cache: "no-store",
              }).catch((err) => {
                console.error("[agent/route] Auto-chain background draft worker failed:", err);
              });
            } catch (err) {
              console.error("[agent/route] Auto-chain background scheduling failed:", err);
            }
          });
        }

        return NextResponse.json({ ok: true, state: currentState, activeSectionId: nextToDraft.id, draftResult });
      }

      // Verify step (Critic loop - automated or lightweight)
      // For automated verification: we run a critic prompt to check quality.
      const criticSystem = prompts.getCriticSystem(
        activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", ")
      );

      const criticMessages = [
        { role: "system", content: criticSystem },
        { role: "user", content: `Đoạn văn thảo luận:\n${draftResult}` }
      ];

      setAgentActivity(currentState, nextToDraft, "reviewing_draft", "Agent đang kiểm định chất lượng nội dung vừa soạn.", {
        actor: "Critic",
        sectionId: nextToDraft.id,
      });
      await saveAgentState(chatId, username, currentState);

      const criticResult = await callLLM(targetModelId, criticMessages, 0.2, authToken, rawUsername, requestBaseUrl);
      const isApproved = criticResult.toUpperCase().includes("APPROVED");

      const { data: latestStateAfterCritic } = await getAgentState(chatId);
      if (latestStateAfterCritic?.current_step === "CANCELLED") {
        normalizeAgentState(latestStateAfterCritic);
        return NextResponse.json({ ok: true, state: latestStateAfterCritic, message: "Agent run cancelled." });
      }

      if (isApproved) {
        nextToDraft.status = "done";
        nextToDraft.content = draftResult;
        nextToDraft.feedback = "";
        nextToDraft.web_sources = webSources;
        setAgentActivity(currentState, nextToDraft, "section_completed", "Mục này đã được soạn và kiểm định đạt yêu cầu.", {
          actor: "Critic",
          approved: true,
        });
      } else {
        // Do not keep the same section in "drafting" forever. Save the draft and
        // preserve critic feedback for later manual review instead of blocking the queue.
        nextToDraft.status = "done";
        nextToDraft.content = draftResult;
        nextToDraft.feedback = criticResult.replace(/^REJECTED\s*/i, "").trim();
        nextToDraft.web_sources = webSources;
        setAgentActivity(currentState, nextToDraft, "section_completed_with_notes", "Mục này đã được soạn xong nhưng có ghi chú kiểm định cần xem lại.", {
          actor: "Critic",
          approved: false,
        });
      }

      await saveAgentState(chatId, username, currentState);

      // Check if all are done now
      const stillTodo = progress.find((p) => p.status === "todo" || p.status === "drafting");
      if (!stillTodo) {
        currentState.current_step = "COMPLETED";
        setAgentActivity(currentState, null, "report_completed", "Tất cả mục trong báo cáo đã hoàn tất.", {
          actor: "Report Agent",
          sections: progress.length,
        });
        await saveAgentState(chatId, username, currentState);
      } else {
        // Auto-chain background worker to process the next section immediately without client roundtrip
        after(async () => {
          try {
            const headers = await buildInternalFetchHeaders(authToken, "application/json");
            fetch(`${requestBaseUrl}/api/report-assistant/agent`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                ...body,
                action: "draft_next_background",
                chatId,
                username: rawUsername,
                modelId: targetModelId,
              }),
              cache: "no-store",
            }).catch((err) => {
              console.error("[agent/route] Auto-chain background draft worker failed:", err);
            });
          } catch (err) {
            console.error("[agent/route] Auto-chain background scheduling failed:", err);
          }
        });
      }

      return NextResponse.json({ ok: true, state: currentState, activeSectionId: nextToDraft.id, draftResult });
    }

    // ── ACTION: STATUS QUERY ──
    if (action === "status") {
      if (!currentState) {
        return NextResponse.json({ ok: false, state: null });
      }
      normalizeAgentState(currentState);
      await saveAgentState(chatId, currentState.username || username, currentState);
      return NextResponse.json({ ok: true, state: currentState });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[agent/route] POST error:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
