export const REPORT_KNOWLEDGE_GLOBAL_USER = "global";
export const REPORT_OUTLINE_CONTENT_USER = `report_assistant_outlines_${REPORT_KNOWLEDGE_GLOBAL_USER}`;
export const REPORT_TEMPLATE_CONTENT_USER = `report_assistant_templates_${REPORT_KNOWLEDGE_GLOBAL_USER}`;

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
  return /\b(luat|phap luat|luat kinh te|kinh te luat|phap ly|hop dong|doanh nghiep|thuong mai|tranh chap|tu van phap luat|dich vu phap ly|to tung|tu phap)\b/.test(normalized);
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

export function extractRequestedPages(prompt) {
  const match = String(prompt || "").match(/(\d+)\s*(?:trang|pages?)/i);
  const pages = match ? Number(match[1]) : 0;
  return Number.isFinite(pages) && pages > 0 ? pages : 0;
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

export function buildReportContext(userPrompt, subject, outlineSource) {
  const requestedPages = extractRequestedPages(userPrompt);
  const targetCompany = extractTargetCompanyFromPrompt(userPrompt) || "đơn vị được yêu cầu";
  const studyIssue = inferStudyIssue(userPrompt, `${subject || ""} ${outlineSource || ""}`);
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

export function reportContextPrompt(reportContext, sectionCount = 1, overrideSectionTarget = 0) {
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

export function cleanOutlineLine(line) {
  return String(line || "")
    .replace(/^\uFEFF/, "")
    .replace(/^(?:dòng|dong)\s+\d+\s*:\s*/i, "")
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeReportDraftContent(content) {
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

export function normalizeOutlineMatchText(line) {
  return cleanOutlineLine(line)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export function isReferenceOnlySection(titleOrSection) {
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
