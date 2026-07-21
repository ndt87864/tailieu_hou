import {
  getLastCompletedYears,
  isFinancialAccountingSubject,
  isLegalEconomicSubject,
  extractTargetCompanyFromPrompt,
  inferStudyIssue,
  isExplicitB49Report,
  isExplicitCareerOrientationReport,
  normalizeOutlineMatchText,
} from "../utils";

export function buildReportContext(userPrompt, subject, outlineSource) {
  const requestedPages = extractRequestedPages(userPrompt);
  const targetCompany = extractTargetCompanyFromPrompt(userPrompt) || "đơn vị được yêu cầu";
  const studyIssue = inferStudyIssue(userPrompt, `${subject || ""} ${outlineSource || ""} ${targetCompany}`);
  const internshipReport = isExplicitB49Report(`${userPrompt || ""} ${subject || ""} ${outlineSource || ""} ${studyIssue}`);
  const careerOrientationReport = !internshipReport && isExplicitCareerOrientationReport(`${userPrompt || ""} ${subject || ""} ${outlineSource || ""} ${studyIssue}`);
  const reportTitle = internshipReport
    ? `Báo cáo kiến tập thực tế tại ${targetCompany}`
    : (careerOrientationReport
      ? `Báo cáo thực tập định hướng nghề nghiệp tại ${targetCompany}`
      : `Khóa luận tốt nghiệp về ${studyIssue} tại ${targetCompany}`);
  const analysisYears = getLastCompletedYears(3);
  let financialAccounting = isFinancialAccountingSubject(`${userPrompt || ""} ${subject || ""} ${outlineSource || ""} ${studyIssue}`);
  let legalEconomic = isLegalEconomicSubject(`${userPrompt || ""} ${subject || ""} ${outlineSource || ""} ${studyIssue}`);

  // Tránh xung đột chuyên ngành khi cả hai cùng bật. Ưu tiên theo bối cảnh chính của studyIssue.
  if (financialAccounting && legalEconomic) {
    const studyIssueNormalized = normalizeOutlineMatchText(studyIssue);
    if (studyIssueNormalized.includes("phap ly") || studyIssueNormalized.includes("luat") || studyIssueNormalized.includes("phap luat")) {
      financialAccounting = false;
    } else {
      legalEconomic = false;
    }
  }

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

export function extractRequestedPages(prompt) {
  const match = String(prompt || "").match(/(\d+)\s*(?:trang|pages?)/i);
  const pages = match ? Number(match[1]) : 0;
  return Number.isFinite(pages) && pages > 0 ? pages : 0;
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
    "- THỨ TỰ ƯU TIÊN KHI VIẾT BÁO CÁO: (1) Yêu cầu của người dùng, (2) Phong cách và văn phong của báo cáo mẫu đã tải lên, (3) Đề cương Supabase để giữ cấu trúc, (4) Tri thức Supabase / tài liệu nội bộ làm nguồn hỗ trợ cuối cùng.",
    "- Khi có mâu thuẫn giữa báo cáo mẫu và tri thức Supabase, hãy ưu tiên báo cáo mẫu và yêu cầu hiện tại của người dùng; Supabase chỉ là nguồn bổ trợ cuối cùng.",
    !reportContext.careerOrientationReport && reportContext.financialAccounting
      ? "- BẮT BUỘC CHO TÀI CHÍNH/KẾ TOÁN/NGÂN HÀNG (Không áp dụng cho báo cáo Thực tập định hướng nghề nghiệp):\n" +
        "  * Trong các mục phân tích/thực trạng/đánh giá, phải có bảng Markdown với đủ 3 cột năm " + (reportContext.analysisYearLabel || "2023, 2024, 2025") + " và đơn vị tính.\n" +
        "  * Phải có phép tính/công thức minh họa ít nhất một chỉ tiêu phù hợp, ví dụ: ROA = Lợi nhuận sau thuế / Tổng tài sản bình quân; ROE = Lợi nhuận sau thuế / Vốn chủ sở hữu bình quân; Biên lợi nhuận ròng = Lợi nhuận sau thuế / Doanh thu thuần.\n" +
        "  * Sau mỗi bảng phải có đoạn nhận xét 120-180 từ, phân tích tăng/giảm, nguyên nhân và ý nghĩa quản trị.\n" +
        "  * Nếu mục liên quan quy trình/cơ cấu/dòng tiền, phải có sơ đồ Mermaid 'flowchart TD' hoặc danh sách quy trình tương đương, theo phong cách báo cáo mẫu.\n" +
        "  * Không được viết toàn văn xuôi nếu mục thuộc phân tích tài chính/kế toán; phải có bảng, phép tính và nhận xét."
      : "",
    !reportContext.careerOrientationReport && reportContext.legalEconomic
      ? "- BẮT BUỘC CHO LUẬT/LUẬT KINH TẾ/PHÁP LÝ (Không áp dụng cho báo cáo Thực tập định hướng nghề nghiệp):\n" +
        "  * Trục nội dung phải là cơ sở pháp lý, quy định hiện hành, thực trạng áp dụng pháp luật/dịch vụ pháp lý tại đơn vị, rủi ro pháp lý và giải pháp hoàn thiện.\n" +
        "  * Nếu nhắc tới hoạt động doanh nghiệp, chỉ dùng để làm bối cảnh pháp lý; không chuyển nội dung sang quản trị kinh doanh/marketing/tài chính.\n" +
        "  * Trong mục lý luận hoặc thực trạng, nên có bảng hệ thống hóa văn bản pháp luật/nhóm quy định/quyền-nghĩa vụ/rủi ro pháp lý nếu phù hợp.\n" +
        "  * Với mục quy trình tuân thủ, hợp đồng, tư vấn hoặc xử lý tranh chấp, cần trình bày quy trình dạng bảng hoặc Mermaid 'flowchart TD'.\n" +
        "  * Văn phong phải là phân tích pháp lý: căn cứ, điều kiện áp dụng, hệ quả pháp lý, rủi ro và kiến nghị."
      : "",
    reportContext.templateStyleGuide
      ? `\nQUY TẮC ĐÃ HỌC TỪ BÁO CÁO MẪU CHẤT LƯỢNG CAO - BẮT BUỘC NOI THEO HỢP LÝ, KHÔNG SAO CHÉP:\n${reportContext.templateStyleGuide}`
      : "",
  ].filter(Boolean).join("\n");
}
