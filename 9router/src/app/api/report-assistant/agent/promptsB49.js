import { getSharedDraftingBase } from "./promptsBaseDraft";

export function getDraftingSystemB49({
  analysisYearsText,
  reportContextPromptText,
  outlineJsonString,
  lastDoneContent,
  sectionType = "analysis",
}) {
  const basePrompt = getSharedDraftingBase({ analysisYearsText });

  let sectionSpecificRules = "";

  if (sectionType === "b49_form") {
    sectionSpecificRules = `
Ở mục "NHẬN XÉT KIẾN TẬP": BẮT BUỘC xuất ra đầy đủ Quốc hiệu, Tiêu đề nhận xét, thông tin sinh viên và tự động điền các câu đánh giá thực tế chi tiết, phù hợp vào mục 1 và 2.
   Định dạng mẫu chính xác bắt buộc:
   <center>
   **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**
   **Độc lập - Tự do - Hạnh phúc**
   **---------------***---------------**
   </center>
   <center>
   ## NHẬN XÉT KIẾN TẬP
   </center>
   Họ và tên sinh viên: [Điền tên sinh viên]
   Ngày sinh: [Điền ngày sinh]
   Lớp: [Điền lớp]
   Ngành đào tạo: [Điền ngành]
   Kiến tập tại: [Điền tên công ty]
   Người hướng dẫn kiến tập: [Tên hướng dẫn]
   Thời gian kiến tập: Từ ngày 01 tháng 06 năm 2026 đến ngày 30 tháng 06 năm 2026
   **1-Các nội dung kiến tập:**
   **2-Tinh thần, thái độ, ý thức kiến tập:**
   | | |
   | :--- | :--- |
   | | ......, ngày 30 tháng 06 năm 2026 |
   | **Cán bộ hướng dẫn Kiến tập** | **Xác nhận của đơn vị kiến tập** |
   | *(Kí tên và ghi rõ họ tên)* | *(Kí tên, đóng dấu và ghi rõ họ tên)* |`;
  } else {
    sectionSpecificRules = `
BẮT BUỘC VỀ ĐỘ CHI TIẾT VÀ DUNG LƯỢNG LỚN:
- Mỗi tiểu mục cấp 3 như 1.1.1, 1.1.2, 1.1.3 phải được triển khai thành tối thiểu 3-4 đoạn văn và dung lượng tối thiểu từ 340 - 880 từ; riêng các mục lớn 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3 phải tổng hợp lên tối thiểu 1.200 - 2.700 từ.

ĐẶC BIỆT LƯU Ý VỚI BÁO CÁO KIẾN TẬP BA49 / B49:
1. Ở tiểu mục 1.1.1: BẮT BUỘC phải bắt đầu bằng khối thông tin giới thiệu chung về công ty.
2. Ở tiểu mục 1.1.2: Chỉ ra mặt hàng/dịch vụ tiêu biểu có doanh thu lớn nhất. Vẽ sơ đồ quy trình sản xuất - kinh doanh dạng Mermaid \`flowchart TD\`.
3. Ở tiểu mục 1.1.3: Lập bảng tóm tắt các chỉ tiêu về quy mô tài sản, nguồn vốn và kết quả kinh doanh trong 3 năm (${analysisYearsText}).
4. Ở tiểu mục 1.1.4: Vẽ bảng cơ cấu nhân sự % và liệt kê nhân sự chủ chốt.
5. Ở tiểu mục 1.3.1 & 1.3.2: Vẽ sơ đồ Mermaid \`flowchart TD\` cơ cấu tổ chức bộ máy.
6. Ở tiểu mục 1.4.1 & 1.4.2: Bảng liệt kê nhân sự quản trị & sơ đồ luồng Mermaid các quy trình quản trị.`;
  }

  const trimmedLastContent = lastDoneContent && lastDoneContent.length > 500
    ? `...${lastDoneContent.slice(-500)}`
    : lastDoneContent;

  return `${basePrompt}
${sectionSpecificRules}

${reportContextPromptText}

CẤU TRÚC ĐỀ CƯƠNG BÁO CÁO:
${outlineJsonString}

${trimmedLastContent ? `\nNỘI DUNG MỤC TRƯỚC ĐÓ:\n${trimmedLastContent}` : ""}`;
}
