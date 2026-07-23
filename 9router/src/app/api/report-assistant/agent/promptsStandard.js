import { getSharedDraftingBase } from "./promptsBaseDraft";
import { normalizeOutlineMatchText } from "./utils";

export function getDraftingSystemStandard({
  analysisYearsText,
  reportContextPromptText,
  outlineJsonString,
  lastDoneContent,
  sectionType = "analysis",
}) {
  const basePrompt = getSharedDraftingBase({ analysisYearsText });

  const normalizedContextText = normalizeOutlineMatchText(reportContextPromptText);
  const isFinance = /\b(tai chinh|ke toan|ngan hang|loi nhuan|doanh thu|bctc)\b/i.test(normalizedContextText);
  const isLegal = /\b(luat|phap ly|tu van|hop dong|tranh chap)\b/i.test(normalizedContextText);

  // 1. Field specific instructions (chỉ khi sectionType là theory, analysis, hoặc solution)
  let fieldSpecificInstructions = "";
  if (["theory", "analysis", "solution"].includes(sectionType)) {
    if (isFinance) {
      fieldSpecificInstructions = `
⚠️ CHỈ THỊ CHUYÊN BIỆT CHO ĐỀ TÀI TÀI CHÍNH/KẾ TOÁN/NGÂN HÀNG:
- BẮT BUỘC: Các mục phân tích thực trạng phải có bảng biểu so sánh dữ liệu thực tế 3 năm (${analysisYearsText}).
- BẮT BUỘC: Phải trình bày chi tiết công thức tính toán chỉ tiêu tài chính liên quan (ROA, ROE, biên lợi nhuận...) và có nhận xét phân tích nguyên nhân biến động sau bảng rõ ràng (tối thiểu 120-180 từ).
- Phải lập luận các con số theo mối liên hệ biện chứng (doanh thu tăng kéo theo cái gì, chi phí quản lý doanh nghiệp tăng do đâu...). Không được ghi chung chung.`;
    } else if (isLegal) {
      fieldSpecificInstructions = `
⚠️ CHỈ THỊ CHUYÊN BIỆT CHO ĐỀ TÀI LUẬT/PHÁP LÝ/HỢP ĐỒNG:
- BẮT BUỘC: Trục nội dung chính phải xoay quanh các cơ sở pháp lý, quy định hiện hành, thực trạng áp dụng luật, rủi ro pháp lý và giải pháp pháp lý.
- BẮT BUỘC: Dẫn chiếu chính xác tên, số hiệu, ngày ban hành và cơ quan ban hành của các văn bản pháp luật hiện hành.
- Tuyệt đối không lái đề tài sang hướng Quản trị kinh doanh hay Marketing. Phải dùng ngôn ngữ phân tích pháp chế chuẩn mực.`;
    }
  }

  // 2. Format / Diagram rules (chỉ áp dụng cho analysis và theory/solution chính)
  let visualRules = "";
  if (sectionType === "analysis" || sectionType === "theory" || sectionType === "solution") {
    visualRules = `
BẮT BUỘC VỀ ĐỘ CHI TIẾT VÀ DUNG LƯỢNG LỚN:
- Đối với các chương chính, mỗi mục con bắt buộc phải triển khai thành ít nhất 4-5 đoạn văn phân tích, với dung lượng của mỗi mục con bắt buộc phải đạt tối thiểu từ 880 - 1.100 từ.

BẮT BUỘC VỀ BẢNG BIỂU VÀ SƠ ĐỒ DÀNH CHO CÁC CHƯƠNG CHÍNH:
- Trong mỗi Chương chính của báo cáo, bạn bắt buộc phải thiết kế và chèn ít nhất:
  1. Ít nhất một (01) bảng biểu Markdown (đầy đủ các cột số liệu hoặc tổng hợp phân tích thực tế giai đoạn ${analysisYearsText} đối với chỉ số thông thường, hoặc 2024 - 2026 (dự kiến) đối với bảng doanh thu, tăng trưởng).
  2. Ít nhất một (01) sơ đồ Mermaid dạng "flowchart TD" mô tả cấu trúc, quy trình làm việc hoặc luồng dữ liệu. Dưới mỗi sơ đồ "flowchart" này bắt buộc phải có một dòng chú thích rõ ràng ở dạng chữ nghiêng.
- Sau mỗi bảng biểu và sơ đồ, bắt buộc phải viết đoạn nhận xét, thuyết minh chi tiết tối thiểu 120-180 từ.`;
  }

  // Trimmed last done content (chỉ giữ 500 ký tự gần nhất)
  const trimmedLastContent = lastDoneContent && lastDoneContent.length > 500
    ? `...${lastDoneContent.slice(-500)}`
    : lastDoneContent;

  return `${basePrompt}
${fieldSpecificInstructions}
${visualRules}

${reportContextPromptText}

CẤU TRÚC ĐỀ CƯƠNG BÁO CÁO:
${outlineJsonString}

${trimmedLastContent ? `\nNỘI DUNG MỤC TRƯỚC ĐÓ (Dùng để bảo đảm sự liên kết, tiếp nối văn phong mạch lạc):\n${trimmedLastContent}` : ""}`;
}
