import { NextResponse } from "next/server";
import { turso } from "@/lib/tursoClient";
import { getApiKeys, getProviderConnections } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { getDefaultModel } from "@/shared/constants/models";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { normalizeUsername, isRestrictedUser, isRestrictedReportAssistantSubject } from "@/lib/userResourceMapping";
import { ensureRestrictedUserResources } from "@/lib/restrictedUserProvisioning";
import * as promptsBase from "./prompts";
import { getDraftingSystemCareer } from "./promptsCareer";
import { getDraftingSystemB49 } from "./promptsB49";
import { getDraftingSystemStandard } from "./promptsStandard";
import { rankKnowledgeItems } from "./ragRanking";

const prompts = {
  ...promptsBase,
  getDraftingSystemCareer,
  getDraftingSystemB49,
  getDraftingSystemStandard,
};

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CLI_TOKEN_SALT = "9r-cli-auth";
const REPORT_LLM_TIMEOUT_MS = Number.parseInt(process.env.REPORT_AGENT_LLM_TIMEOUT_MS || "600000", 10);
const REPORT_LLM_MAX_ATTEMPTS = Number.parseInt(process.env.REPORT_AGENT_LLM_MAX_ATTEMPTS || "1", 10);
const REPORT_MAX_COMBO_MODELS = Number.parseInt(process.env.REPORT_AGENT_MAX_COMBO_MODELS || "2", 10);
const REPORT_COMBO_STRATEGY = String(process.env.REPORT_AGENT_COMBO_STRATEGY || "round-robin").trim().toLowerCase();
const REPORT_MAX_ACCOUNT_FALLBACKS = Number.parseInt(process.env.REPORT_AGENT_MAX_ACCOUNT_FALLBACKS || "2", 10);
const REPORT_ENABLE_CRITIC = String(process.env.REPORT_AGENT_ENABLE_CRITIC || "false").toLowerCase() === "true";
const REPORT_RAG_FETCH_TIMEOUT_MS = Number.parseInt(process.env.REPORT_AGENT_RAG_FETCH_TIMEOUT_MS || "15000", 10);
const REPORT_STALE_QUEUED_MS = Number.parseInt(process.env.REPORT_AGENT_STALE_QUEUED_MS || "45000", 10);
const REPORT_ASSISTANT_LUNA_MODEL_PREFIX = "ln/";
const REPORT_ASSISTANT_ARENA_MODEL_PREFIX = "ar/";

function isLunaModelId(modelId) {
  return String(modelId || "").startsWith(REPORT_ASSISTANT_LUNA_MODEL_PREFIX);
}

function isArenaModelId(modelId) {
  return String(modelId || "").startsWith(REPORT_ASSISTANT_ARENA_MODEL_PREFIX);
}

function getReportAssistantFallbackModel() {
  return "gemini-1.5-flash";
}

function getReportAssistantLunaModelId() {
  const lunaModel = getDefaultModel("luna");
  return lunaModel ? `${REPORT_ASSISTANT_LUNA_MODEL_PREFIX}${lunaModel}` : getReportAssistantFallbackModel();
}

function getReportAssistantArenaModelId() {
  const arenaModel = getDefaultModel("arena");
  return arenaModel ? `${REPORT_ASSISTANT_ARENA_MODEL_PREFIX}${arenaModel}` : getReportAssistantFallbackModel();
}

