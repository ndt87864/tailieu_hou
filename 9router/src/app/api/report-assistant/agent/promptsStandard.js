import { getSharedDraftingBase } from "./promptsBaseDraft";
import { normalizeOutlineMatchText } from "./utils";

export function getDraftingSystemStandard({
  analysisYearsText,
  reportContextPromptText,
  outlineJsonString,
  lastDoneContent,
}) {
  const basePrompt = getSharedDraftingBase({ analysisYearsText });

  // Tách biệt chỉ thị chuyên ngành sâu để làm nổi bật trong system prompt - chuẩn hóa bỏ dấu trước khi test
  const normalizedContextText = normalizeOutlineMatchText(reportContextPromptText);
  const isFinance = /\b(tai chinh|ke toan|ngan hang|loi nhuan|doanh thu|bctc)\b/i.test(normalizedContextText);
  const isLegal = /\b(luat|phap ly|tu van|hop dong|tranh chap)\b/i.test(normalizedContextText);

  let fieldSpecificInstructions = "";
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

  return `${basePrompt}
${fieldSpecificInstructions}

BẮT BUỘC VỀ ĐỘ CHI TIẾT VÀ DUNG LƯỢNG LỚN:
- Đối với các chương chính, mỗi mục con bắt buộc phải triển khai thành ít nhất 4-5 đoạn văn phân tích, với dung lượng của mỗi mục con bắt buộc phải đạt tối thiểu từ 880 - 1.100 từ.

BẮT BUỘC VỀ BẢNG BIỂU VÀ SƠ ĐỒ CHO TẤT CẢ CÁC ĐỀ TÀI BÁO CÁO (BAO GỒM CẢ QUẢN TRỊ KINH DOANH, MARKETING, VẬN HÀNH, NHÂN SỰ, KHÔ VẬN...):
- Để đảm bảo tính trực quan và khoa học, báo cáo của bạn KHÔNG ĐƯỢC chỉ toàn văn bản thuần. Trong mỗi Chương chính của báo cáo (Chương 1, Chương 2, Chương 3), bạn bắt buộc phải thiết kế và chèn ít nhất:
  1. Ít nhất một (01) bảng biểu Markdown (đầy đủ các cột số liệu hoặc tổng hợp phân tích thực tế giai đoạn ${analysisYearsText} đối với chỉ số thông thường, hoặc 2024 - 2026 (dự kiến) đối với bảng doanh thu, tăng trưởng). Ví dụ: bảng phân bổ nhân sự, bảng so sánh hiệu suất, bảng phân tích ma trận SWOT, bảng lộ trình thời gian, bảng so sánh ưu nhược điểm các giải pháp...
  2. Ít nhất một (01) sơ đồ Mermaid dạng "flowchart TD" mô tả cấu trúc, quy trình làm việc hoặc luồng dữ liệu (ví dụ: sơ đồ cơ cấu tổ chức bộ máy, sơ đồ quy trình vận hành kho, sơ đồ quy trình báo cáo tự động, sơ đồ luồng dữ liệu...). Sơ đồ Mermaid phải được đặt độc lập ngoài khối văn bản, thiết kế chuyên nghiệp. Dưới mỗi sơ đồ "flowchart" này bắt buộc phải có một dòng chú thích rõ ràng ở dạng chữ nghiêng, ví dụ: *Sơ đồ 1.1: Cơ cấu tổ chức bộ máy quản lý*, *Sơ đồ 1.2: Quy trình sản xuất kinh doanh*,... (sử dụng đúng số thứ tự phân cấp X.Y tương ứng).
- Tuyệt đối không viết toàn văn xuôi mà không có bảng và sơ đồ trong mỗi chương nội dung lớn. Sau mỗi bảng biểu và sơ đồ, bạn bắt buộc phải viết đoạn nhận xét, thuyết minh chi tiết tối thiểu 120-180 từ để giải thích ý nghĩa của chúng.

BÁO CÁO KIẾN TẬP BA49 / ĐỊNH HƯỚNG NGHỀ NGHIỆP / MẪU 1.1 -> 1.5 (NẾU PHÙ HỢP): nếu outline hoặc báo cáo mẫu cho thấy chỉ có các mục 1.1, 1.2, 1.3, 1.4, 1.5 (hoặc I. PHẦN MỞ ĐẦU, II. PHẦN NỘI DUNG...) là khung nội dung chính, phải giữ nguyên cấu trúc đó trong luồng soạn thảo. Khi xuất báo cáo hoàn chỉnh, hệ thống sẽ tự chèn heading cấp 1 "# LỜI MỞ ĐẦU" hoặc "# I. PHẦN MỞ ĐẦU" ở đầu tài liệu rồi mới đến khối nội dung 1.1, 1.2, 1.3, 1.4, 1.5. Không tự chia thành ba chương và không tự bịa thêm phần mở đầu dài riêng.

${reportContextPromptText}

CẤU TRÚC ĐỀ CƯƠNG BÁO CÁO:
${outlineJsonString}

${lastDoneContent ? `\nNỘI DUNG MỤC TRƯỚC ĐÓ (Dùng để bảo đảm sự liên kết, tiếp nối văn phong mạch lạc):\n${lastDoneContent}` : ""}`;
}
