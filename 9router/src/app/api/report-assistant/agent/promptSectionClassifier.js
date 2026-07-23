import {
  isOpeningSection,
  isConclusionSection,
  isReferenceOnlySection,
  isInternshipB49ReportSection,
  isCareerOrientationReportSection,
  normalizeOutlineMatchText,
} from "./utils";

/**
 * Phân loại mục đang soạn thảo thành một trong các sectionType:
 * - 'opening': Lời mở đầu / Mở đầu
 * - 'references': Danh mục tài liệu tham khảo
 * - 'conclusion': Kết luận
 * - 'b49_form': Các biểu mẫu tĩnh / phần xác nhận (Section IV của Career, Nhận xét kiến tập của B49)
 * - 'theory': Chương 1 / Lý luận / Tổng quan / Khái niệm
 * - 'analysis': Chương 2 / Thực trạng / Phân tích số liệu
 * - 'solution': Chương 3 / Giải pháp / Kiến nghị / Hoàn thiện
 */
export function classifySection(section, reportContext = null) {
  if (!section) return "analysis";

  if (isReferenceOnlySection(section)) {
    return "references";
  }

  if (isConclusionSection(section)) {
    return "conclusion";
  }

  if (isOpeningSection(section)) {
    return "opening";
  }

  const titleText = typeof section === "string" ? section : (section?.title || "");
  const descText = section?.description || "";
  const normalized = normalizeOutlineMatchText(`${titleText} ${descText}`);

  // Kiểm tra section form tĩnh / xác nhận
  const isCareer = reportContext?.careerOrientationReport || isCareerOrientationReportSection(section);
  const isB49 = reportContext?.internshipReport || isInternshipB49ReportSection(section);

  if (isCareer && (/\b4\.[123]\b/.test(normalized) || /\bxac nhan cua can bo huong dan\b/.test(normalized) || /\bdanh gia ket qua thuc tap\b/.test(normalized))) {
    return "b49_form";
  }

  if (isB49 && /\bnhan xet kien tap\b/.test(normalized)) {
    return "b49_form";
  }

  // Kiểm tra Chương 1: Lý luận / Khái niệm / Cơ sở lý luận / Giới thiệu tổng quan
  if (
    /\b(chuong 1|chuong i\b|co so ly luan|khai niem|tong quan|gioi thieu ve|co cau to chuc|lich su hinh thanh)\b/.test(normalized)
  ) {
    return "theory";
  }

  // Kiểm tra Chương 3: Giải pháp / Kiến nghị / Hoàn thiện / Đề xuất
  if (
    /\b(chuong 3|chuong iii\b|giai phap|kien nghi|hoan thien|dinh huong|de xuat)\b/.test(normalized)
  ) {
    return "solution";
  }

  // Kiểm tra Chương 2: Thực trạng / Phân tích / Đánh giá
  if (
    /\b(chuong 2|chuong ii\b|thuc trang|phan tich|danh gia|ket qua kinh doanh|tinh hinh)\b/.test(normalized)
  ) {
    return "analysis";
  }

  return "analysis";
}

/**
 * Xây dựng query RAG tối ưu dựa trên sectionType
 */
export function buildSectionAwareRAGQuery(cleanTitle, sectionType, activeReportContext) {
  let typeKeyword = "";
  switch (sectionType) {
    case "theory":
      typeKeyword = "cơ sở lý luận khái niệm quy định";
      break;
    case "analysis":
      typeKeyword = "thực trạng phân tích số liệu kết quả";
      break;
    case "solution":
      typeKeyword = "giải pháp kiến nghị đề xuất hoàn thiện";
      break;
    case "opening":
      typeKeyword = "lý do chọn đề tài mục tiêu nghiên cứu";
      break;
    case "conclusion":
      typeKeyword = "tóm tắt kết quả bài học kinh nghiệm";
      break;
    default:
      typeKeyword = "";
  }

  let query = cleanTitle;
  if (activeReportContext) {
    const contextQuery = [
      activeReportContext.studyIssue,
      activeReportContext.targetCompany,
      typeKeyword,
    ]
      .filter(Boolean)
      .join(" ");
    query = `${contextQuery} ${cleanTitle}`.trim();
  } else if (typeKeyword) {
    query = `${typeKeyword} ${cleanTitle}`.trim();
  }

  return query;
}