function normalizeReportAssistantModelId(modelId, lunaActive, arenaActive) {
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
async function getInternalApiKey(rawUsername) {
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
    } catch { }
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
  const endYear = new Date().getFullYear();
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

function isExplicitB49Report(text = "") {
  return /\b(?:ba49|b49)\b/i.test(String(text || ""));
}

function isExplicitCareerOrientationReport(text = "") {
  return /\b(?:thuc tap dinh huong nghe nghiep|dinh huong nghe nghiep|career orientation|orient|sl06|sl07|el67)\b/i.test(
    String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
  );
}

function buildReportContext(userPrompt, subject, outlineSource) {
  const requestedPages = extractRequestedPages(userPrompt);
  const targetCompany = extractTargetCompanyFromPrompt(userPrompt) || "đơn vị được yêu cầu";
  const studyIssue = inferStudyIssue(userPrompt, `${subject || ""} ${outlineSource || ""}`);
  const normalizedAll = normalizeOutlineMatchText(`${userPrompt || ""} ${subject || ""} ${outlineSource || ""}`);
  const internshipReport = isExplicitB49Report(`${userPrompt || ""} ${subject || ""} ${outlineSource || ""}`);
  const careerOrientationReport = !internshipReport && isExplicitCareerOrientationReport(`${userPrompt || ""} ${subject || ""} ${outlineSource || ""}`);
  const reportTitle = internshipReport
    ? `Báo cáo kiến tập thực tế tại ${targetCompany}`
    : (careerOrientationReport
      ? `Báo cáo thực tập định hướng nghề nghiệp tại ${targetCompany}`
      : `Khóa luận tốt nghiệp về ${studyIssue} tại ${targetCompany}`);
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
    targetWords: requestedPages ? Math.max(1, requestedPages - ((internshipReport || careerOrientationReport) ? 4 : 3)) * 480 : 10125,
    analysisYears,
    analysisYearLabel: analysisYears.join(", "),
    financialAccounting,
    legalEconomic,
    internshipReport,
    careerOrientationReport,
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

function reportContextPrompt(reportContext, sectionCount = 1, overrideSectionTarget = 0) {
  if (!reportContext) return "";
  const targetWords = reportContext.targetWords || 0;
  const sectionTarget = overrideSectionTarget || (targetWords && sectionCount
    ? Math.max(600, Math.round(targetWords / Math.max(sectionCount, 1)))
    : 0);

  return [
    "YÊU CẦU GỐC CỦA NGƯỜI DÙNG - BẮT BUỘC TUÂN THỦ:",
    `- Yêu cầu: ${reportContext.userPrompt || "Không rõ"}`,
    `- Đề tài thực tế: ${reportContext.reportTitle}`,
    `- Đơn vị nghiên cứu: ${reportContext.targetCompany}`,
    `- Vấn đề nghiên cứu: ${reportContext.studyIssue}`,
    reportContext.internshipReport ? "- Kiểu báo cáo: báo cáo kiến tập B49 / thực tế, trong luồng soạn thảo chỉ triển khai từ các mục 1.1, 1.2... trở đi; phần mở đầu sẽ được hệ thống ghép một lần ở đầu báo cáo hoàn chỉnh khi xuất cuối. Các mục 1.1.1, 1.1.2... là heading cấp 3 con của từng mục 1.1/1.2 và phải được xuất ra đúng Markdown ('###'). Không ép sang 3 chương." : "",
    `- Giai đoạn số liệu bắt buộc: ${reportContext.analysisYearLabel || getLastCompletedYears(3).join(", ")}. Không dùng số liệu năm hiện tại vì năm hiện tại chưa kết thúc.`,
    reportContext.requestedPages ? `- Độ dài mục tiêu: khoảng ${reportContext.requestedPages} trang (~${targetWords} từ).` : "",
    sectionTarget ? `- Mục hiện tại nên viết khoảng ${sectionTarget} từ nếu không có chỉ dẫn khác.` : "",
    "- Đề cương Supabase chỉ là khung cấu trúc; không được giữ placeholder như '[Tên đơn vị]', 'đơn vị', 'vấn đề nghiên cứu', 'ABC'.",
    "- Báo cáo mẫu chỉ dùng để tham khảo văn phong/định dạng; tuyệt đối không lấy công ty, đề tài hoặc số liệu của báo cáo mẫu thay cho yêu cầu người dùng.",
    "- THỨ TỰ ƯU TIÊN KHI VIẾT BÁO CÁO: (1) yêu cầu của người dùng, (2) nội dung và phong cách của báo cáo mẫu đã tải lên, (3) đề cương Supabase để giữ cấu trúc, (4) tri thức Supabase / tài liệu nội bộ chỉ dùng khi báo cáo mẫu chưa đủ tường minh cho một phần cần viết.",
    "- Nếu báo cáo mẫu đã nêu rõ văn phong, cách trình bày, ví dụ, số liệu hoặc cách diễn đạt cho một mục, hãy ưu tiên học theo báo cáo mẫu trước; chỉ mượn Supabase để bổ sung khi còn thiếu thông tin hoặc cần làm rõ một phần chưa được mẫu thể hiện đủ.",
    "- Khi có mâu thuẫn giữa báo cáo mẫu và tri thức Supabase, hãy ưu tiên báo cáo mẫu và yêu cầu hiện tại của người dùng; Supabase chỉ là nguồn bổ trợ cuối cùng.",
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

function hasSubstantiveDraftContent(content) {
  return /[a-zA-Z0-9\u00C0-\u1EF9]/u.test(String(content || ""));
}

function sanitizeB49OpeningDraftContent(content) {
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
  if (/\b(ket luan|ket thuc|tom tat|de xuat)\b/.test(normalized)) {
    return false;
  }
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
  const title = typeof section === "string" ? section : (section?.title || "");
  const normalized = normalizeOutlineMatchText(title);

  // If title starts with a subsection format like 1.1, 1.2, etc., it is NEVER an opening section
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

function isB49OpeningSection(section) {
  return isOpeningSection(section) && isInternshipB49ReportSection(section);
}

function isConclusionSection(section) {
  const normalized = normalizeOutlineMatchText(section?.title || section || "");
  return /\b(ket luan|ket thuc|iii\. ket luan)\b/.test(normalized) && !/\bchuong\b/.test(normalized);
}

function isInternshipB49ReportSection(section) {
  const text = normalizeOutlineMatchText(
    `${section?.title || ""} ${section?.description || ""} ${Array.isArray(section?.subsections) ? section.subsections.join(" ") : ""}`,
  );
  return (
    !!section?.reportContext?.internshipReport ||
    isExplicitB49Report(text)
  );
}

function isCareerOrientationReportSection(section) {
  if (isInternshipB49ReportSection(section)) return false;
  const text = normalizeOutlineMatchText(
    `${section?.title || ""} ${section?.description || ""} ${Array.isArray(section?.subsections) ? section.subsections.join(" ") : ""}`,
  );
  return (
    !!section?.reportContext?.careerOrientationReport ||
    isExplicitCareerOrientationReport(text)
  );
}

function calculateTargetWordsForSection(item, totalWords, contentSections) {
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

function buildInternshipB49Outline(reportContext = null) {
  const baseContext = reportContext || null;
  return [
    {
      id: "1.1",
      title: "1.1. Khái quát chung về doanh nghiệp",
      description: "Phải triển khai sâu theo các tiểu mục 1.1.1, 1.1.2, 1.1.3 để làm rõ lịch sử, chức năng, nguồn lực và năng lực hoạt động.",
      level: 1,
      parent_id: null,
      subsections: [
        "1.1.1. Quá trình hình thành và phát triển của doanh nghiệp",
        "1.1.2. Chức năng, nhiệm vụ, ngành nghề kinh doanh và đặc điểm sản xuất kinh doanh",
        "1.1.3. Năng lực hoạt động của doanh nghiệp",
        "1.1.4. Tình hình nhân lực của doanh nghiệp",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.2",
      title: "1.2. Môi trường hoạt động của doanh nghiệp",
      description: "Phải triển khai sâu theo các tiểu mục 1.2.1, 1.2.2, 1.2.3... để phân tích vị thế, khách hàng, đối tác, đối thủ và khó khăn.",
      level: 1,
      parent_id: null,
      subsections: [
        "1.2.1. Vị thế của doanh nghiệp trong môi trường cạnh tranh",
        "1.2.2. Tình hình khách hàng của doanh nghiệp",
        "1.2.3. Các đối tác, nhà cung cấp chủ yếu của doanh nghiệp",
        "1.2.4. Một số đối thủ cạnh tranh của doanh nghiệp",
        "1.2.5. Thuận lợi và khó khăn của doanh nghiệp",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.3",
      title: "1.3. Cơ cấu bộ máy tổ chức quản lý của doanh nghiệp",
      description: "Phải có sơ đồ tổ chức và tách sâu chức năng, nhiệm vụ từng phòng ban, mối quan hệ phối hợp.",
      level: 1,
      parent_id: null,
      subsections: [
        "1.3.1. Mô hình bộ máy tổ chức quản lý",
        "1.3.2. Chức năng, nhiệm vụ từng phòng ban",
        "1.3.3. Tổ chức sản xuất kinh doanh trong doanh nghiệp",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.4",
      title: "1.4. Khái quát về công tác quản trị kinh doanh của doanh nghiệp",
      description: "Phải triển khai sâu theo các quy trình quản trị, có sơ đồ và bảng mô tả công việc chủ chốt.",
      level: 1,
      parent_id: null,
      subsections: [
        "1.4.1. Tổ chức bộ máy quản trị của doanh nghiệp",
        "1.4.2. Các quy trình quản trị cơ bản của doanh nghiệp",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.5",
      title: "1.5. Kết luận",
      description: "Tổng hợp ngắn gọn, rút ra nhận xét chung và liên hệ thực tiễn.",
      level: 1,
      parent_id: null,
      subsections: [],
      reportContext: baseContext,
    },
    {
      id: "1.6",
      title: "NHẬN XÉT KIẾN TẬP",
      description: "Mẫu nhận xét kiến tập đầy đủ. AI sẽ tự động điền các nhận xét đánh giá chi tiết về quá trình kiến tập của sinh viên dựa trên đề tài thực hiện, tránh để trống.",
      level: 1,
      parent_id: null,
      subsections: [],
      reportContext: baseContext,
    },
  ];
}

function buildCareerOrientationOutline(reportContext = null) {
  const baseContext = reportContext || null;
  const userPrompt = reportContext?.userPrompt || "";
  const targetCompany = reportContext?.targetCompany || "";
  const subject = reportContext?.subject || "";
  const normalizedCompany = targetCompany.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const normalizedPrompt = userPrompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

  // Check company first (the most reliable source)
  let isLawOrState = /\b(cong ty luat|van phong luat|luat|law|phap ly|phap che|toa an|vien kiem sat|nha nuoc|uy ban|ubnd|so|bo|cuc|chi cuc|thue|hai quan|cong an|co quan|chinh quyen|vien|so tu phap|doanh nghiep nha nuoc|vpls|vp luat|vks)\b/.test(
    normalizedCompany
  );

  // If company check is negative or generic, check prompt but exclude academic major phrases
  if (!isLawOrState && (!targetCompany || targetCompany === "đơn vị được yêu cầu")) {
    const cleanedPrompt = normalizedPrompt
      .replace(/\b(nganh|mon|chuyen nganh|hoc phan|huong)\s+(luat|law|phap ly)\b/g, "")
      .replace(/\bluat\s+(kinh te|hinh su|dan su|hanh chinh|lao dong|thuong mai)\b/g, "");
    
    isLawOrState = /\b(cong ty luat|van phong luat|toa an|vien kiem sat|nha nuoc|uy ban|ubnd|so tu phap|doanh nghiep nha nuoc|vpls|vp luat|vks|thue|hai quan|cong an|chinh quyen)\b/.test(
      cleanedPrompt
    );
  }

  const introSubsections = isLawOrState
    ? [
      "1.1 Tên cơ quan thực tập",
      "1.2 Cơ cấu tổ chức, chức năng, nhiệm vụ",
      "1.3 Giới thiệu về vị trí nghề nghiệp mà mình định tìm hiểu",
    ]
    : [
      "1.1. Giới thiệu về cơ quan thực tập",
      "1.1.1. Thông tin pháp lý và tổng quan về doanh nghiệp",
      "1.1.2. Bộ máy lãnh đạo",
      "1.1.3. Cơ cấu tổ chức; chức năng, nhiệm vụ",
      "1.2. Giới thiệu về vị trí nghề nghiệp mà mình định tìm hiểu",
    ];

  return [
    {
      id: "1.1",
      title: "I. PHẦN MỞ ĐẦU",
      description: "Giới thiệu khái quát về cơ quan thực tập (công ty luật/nhà nước hoặc công ty bình thường) và vị trí nghề nghiệp định tìm hiểu.",
      level: 1,
      parent_id: null,
      subsections: introSubsections,
      reportContext: baseContext,
    },
    {
      id: "1.2",
      title: "II. PHẦN NỘI DUNG.",
      description: "Nêu lý do chọn vị trí, đánh giá sự phù hợp cá nhân, phân tích những thuận lợi và khó khăn trong tương lai, nhận xét chung.",
      level: 1,
      parent_id: null,
      subsections: [
        "2.1. Nêu các lí do để lựa chọn vị trí nghề nghiệp",
        "2.2. Đánh giá sự phù hợp của bản thân với yêu cầu công việc",
        "2.3. Phân tích những thuận lợi và khó khăn trong tương lai khi được giao đảm nhận vị trí nghề nghiệp",
        "2.4. Nhận xét chung",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.3",
      title: "III. KẾT LUẬN",
      description: "Tổng hợp các kết quả thực tập định hướng nghề nghiệp, đúc kết kinh nghiệm.",
      level: 1,
      parent_id: null,
      subsections: [],
      reportContext: baseContext,
    },
    {
      id: "1.4",
      title: "IV. XÁC NHẬN CỦA CÁN BỘ HƯỚNG DẪN THỰC TẬP",
      description: "Bảng nhật ký thực tập cam đoan đúng thời gian thực tế, biên bản xác nhận nội dung báo cáo và đánh giá kết quả thực tập.",
      level: 1,
      parent_id: null,
      subsections: [
        "4.1. Xác nhận thời gian thực tập: Từ 01/06/2026 đến 30/06/2026",
        "4.2. Xác nhận nội dung Báo cáo thực tập (biên bản xác nhận báo cáo)",
        "4.3. Đánh giá kết quả thực tập",
      ],
      reportContext: baseContext,
    }
  ];
}

function normalizeReportOutlineSections(outline) {
  const internshipContext = Array.isArray(outline)
    ? outline.find((item) => item?.reportContext?.internshipReport)?.reportContext
    : null;
  if (internshipContext?.internshipReport) {
    const template = buildInternshipB49Outline(internshipContext);
    return template.map((item) => {
      const existing = Array.isArray(outline)
        ? outline.find((p) => String(p.id) === String(item.id))
        : null;
      return {
        ...item,
        status: existing?.status || "todo",
        content: existing?.content || "",
        feedback: existing?.feedback || "",
        web_sources: existing?.web_sources || [],
        activity: existing?.activity || null,
        activity_history: existing?.activity_history || [],
      };
    });
  }

  const careerContext = Array.isArray(outline)
    ? outline.find((item) => item?.reportContext?.careerOrientationReport)?.reportContext
    : null;
  if (careerContext?.careerOrientationReport) {
    const template = buildCareerOrientationOutline(careerContext);
    return template.map((item) => {
      const existing = Array.isArray(outline)
        ? outline.find((p) => String(p.id) === String(item.id))
        : null;
      return {
        ...item,
        status: existing?.status || "todo",
        content: existing?.content || "",
        feedback: existing?.feedback || "",
        web_sources: existing?.web_sources || [],
        activity: existing?.activity || null,
        activity_history: existing?.activity_history || [],
      };
    });
  }

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

  // Skip reference section for BA49/SL06/SL07/EL67 internship and career orientation reports
  const anyReportContext = normalized.find((item) => item?.reportContext)?.reportContext || null;
  const isInternshipOrCareer = anyReportContext?.internshipReport || anyReportContext?.careerOrientationReport;
  if (referenceSection && !isInternshipOrCareer) result.push(referenceSection);
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

    if (section.status === "done" && !hasSubstantiveDraftContent(section.content)) {
      section.status = "todo";
      section.feedback = "Mục từng bị đánh dấu hoàn thành nhưng chưa có nội dung; hệ thống đã đưa lại vào hàng chờ soạn.";
      if (section.activity) {
        section.activity.phase = "empty_done_reset";
        section.activity.message = "Mục này chưa có nội dung báo cáo thật nên đã được đưa lại vào hàng chờ soạn.";
        section.activity.updatedAt = new Date().toISOString();
      }
    }

    if (section.status === "drafting") {
      if (String(section.content || "").trim()) {
        section.status = "done";
        section.feedback = section.feedback || "Auto-normalized from stale drafting state.";
      } else if (isStaleQueuedDraft(section)) {
        section.status = "todo";
        section.feedback = "";
        if (section.activity) {
          section.activity.phase = "stale_reset";
          section.activity.message = "Mục này bị kẹt và đã tự động được đặt lại trạng thái chờ soạn thảo.";
          section.activity.updatedAt = new Date().toISOString();
        }
      }
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
  const lunaChatId = getReportLunaChatId(state);
  const nextDetails = lunaChatId && details?.lunaChatId === undefined
    ? { ...details, lunaChatId }
    : details;
  const activity = buildAgentActivity(phase, message, nextDetails);
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

function getReportLunaChatId(state) {
  const candidates = [
    state?.outline?.[0]?.reportContext?.lunaChatId,
    state?.outline?.[0]?.reportContext?.luna_chat_id,
    state?.sections_progress?.[0]?.reportContext?.lunaChatId,
    state?.sections_progress?.[0]?.reportContext?.luna_chat_id,
    state?.current_activity?.details?.lunaChatId,
    state?.current_activity?.details?.luna_chat_id,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getReportLunaMessageId(state) {
  const candidates = [
    state?.outline?.[0]?.reportContext?.lunaMessageId,
    state?.outline?.[0]?.reportContext?.luna_message_id,
    state?.sections_progress?.[0]?.reportContext?.lunaMessageId,
    state?.sections_progress?.[0]?.reportContext?.luna_message_id,
    state?.current_activity?.details?.lunaMessageId,
    state?.current_activity?.details?.luna_message_id,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function setReportLunaChatId(state, lunaChatId) {
  const clean = typeof lunaChatId === "string" ? lunaChatId.trim() : "";
  if (!state || !clean) return state;

  const apply = (reportContext) => {
    if (!reportContext || typeof reportContext !== "object") return reportContext;
    return { ...reportContext, lunaChatId: clean };
  };

  if (Array.isArray(state.outline)) {
    state.outline = state.outline.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: apply(item.reportContext) }
      : item);
  }

  if (Array.isArray(state.sections_progress)) {
    state.sections_progress = state.sections_progress.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: apply(item.reportContext) }
      : item);
  }

  if (state.current_activity && typeof state.current_activity === "object") {
    const details = state.current_activity.details && typeof state.current_activity.details === "object"
      ? { ...state.current_activity.details, lunaChatId: clean }
      : { lunaChatId: clean };
    state.current_activity = { ...state.current_activity, details };
  }

  return state;
}

function setReportLunaMessageId(state, lunaMessageId) {
  const clean = typeof lunaMessageId === "string" ? lunaMessageId.trim() : "";
  if (!state || !clean) return state;

  const apply = (reportContext) => {
    if (!reportContext || typeof reportContext !== "object") return reportContext;
    return { ...reportContext, lunaMessageId: clean };
  };

  if (Array.isArray(state.outline)) {
    state.outline = state.outline.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: apply(item.reportContext) }
      : item);
  }

  if (Array.isArray(state.sections_progress)) {
    state.sections_progress = state.sections_progress.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: apply(item.reportContext) }
      : item);
  }

  if (state.current_activity && typeof state.current_activity === "object") {
    const details = state.current_activity.details && typeof state.current_activity.details === "object"
      ? { ...state.current_activity.details, lunaMessageId: clean }
      : { lunaMessageId: clean };
    state.current_activity = { ...state.current_activity, details };
  }

  return state;
}

function getActivityTimeMs(activity) {
  const time = Date.parse(activity?.updatedAt || "");
  return Number.isFinite(time) ? time : 0;
}

function isStaleQueuedDraft(section) {
  if (!section || section.status !== "drafting") return false;
  const phase = section.activity?.phase || "";
  if (!["section_queued", "section_queued_retry", "section_started"].includes(phase)) return false;
  const updatedAt = getActivityTimeMs(section.activity);
  if (!updatedAt) return true;
  const staleMs = Number.isFinite(REPORT_STALE_QUEUED_MS) && REPORT_STALE_QUEUED_MS > 0
    ? REPORT_STALE_QUEUED_MS
    : 45000;
  return Date.now() - updatedAt > staleMs;
}

function hasStateChanged(beforeState, afterState) {
  return JSON.stringify({
    current_step: beforeState?.current_step,
    current_activity: beforeState?.current_activity,
    sections_progress: beforeState?.sections_progress,
  }) !== JSON.stringify({
    current_step: afterState?.current_step,
    current_activity: afterState?.current_activity,
    sections_progress: afterState?.sections_progress,
  });
}

async function scheduleAgentWorker({
  requestBaseUrl,
  authToken,
  body,
  action,
  chatId,
  username,
  modelId,
  logPrefix,
}) {
  const headers = await buildInternalFetchHeaders(authToken, "application/json");
  const res = await fetch(`${requestBaseUrl}/api/report-assistant/agent`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...body,
      action,
      chatId,
      username,
      modelId,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`${logPrefix} returned ${res.status}: ${text.slice(0, 300)}`);
  }
}

/**
 * Read agent state from Turso.
 * Returns { source, data } where source is "turso" or "none".
 */
async function getAgentState(chatId, username = "admin") {
  try {
    const parseJsonSafe = (val) => {
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    };

    const result = await turso.execute({
      sql: `SELECT chat_id, username, current_step, current_activity, outline, sections_progress, updated_at, created_at
            FROM report_agent_states WHERE chat_id = ?`,
      args: [chatId],
    });

    const row = result.rows?.[0];
    if (!row) return { source: "none", data: null };

    return {
      source: "turso",
      data: {
        chat_id: row.chat_id,
        username: row.username,
        current_step: row.current_step,
        current_activity: parseJsonSafe(row.current_activity),
        outline: parseJsonSafe(row.outline),
        sections_progress: parseJsonSafe(row.sections_progress),
        updated_at: row.updated_at,
        created_at: row.created_at,
      },
    };
  } catch (err) {
    console.error("[agent/route] getAgentState failed:", err.message);
    return { source: "none", data: null };
  }
}

/**
 * Persist agent state to Turso (upsert).
 */
async function saveAgentState(chatId, username, stateData) {
  const now = new Date().toISOString();
  try {
    await turso.execute({
      sql: `INSERT INTO report_agent_states
              (chat_id, username, current_step, current_activity, outline, sections_progress, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
              current_step      = excluded.current_step,
              current_activity  = excluded.current_activity,
              outline           = excluded.outline,
              sections_progress = excluded.sections_progress,
              updated_at        = excluded.updated_at`,
      args: [
        chatId,
        username || "admin",
        stateData.current_step || "PLANNING",
        JSON.stringify(stateData.current_activity || null),
        JSON.stringify(stateData.outline || []),
        JSON.stringify(stateData.sections_progress || []),
        now,
        now,
      ],
    });
    return { savedTurso: true };
  } catch (err) {
    console.error("[agent/route] saveAgentState failed:", err.message);
    return { savedTurso: false, error: err.message };
  }
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
const BACKUP_MODELS = ["gemini-1.5-flash", "gemini-2.5-flash", "gpt-4o-mini", "gemini-1.5-pro"];

function extractLLMText(data) {
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

async function saveReportSectionContent(chatId, sectionId, content) {
  const turso = await getTursoClient();
  await turso.execute({
    sql: `INSERT INTO report_sections (chat_id, section_id, content, updated_at) 
          VALUES (?, ?, ?, datetime('now')) 
          ON CONFLICT(chat_id, section_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    args: [chatId, sectionId, content]
  });
}

// Call local completions API with Exponential Backoff Retries for Rate Limits (429/503)
async function callLLM(modelId, messages, temperature = 0.3, authToken = null, rawUsername = null, baseUrlOverride = null, sessionState = null) {
  const authContext = rawUsername;
  const maxAttempts = Number.isFinite(REPORT_LLM_MAX_ATTEMPTS) && REPORT_LLM_MAX_ATTEMPTS > 0 ? REPORT_LLM_MAX_ATTEMPTS : 1;
  const timeoutMs = Number.isFinite(REPORT_LLM_TIMEOUT_MS) && REPORT_LLM_TIMEOUT_MS > 0 ? REPORT_LLM_TIMEOUT_MS : 600000;

  // Prepare a sequence of models to try if quota is hit
  const isSpecialProvider = String(modelId || "").startsWith("ln/") || String(modelId || "").startsWith("ar/");
  const modelsToTry = isSpecialProvider ? [modelId] : [modelId, ...BACKUP_MODELS.filter((m) => m !== modelId)];
  let currentModelIdx = 0;
  let attempt = 0;
  let backoffMs = 2000;

  while (currentModelIdx < modelsToTry.length) {
    const currentModelId = modelsToTry[currentModelIdx];
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

      const res = await fetch(`${baseUrl}/api/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: currentModelId,
          messages,
          temperature,
          stream: false,
          ...(sessionState ? {
            lunaChatId: sessionState.lunaChatId || "",
            lunaParentMessageId: sessionState.lunaMessageId || "",
          } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (process.env.NODE_ENV !== "production") {
        console.log(`[agent/route] LLM response model=${currentModelId} status=${res.status} attempt=${attempt + 1}/${maxAttempts}`);
      }

      // Handle Rate Limiting / Quota Exceeded (429) -> immediately switch to next model
      if (res.status === 429) {
        const errText = await res.text().catch(() => "");
        console.warn(`[agent/route] Model ${currentModelId} returned 429 (Quota Limit). Switching immediately to next fallback model... Error detail: ${errText.slice(0, 180)}`);
        currentModelIdx++;
        attempt = 0;
        backoffMs = 2000;
        continue;
      }

      // Handle other retriable errors like 503 (Server Overloaded) or 504
      if (res.status === 503 || res.status === 504) {
        attempt++;
        const errText = await res.text().catch(() => "");
        if (attempt >= maxAttempts) {
          console.warn(`[agent/route] Model ${currentModelId} returned ${res.status} repeatedly. Switching to next fallback model...`);
          currentModelIdx++;
          attempt = 0;
          backoffMs = 2000;
          continue;
        }
        const jitter = Math.floor(Math.random() * 1000);
        const sleepMs = Math.min(backoffMs, 5000) + jitter;
        console.warn(`[agent/route] LLM ${res.status}. Attempt ${attempt}/${maxAttempts}. Retrying same model in ${sleepMs}ms...`);
        await sleep(sleepMs);
        backoffMs *= 2;
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM Error: ${res.status} - ${errText}`);
      }

      const data = await res.json();
      const lunaChatId = res.headers.get("x-luna-chat-id") || "";
      const lunaMessageId = res.headers.get("x-luna-message-id") || "";
      if (sessionState && lunaChatId) {
        sessionState.lunaChatId = lunaChatId;
      }
      if (sessionState && lunaMessageId) {
        sessionState.lunaMessageId = lunaMessageId;
      }
      return extractLLMText(data);
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) {
        console.warn(`[agent/route] Connection error on ${currentModelId} after all attempts. Switching to next fallback model... Error:`, err.message);
        currentModelIdx++;
        attempt = 0;
        backoffMs = 2000;
        continue;
      }
      const sleepMs = backoffMs + Math.floor(Math.random() * 1000);
      console.warn(`[agent/route] Connection error. Attempt ${attempt}/${maxAttempts}. Retrying in ${sleepMs}ms...`, err.message);
      await sleep(sleepMs);
      backoffMs *= 2;
    }
  }
  throw new Error("Failed to contact LLM: all configured fallback models failed or hit quota limits.");
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

    const authSession = authToken ? await getDashboardAuthSession(authToken) : null;
    // Restricted users keep their own DB partition; missing report resources are copied from Minh.
    const username = normalizeUsername(authSession?.username || rawUsername || "admin") || "admin";
    await ensureRestrictedUserResources(username);
    const requestBaseUrl = getBaseUrl(request);
    if (subject && isRestrictedUser(username) && !isRestrictedReportAssistantSubject(subject)) {
      return NextResponse.json(
        { error: "Restricted accounts can only use el67, sl06, and sl07." },
        { status: 403 },
      );
    }

    if (!chatId) {
      return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
    }

    const lunaConnections = await getProviderConnections({ provider: "luna", isActive: true }).catch(() => []);
    const lunaActive = Array.isArray(lunaConnections) && lunaConnections.length > 0;

    const arenaConnections = await getProviderConnections({ provider: "arena", isActive: true }).catch(() => []);
    const arenaActive = Array.isArray(arenaConnections) && arenaConnections.length > 0;

    // Report workflow must run on Luna or Arena if active; otherwise, fallback to remaining providers.
    let targetModelId = normalizeReportAssistantModelId(modelId, lunaActive, arenaActive);

    const { data: currentState } = await getAgentState(chatId, username);
    const reportSession = {
      lunaChatId: getReportLunaChatId(currentState),
      lunaMessageId: getReportLunaMessageId(currentState),
    };

    const throwIfCancelled = async () => {
      const { data: latestState } = await getAgentState(chatId, username);
      if (latestState?.current_step === "CANCELLED") {
        const cancelledErr = new Error("AGENT_CANCELLED");
        cancelledErr.code = "AGENT_CANCELLED";
        cancelledErr.cancelledState = latestState;
        throw cancelledErr;
      }
    };

    // ── ACTION: INITIALIZE (PLANNING & OUTLINING) ──
    if (action === "init") {
      if (!userPrompt) {
        return NextResponse.json({ error: "Missing userPrompt for init" }, { status: 400 });
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
            username,
            requestBaseUrl,
            reportSession,
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
            username,
            requestBaseUrl,
            reportSession,
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
        const outlineExample = `[
  {
    "id": "1",
    "title": "Mở đầu",
    "description": "Lý do chọn đề tài, mục tiêu, đối tượng, phạm vi và phương pháp nghiên cứu",
    "subsections": [
      "1. Lý do chọn đề tài",
      "2. Mục tiêu nghiên cứu",
      "3. Đối tượng và phạm vi nghiên cứu",
      "4. Phương pháp nghiên cứu"
    ]
  },
  {
    "id": "2",
    "title": "Chương 1: [Tiêu đề chương lý luận phù hợp với đề tài]",
    "description": "Cơ sở lý luận, khái niệm, vai trò và các tiêu chí đánh giá liên quan đến chủ đề nghiên cứu",
    "subsections": [
      "1.1. [Tiêu mục lý luận thứ nhất]",
      "1.2. [Tiêu mục lý luận thứ hai]",
      "1.3. [Tiêu mục lý luận thứ ba]"
    ]
  },
  {
    "id": "3",
    "title": "Chương 2: [Tiêu đề chương thực trạng tại đơn vị kiến tập]",
    "description": "Phân tích thực trạng hoạt động, số liệu thực tế giai đoạn 2023 - 2025, đánh giá ưu điểm và hạn chế tại đơn vị",
    "subsections": [
      "2.1. Khái quát về đơn vị nghiên cứu",
      "2.2. Phân tích thực trạng chuyên môn thứ nhất",
      "2.3. Phân tích thực trạng chuyên môn thứ hai",
      "2.4. Đánh giá ưu điểm, hạn chế và nguyên nhân"
    ]
  },
  {
    "id": "4",
    "title": "Chương 3: [Tiêu đề chương giải pháp hoàn thiện]",
    "description": "Định hướng phát triển, đề xuất các giải pháp khả thi và kiến nghị nhằm giải quyết hạn chế ở chương 2",
    "subsections": [
      "3.1. Định hướng hoàn thiện hoạt động của đơn vị",
      "3.2. Giải pháp hoàn thiện chuyên môn",
      "3.3. Kiến nghị đối với các cơ quan liên quan"
    ]
  },
  {
    "id": "5",
    "title": "Kết luận",
    "description": "Tổng kết ngắn gọn kết quả nghiên cứu và ý nghĩa thực tiễn",
    "subsections": []
  },
  {
    "id": "6",
    "title": "Danh mục tài liệu tham khảo",
    "description": "Danh sách các văn bản pháp luật, sách, bài báo và nguồn tài liệu tham khảo đã sử dụng",
    "subsections": []
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

        const llmResult = await callLLM(targetModelId, messages, 0.4, authToken, username, requestBaseUrl, reportSession);
        try {
          // Clean markdown block wrappers if LLM returned them
          const cleanedJson = llmResult.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
          parsedOutline = JSON.parse(cleanedJson);
        } catch (jsonErr) {
          console.warn("Failed to parse LLM outline JSON, using default:", jsonErr.message, llmResult);
          parsedOutline = reportContext.internshipReport
            ? buildInternshipB49Outline(reportContext)
            : (reportContext.careerOrientationReport
              ? buildCareerOrientationOutline(reportContext)
              : [
                { id: "1", title: "Chương I: Tổng quan", description: "Giới thiệu chung về đề tài", reportContext },
                { id: "2", title: "Chương II: Nội dung chi tiết", description: "Phân tích thực trạng và số liệu", reportContext },
                { id: "3", title: "Chương III: Kết luận & Đề xuất", description: "Tóm tắt các kiến nghị", reportContext }
              ]);
        }
      }

      if (reportSession.lunaChatId) {
        reportContext.lunaChatId = reportSession.lunaChatId;
      }
      if (reportSession.lunaMessageId) {
        reportContext.lunaMessageId = reportSession.lunaMessageId;
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

      // Remove reference section entirely for BA49 / SL06 / SL07 / EL67 report types
      if (reportContext.internshipReport || reportContext.careerOrientationReport) {
        parsedOutline = parsedOutline.filter((item) => !isReferenceOnlySection(item));
      }

      // Initialize sections_progress array
      // Content sections (exclude references-only) share the word budget; references section has no word target.
      const contentSections = parsedOutline.filter((item) => !isReferenceOnlySection(item));
      const sectionsProgress = parsedOutline.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        level: item.level || 1,
        parent_id: item.parent_id || null,
        subsections: item.subsections || [],
        style_guidance: item.style_guidance || inferSectionTemplateExpectation(item, item.reportContext || reportContext),
        reportContext: item.reportContext || reportContext,
        is_reference_section: isReferenceOnlySection(item),
        target_words: calculateTargetWordsForSection(item, reportContext.targetWords, contentSections),
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
      setReportLunaChatId(newState, reportSession.lunaChatId);
      setReportLunaMessageId(newState, reportSession.lunaMessageId);

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
        const existing = (currentState.sections_progress || []).find((p) => String(p.id) === String(item.id));
        const reportContext = item.reportContext || existing?.reportContext || currentState.outline?.[0]?.reportContext || null;
        const isRefSection = isReferenceOnlySection(item);
        return {
          id: item.id,
          title: adaptOutlineTitleToContext(item.title, reportContext),
          description: item.description || item.title,
          level: item.level || existing?.level || 1,
          parent_id: item.parent_id || existing?.parent_id || null,
          subsections: sanitizeOutlineSubsections(item.subsections || existing?.subsections || [])
            .map((subsection) => adaptOutlineTitleToContext(subsection, reportContext)),
          style_guidance: item.style_guidance || existing?.style_guidance || inferSectionTemplateExpectation(item, reportContext),
          reportContext,
          is_reference_section: isRefSection,
          target_words: isRefSection
            ? 0
            : (existing?.target_words || calculateTargetWordsForSection(item, reportContext?.targetWords, contentSectionsApproved)),
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
      await saveAgentState(chatId, username, currentState, true);

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
      console.log(`[agent/route] Draft worker started chatId=${chatId} sectionId=${nextToDraft.id} model=${targetModelId}`);
      await saveAgentState(chatId, username, currentState, true);
      await throwIfCancelled();

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
      await saveAgentState(chatId, username, currentState, true);

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
      await saveAgentState(chatId, username, currentState, true);

      const runSupabaseRag = async () => {
        if (!supabaseQuery || !username) return "";

        const baseUrl = requestBaseUrl;
        const selectedKnowledgeSubject = activeReportContext?.outlineSource || "";
        const knowledgeUsers = Array.from(
          new Set([username, REPORT_TEMPLATE_CONTENT_USER].filter(Boolean)),
        );
        const allItems = [];

        const dbResults = await Promise.allSettled(
          knowledgeUsers.map(async (knowledgeUser) => {
            const params = new URLSearchParams({
              username: knowledgeUser,
              includeContent: "1",
            });
            if (selectedKnowledgeSubject) params.set("subject", selectedKnowledgeSubject);
            const dbRes = await fetch(`${baseUrl}/api/knowledge-content?${params.toString()}`, {
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

        const rankedChunks = rankKnowledgeItems(supabaseQuery, allItems, 2);

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

        if (process.env.NODE_ENV !== "production") {
          console.log("[agent/route] Web RAG Tavily query:", webQuery);
        }
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
      await saveAgentState(chatId, username, currentState, true);
      await throwIfCancelled();

      // Construct drafting prompt (Scope Control)
      const previousDone = progress.filter((p) => p.status === "done");
      const lastDoneContent = previousDone.length > 0 ? previousDone[previousDone.length - 1].content : "";

      const isB49 = isInternshipB49ReportSection(nextToDraft);
      const isCareer = isCareerOrientationReportSection(nextToDraft);
      const layoutInstruction = prompts.getLayoutInstruction ? prompts.getLayoutInstruction() : "";
      
      let systemPrompt = "";
      if (isCareer) {
        systemPrompt = prompts.getDraftingSystemCareer({
          layoutInstruction,
          analysisYearsText: activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", "),
          reportContextPromptText: reportContextPrompt(activeReportContext, progress.length, nextToDraft.target_words),
          outlineJsonString: JSON.stringify(currentState.outline, null, 2),
          lastDoneContent,
        });
      } else if (isB49) {
        systemPrompt = prompts.getDraftingSystemB49({
          layoutInstruction,
          analysisYearsText: activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", "),
          reportContextPromptText: reportContextPrompt(activeReportContext, progress.length, nextToDraft.target_words),
          outlineJsonString: JSON.stringify(currentState.outline, null, 2),
          lastDoneContent,
        });
      } else {
        systemPrompt = prompts.getDraftingSystemStandard({
          layoutInstruction,
          analysisYearsText: activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", "),
          financialAccounting: !!activeReportContext?.financialAccounting,
          legalEconomic: !!activeReportContext?.legalEconomic,
          reportContextPromptText: reportContextPrompt(activeReportContext, progress.length, nextToDraft.target_words),
          outlineJsonString: JSON.stringify(currentState.outline, null, 2),
          lastDoneContent,
        });
      }

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
      await saveAgentState(chatId, username, currentState, true);

      let draftResult = "";
      let attempts = 0;
      const maxDraftAttempts = 3;

      while (attempts < maxDraftAttempts) {
        attempts++;
        try {
          if (attempts > 1) {
            const { data: updatedState } = await getAgentState(chatId, username);
            if (updatedState?.current_step === "CANCELLED") {
              normalizeAgentState(updatedState);
              return NextResponse.json({ ok: true, state: updatedState, message: "Agent run cancelled." });
            }
            const stateToSave = updatedState || currentState;

            // Immediately clear Luna Chat ID for retry to ensure it hits a new chat room
            reportSession.lunaChatId = "";
            reportSession.lunaMessageId = "";
            const applyClear = (reportContext) => {
              if (!reportContext || typeof reportContext !== "object") return reportContext;
              return { ...reportContext, lunaChatId: "", lunaMessageId: "" };
            };
            if (Array.isArray(stateToSave.outline)) {
              stateToSave.outline = stateToSave.outline.map((item) => item && typeof item === "object"
                ? { ...item, reportContext: applyClear(item.reportContext) }
                : item);
            }
            if (Array.isArray(stateToSave.sections_progress)) {
              stateToSave.sections_progress = stateToSave.sections_progress.map((item) => item && typeof item === "object"
                ? { ...item, reportContext: applyClear(item.reportContext) }
                : item);
            }

            setAgentActivity(
              stateToSave,
              nextToDraft,
              "drafting_retry",
              `Lỗi xử lý mục: không thấy nội dung báo cáo. Hệ thống đang tự động khởi tạo chat Qwen mới để xử lý lại (lần ${attempts}/${maxDraftAttempts})...`,
              {
                actor: "Writer",
                model: targetModelId,
                sectionId: nextToDraft.id,
                attempt: attempts,
              }
            );
            await saveAgentState(chatId, username, stateToSave, false);
          }

          await throwIfCancelled();
          const rawDraft = await callLLM(targetModelId, messages, 0.5, authToken, username, requestBaseUrl, reportSession);
          console.log(`[DEBUG DRAFT] rawDraft length: ${rawDraft ? rawDraft.length : 0}`);
          if (rawDraft && rawDraft.length < 500) {
            console.log(`[DEBUG DRAFT] rawDraft snippet: "${rawDraft}"`);
          } else if (rawDraft) {
            console.log(`[DEBUG DRAFT] rawDraft snippet: "${rawDraft.slice(0, 300)}..."`);
          } else {
            console.log(`[DEBUG DRAFT] rawDraft is null or undefined`);
          }
          draftResult = sanitizeReportDraftContent(rawDraft);
          if (isB49OpeningSection(nextToDraft)) {
            draftResult = sanitizeB49OpeningDraftContent(draftResult);
          }
          
          // Strict sanitization logic for Section IV of Career Orientation Reports (or B49)
          const isSectionIV = /xac\s+nhan\s+cua\s+can\s+bo\s+huong\s+dan/i.test(normalizeOutlineMatchText(nextToDraft.title)) ||
                              /4\.[123]\b/.test(normalizeOutlineMatchText(nextToDraft.title)) ||
                              (nextToDraft.parent_id && currentState.outline.some(p => p.id === nextToDraft.parent_id && /xac\s+nhan/i.test(normalizeOutlineMatchText(p.title))));
          
          const isSection43 = /4\.3\b/.test(normalizeOutlineMatchText(nextToDraft.title)) || /danh\s*gia/i.test(normalizeOutlineMatchText(nextToDraft.title));

          if (isSectionIV && draftResult) {
            if (isSection43) {
              const lines = draftResult.split("\n");
              const cleanLines = [];
              let seenSignatureTable = false;
              let stopKeeping = false;
              
              for (let line of lines) {
                const trimmed = line.trim();
                if (stopKeeping) {
                  continue;
                }
                if (trimmed.startsWith("|") && /c[áâ]n\s+bộ\s+hướng\s+dẫn|người\s+xác\s+nhận/i.test(trimmed)) {
                  seenSignatureTable = true;
                }
                if (seenSignatureTable && !trimmed.startsWith("|") && trimmed !== "") {
                  stopKeeping = true;
                  continue;
                }
                cleanLines.push(line);
              }
              draftResult = cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
            } else {
              // Cut out extra paragraphs. Only keep tables, blocks between center tags, signature tables, and short forms for 4.1 & 4.2.
              const lines = draftResult.split("\n");
              let inTable = false;
              let inCenter = false;
              let keepAll = false;
              const cleanLines = [];
              
              for (let line of lines) {
                const trimmed = line.trim();
                
                // If we see the national motto or center title, disable stripping from here onwards
                if (/cộng\s+hòa\s+xã\s+hội|cong\s+hoa\s+xa\s+hoi/i.test(trimmed)) {
                  keepAll = true;
                }
                
                if (keepAll) {
                  cleanLines.push(line);
                  continue;
                }

                if (trimmed.startsWith("|")) {
                  inTable = true;
                  cleanLines.push(line);
                  continue;
                }
                if (inTable && !trimmed.startsWith("|")) {
                  inTable = false;
                }
                if (trimmed.toLowerCase().includes("<center>")) {
                  inCenter = true;
                  cleanLines.push(line);
                  continue;
                }
                if (trimmed.toLowerCase().includes("</center>")) {
                  inCenter = false;
                  cleanLines.push(line);
                  continue;
                }
                if (inCenter) {
                  cleanLines.push(line);
                  continue;
                }
                // Keep headings, bold labels, signature lines, short bullet lines, and lines starting with numbers/TT
                if (
                  trimmed.startsWith("#") ||
                  trimmed.startsWith("**") ||
                  trimmed.startsWith("*") ||
                  /^(?:\d+|[IVXLCDM]+)\./i.test(trimmed) ||
                  /^Tôi\s+là/i.test(trimmed) ||
                  trimmed === ""
                ) {
                  cleanLines.push(line);
                }
              }
              draftResult = cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
            }
          }

          if (draftResult) {
            draftResult = draftResult.replace(/\|\s*([^\n|]*?xác\s+nhận\s+của\s+cơ\s+quan[^\n|]*?)\s*\|/gi, "| **XÁC NHẬN CỦA CƠ QUAN**<br>*(Kí tên và đóng dấu)* |");
          }

          await throwIfCancelled();
          if (reportSession.lunaChatId) {
            setReportLunaChatId(currentState, reportSession.lunaChatId);
          }
          if (reportSession.lunaMessageId) {
            setReportLunaMessageId(currentState, reportSession.lunaMessageId);
          }

          if (hasSubstantiveDraftContent(draftResult)) {
            break;
          }
          if (isLunaModelId(targetModelId) && attempts < maxDraftAttempts) {
            reportSession.lunaChatId = "";
            reportSession.lunaMessageId = "";
            
            // Clear in currentState as well so it doesn't get persisted back
            const applyClear = (reportContext) => {
              if (!reportContext || typeof reportContext !== "object") return reportContext;
              return { ...reportContext, lunaChatId: "", lunaMessageId: "" };
            };
            if (Array.isArray(currentState.outline)) {
              currentState.outline = currentState.outline.map((item) => item && typeof item === "object"
                ? { ...item, reportContext: applyClear(item.reportContext) }
                : item);
            }
            if (Array.isArray(currentState.sections_progress)) {
              currentState.sections_progress = currentState.sections_progress.map((item) => item && typeof item === "object"
                ? { ...item, reportContext: applyClear(item.reportContext) }
                : item);
            }

            setAgentActivity(currentState, nextToDraft, "drafting_retry_fresh_luna_chat", `Luna trả về nội dung rỗng. Hệ thống đang thử lại bằng một chat Qwen mới (lần ${attempts + 1}/${maxDraftAttempts})...`, {
              actor: "Writer",
              model: targetModelId,
              sectionId: nextToDraft.id,
              attempt: attempts + 1,
            });
            // Force save to Supabase (skipSupabase = false) so the DB status is cleared
            await saveAgentState(chatId, username, currentState, false);
          }
        } catch (err) {
          if (err?.code === "AGENT_CANCELLED" || err?.message === "AGENT_CANCELLED") {
            const cancelledState = err.cancelledState || (await getAgentState(chatId, username)).data || currentState;
            normalizeAgentState(cancelledState);
            return NextResponse.json({ ok: true, state: cancelledState, message: "Agent run cancelled." });
          }
          console.error(`[agent/route] Attempt ${attempts} failed to draft section ${nextToDraft.id}:`, err);
          if (attempts >= maxDraftAttempts) {
            throw err;
          }
        }
      }

      const { data: latestStateBeforeSave } = await getAgentState(chatId, username);
      if (latestStateBeforeSave?.current_step === "CANCELLED") {
        normalizeAgentState(latestStateBeforeSave);
        return NextResponse.json({ ok: true, state: latestStateBeforeSave, message: "Agent run cancelled." });
      }

      if (!hasSubstantiveDraftContent(draftResult)) {
        const stateToSave = latestStateBeforeSave || currentState;
        normalizeAgentState(stateToSave);
        
        // Ensure ALL cached Luna IDs are 100% wiped on ultimate failure so manual retry starts clean
        const applyClear = (reportContext) => {
          if (!reportContext || typeof reportContext !== "object") return reportContext;
          return { ...reportContext, lunaChatId: "", lunaMessageId: "" };
        };
        if (Array.isArray(stateToSave.outline)) {
          stateToSave.outline = stateToSave.outline.map((item) => item && typeof item === "object"
            ? { ...item, reportContext: applyClear(item.reportContext) }
            : item);
        }
        if (Array.isArray(stateToSave.sections_progress)) {
          stateToSave.sections_progress = stateToSave.sections_progress.map((item) => item && typeof item === "object"
            ? { ...item, reportContext: applyClear(item.reportContext) }
            : item);
        }

        const targetSection = stateToSave.sections_progress?.find((s) => String(s.id) === String(nextToDraft.id));
        if (targetSection) {
          targetSection.status = "todo";
          targetSection.content = "";
          targetSection.feedback = "LLM trả về phản hồi rỗng sau nhiều lần thử; mục này chưa được soạn.";
          setAgentActivity(stateToSave, targetSection, "draft_empty_failed", "LLM không trả về nội dung báo cáo thật cho mục này. Hệ thống đã giữ mục ở trạng thái chờ để tránh đánh dấu hoàn thành rỗng.", {
            actor: "Writer",
            model: targetModelId,
            sectionId: nextToDraft.id,
            attempts: maxDraftAttempts,
          });
        }
        await saveAgentState(chatId, username, stateToSave, false);
        return NextResponse.json({
          ok: true,
          emptyDraft: true,
          state: stateToSave,
          activeSectionId: nextToDraft.id,
          message: `LLM returned empty draft content for section ${nextToDraft.id} after ${maxDraftAttempts} attempts.`,
        });
      }

      if (!REPORT_ENABLE_CRITIC) {
        const stateToSave = latestStateBeforeSave || currentState;
        normalizeAgentState(stateToSave);
        setReportLunaChatId(stateToSave, reportSession.lunaChatId);
        setReportLunaMessageId(stateToSave, reportSession.lunaMessageId);

        const targetSection = stateToSave.sections_progress.find((s) => String(s.id) === String(nextToDraft.id));
        if (targetSection) {
          targetSection.status = "done";
          targetSection.content = draftResult;
          targetSection.feedback = "";
          targetSection.web_sources = webSources;
          
          // Save the completed section content to Turso DB
          const reportTitle = activeReportContext?.subject || "Unknown Report";
          try {
            await turso.execute({
              sql: `
                INSERT INTO report_sections (id, chat_id, username, report_title, section_id, section_title, content)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(chat_id, section_id) DO UPDATE SET 
                  content = excluded.content,
                  section_title = excluded.section_title,
                  report_title = excluded.report_title,
                  updated_at = CURRENT_TIMESTAMP
              `,
              args: [
                crypto.randomUUID(), 
                chatId, 
                username, 
                reportTitle, 
                targetSection.id, 
                targetSection.title, 
                draftResult
              ],
            });
            console.log(`[agent/route] Saved section ${targetSection.id} to Turso for chat_id=${chatId}`);
          } catch (tursoErr) {
            console.error("[agent/route] Failed to save section to Turso:", tursoErr);
          }

          setAgentActivity(stateToSave, targetSection, "section_completed", "Mục này đã được soạn xong.", {
            actor: "Writer",
            approved: true,
            criticSkipped: true,
          });
        }

        await saveAgentState(chatId, username, stateToSave);

        const stillTodo = stateToSave.sections_progress.find((p) => p.status === "todo" || p.status === "drafting");
        if (!stillTodo) {
          stateToSave.current_step = "COMPLETED";
          setAgentActivity(stateToSave, null, "report_completed", "Tất cả mục trong báo cáo đã hoàn tất.", {
            actor: "Report Agent",
            sections: stateToSave.sections_progress.length,
          });
          await saveAgentState(chatId, username, stateToSave);
        }

        return NextResponse.json({ ok: true, state: stateToSave, activeSectionId: nextToDraft.id, draftResult });
      }

      // Verify step (Critic loop - automated or lightweight)
      // For automated verification: we run a critic prompt to check quality.
      const criticSystem = prompts.getCriticSystem(
        activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", "),
        !!activeReportContext?.careerOrientationReport,
        nextToDraft.id,
        nextToDraft.title
      );

      const criticMessages = [
        { role: "system", content: criticSystem },
        { role: "user", content: `Đoạn văn thảo luận:\n${draftResult}` }
      ];

      setAgentActivity(currentState, nextToDraft, "reviewing_draft", "Agent đang kiểm định chất lượng nội dung vừa soạn.", {
        actor: "Critic",
        sectionId: nextToDraft.id,
      });
      await saveAgentState(chatId, username, currentState, true);

      const criticResult = await callLLM(targetModelId, criticMessages, 0.2, authToken, username, requestBaseUrl, reportSession);
      await throwIfCancelled();
      if (reportSession.lunaChatId) {
        setReportLunaChatId(currentState, reportSession.lunaChatId);
      }
      if (reportSession.lunaMessageId) {
        setReportLunaMessageId(currentState, reportSession.lunaMessageId);
      }
      const isApproved = criticResult.toUpperCase().includes("APPROVED");

      const { data: latestStateAfterCritic } = await getAgentState(chatId, username);

      if (latestStateAfterCritic?.current_step === "CANCELLED") {
        normalizeAgentState(latestStateAfterCritic);
        return NextResponse.json({ ok: true, state: latestStateAfterCritic, message: "Agent run cancelled." });
      }

      const stateToSave = latestStateAfterCritic || currentState;
      normalizeAgentState(stateToSave);
      setReportLunaChatId(stateToSave, reportSession.lunaChatId);
      setReportLunaMessageId(stateToSave, reportSession.lunaMessageId);

      const targetSection = stateToSave.sections_progress.find((s) => String(s.id) === String(nextToDraft.id));
      if (targetSection) {
        targetSection.content = draftResult;
        targetSection.web_sources = webSources;
        if (isApproved) {
          targetSection.status = "done";
          targetSection.feedback = "";
          
          // Save the completed section content to Turso DB
          const reportTitle = activeReportContext?.subject || "Unknown Report";
          try {
            await turso.execute({
              sql: `
                INSERT INTO report_sections (id, chat_id, username, report_title, section_id, section_title, content)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(chat_id, section_id) DO UPDATE SET 
                  content = excluded.content,
                  section_title = excluded.section_title,
                  report_title = excluded.report_title,
                  updated_at = CURRENT_TIMESTAMP
              `,
              args: [
                crypto.randomUUID(), 
                chatId, 
                username, 
                reportTitle, 
                targetSection.id, 
                targetSection.title, 
                draftResult
              ],
            });
            console.log(`[agent/route] Saved section ${targetSection.id} to Turso for chat_id=${chatId}`);
          } catch (tursoErr) {
            console.error("[agent/route] Failed to save section to Turso:", tursoErr);
          }

          setAgentActivity(stateToSave, targetSection, "section_completed", "Mục này đã được soạn và kiểm định đạt yêu cầu.", {
            actor: "Critic",
            approved: true,
          });
        } else {
          // Do not keep the same section in "drafting" forever. Save the draft and
          // preserve critic feedback for later manual review instead of blocking the queue.
          targetSection.status = "done";
          targetSection.feedback = criticResult.replace(/^REJECTED\s*/i, "").trim();
          setAgentActivity(stateToSave, targetSection, "section_completed_with_notes", "Mục này đã được soạn xong nhưng có ghi chú kiểm định cần xem lại.", {
            actor: "Critic",
            approved: false,
          });
        }
      }

      await saveAgentState(chatId, username, stateToSave);

      // Check if all are done now
      const stillTodo = stateToSave.sections_progress.find((p) => p.status === "todo" || p.status === "drafting");
      if (!stillTodo) {
        stateToSave.current_step = "COMPLETED";
        setAgentActivity(stateToSave, null, "report_completed", "Tất cả mục trong báo cáo đã hoàn tất.", {
          actor: "Report Agent",
          sections: stateToSave.sections_progress.length,
        });
        await saveAgentState(chatId, username, stateToSave);
      }

      return NextResponse.json({ ok: true, state: stateToSave, activeSectionId: nextToDraft.id, draftResult });
    }

    // ── ACTION: RELOAD SECTION ──
    if (action === "reload_section") {
      if (!currentState) {
        return NextResponse.json({ error: "State not found" }, { status: 404 });
      }
      const { sectionId } = body || {};
      if (!sectionId) {
        return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
      }

      normalizeAgentState(currentState);
      const progress = currentState.sections_progress || [];
      const section = progress.find((p) => String(p.id) === String(sectionId));
      if (!section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }

      // Reset the target section
      section.status = "todo";
      section.content = "";
      section.feedback = "";
      section.web_sources = [];
      section.activity = null;
      section.activity_history = [];

      // Reset Luna credentials for this section/chat context if any
      const applyClear = (reportContext) => {
        if (!reportContext || typeof reportContext !== "object") return reportContext;
        return { ...reportContext, lunaChatId: "", lunaMessageId: "" };
      };
      section.reportContext = applyClear(section.reportContext);

      // Dynamically sync template subsections for career orientation reports on reload
      if (section.reportContext?.careerOrientationReport) {
        const template = buildCareerOrientationOutline(section.reportContext);
        const templateSection = template.find((t) => String(t.id) === String(section.id));
        if (templateSection) {
          section.subsections = templateSection.subsections || [];
          section.title = templateSection.title || section.title;
          section.description = templateSection.description || section.description;
        }
      }

      // Re-activate DRAFTING step
      currentState.current_step = "DRAFTING";
      setAgentActivity(currentState, section, "section_reload_triggered", `Đặt lại mục để tạo lại: ${section.title}`, {
        actor: "User",
        sectionId: section.id,
      });

      await saveAgentState(chatId, username, currentState);
      return NextResponse.json({ ok: true, state: currentState });
    }

    // ── ACTION: STATUS QUERY ──
    if (action === "status") {
      if (!currentState) {
        return NextResponse.json({ ok: false, state: null });
      }
      const beforeNormalize = JSON.parse(JSON.stringify(currentState));
      normalizeAgentState(currentState);
      if (hasStateChanged(beforeNormalize, currentState)) {
        const isFinished = currentState.current_step === "COMPLETED" || currentState.current_step === "CANCELLED";
        await saveAgentState(chatId, currentState.username || username, currentState, !isFinished);
      }
      return NextResponse.json({ ok: true, state: currentState });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[agent/route] POST error:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
