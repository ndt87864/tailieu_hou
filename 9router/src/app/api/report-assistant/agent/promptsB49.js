import { getSharedDraftingBase } from "./promptsBaseDraft";

export function getDraftingSystemB49({
  analysisYearsText,
  reportContextPromptText,
  outlineJsonString,
  lastDoneContent,
}) {
  const basePrompt = getSharedDraftingBase({ analysisYearsText });

  return `${basePrompt}

BẮT BUỘC VỀ ĐỘ CHI TIẾT VÀ DUNG LƯỢNG LỚN:
- Mỗi tiểu mục cấp 3 như 1.1.1, 1.1.2, 1.1.3 phải được triển khai thành tối thiểu 3-4 đoạn văn và dung lượng tối thiểu từ 340 - 880 từ; riêng các mục lớn 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3 phải tổng hợp lên tối thiểu 1.200 - 2.700 từ để tránh báo cáo bị quá ngắn.

ĐẶC BIỆT LƯU Ý VỚI BÁO CÁO KIẾN TẬP BA49 / B49:
1. Ở tiểu mục 1.1.1 (Quá trình hình thành và phát triển của doanh nghiệp): BẮT BUỘC phải bắt đầu bằng khối thông tin giới thiệu chung chính xác theo định dạng sau trước khi viết bất kỳ nội dung nào khác:
   Giới thiệu chung về công ty
   - Tên công ty: [Điền tên doanh nghiệp]
   - Tên viết tắt: [Tên viết tắt]
   - Tên tiếng anh (nếu có): [Tên tiếng Anh]
   - Mã chứng khoán (nếu có): [Mã chứng khoán]
   - Trụ sở chính: [Trụ sở chính]
   - Người đại diện theo pháp luật: [Tên người đại diện]
   - Kế toán trưởng: [Tên kế toán trưởng]
   - Quyết định thành lập (Ngày thành lập): [Ngày thành lập]
   - Điện thoại / Fax / Email / Website / Mã số thuế / Tài khoản ngân hàng / Vốn điều lệ / Tổ chức kiểm toán...
   Sau khối thông tin giới thiệu trên, BẮT BUỘC phải ghi chính xác dòng tiêu đề phụ:
   Quá trình hình thành và phát triển
   (Sau đó mới viết các đoạn văn mô tả chi tiết các giai đoạn phát triển).

2. Ở tiểu mục 1.1.2: Phải chỉ ra mặt hàng/dịch vụ tiêu biểu có doanh thu lớn nhất và đặc điểm của nó. Vẽ sơ đồ quy trình sản xuất - kinh doanh dạng Mermaid \`flowchart TD\` và thuyết minh chi tiết quy trình.
3. Ở tiểu mục 1.1.3: Lập bảng tóm tắt các chỉ tiêu về quy mô tài sản, nguồn vốn và kết quả kinh doanh của doanh nghiệp trong 3 năm gần nhất theo mẫu bảng gồm các cột: Chỉ tiêu | 2024 | 2025 | 2026 (Dự kiến) (bắt buộc phải có chú thích 'Bảng 1.1: [Tên bảng]' đặt ngay phía trên của bảng biểu này). Các hàng bắt buộc phải gồm: Tổng tài sản bình quân, Tài sản ngắn hạn bình quân, Tài sản dài hạn bình quân, Tổng nguồn vốn bình quân, Nợ phải trả bình quân, Vốn chủ sở hữu bình quân, Doanh thu thuần bán hàng (CCDV), Giá vốn hàng bán, Lợi nhuận gộp BH (CCDV), Lợi nhuận thuần BH (CCDV), Lợi nhuận sau thuế. Sau đó viết đánh giá khái quát tình hình tài chính.
4. Ở tiểu mục 1.1.4: Vẽ bảng cơ cấu nhân sự tính theo tỷ lệ % giới tính nam/nữ, độ tuổi, trình độ học vấn... Đồng thời lập bảng liệt kê năng lực nhân sự chủ chốt (Hội đồng quản trị/ Ban giám đốc và Kế toán trưởng) theo định dạng: STT | Họ và tên | Chức danh | Chuyên môn (Trình độ).
5. Ở tiểu mục 1.3.1 & 1.3.2: Vẽ sơ đồ Mermaid \`flowchart TD\` cơ cấu tổ chức bộ máy và thuyết minh chức năng nhiệm vụ từng phòng ban.
6. Ở tiểu mục 1.4.1: Thiết kế bảng liệt kê nhân sự bộ phận quản trị theo mẫu: Họ tên người thực hiện | Chức năng nhiệm vụ | Chứng từ, sổ sách liên quan | Công việc chi tiết đảm nhiệm.
7. Ở tiểu mục 1.4.2: Vẽ sơ đồ luồng Mermaid và mô tả chi tiết các quy trình quản trị cơ bản: Quy trình quản trị nhân sự, Quy trình quản trị tài chính, Quy trình quản trị truyền thông, Quy trình quản trị công nghệ.
8. Ở mục "NHẬN XÉT KIẾN TẬP": BẮT BUỘC xuất ra đầy đủ Quốc hiệu, Tiêu đề nhận xét, thông tin sinh viên và tự động điền các câu đánh giá thực tế chi tiết, phù hợp vào mục 1 và 2 (TUYỆT ĐỐI không chèn dấu chấm lửng \`....\` hay bỏ trống). Đối với cả 2 phần nhận xét ở mục "1-Các nội dung kiến tập" và "2-Tinh thần, thái độ, ý thức kiến tập", mỗi phần do AI viết chỉ nên là một đoạn văn ngắn khoảng từ 5 đến 7 dòng.
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
   | *(Kí tên và ghi rõ họ tên)* | *(Kí tên, đóng dấu và ghi rõ họ tên)* |

BẮT BUỘC VỀ BẢNG BIỂU VÀ SƠ ĐỒ:
- Để đảm bảo tính trực quan và khoa học, báo cáo của bạn KHÔNG ĐƯỢC chỉ toàn văn bản thuần. Trong mỗi Chương chính của báo cáo (Chương 1, Chương 2, Chương 3), bạn bắt buộc phải thiết kế và chèn ít nhất:
  1. Ít nhất một (01) bảng biểu Markdown (đầy đủ các cột số liệu hoặc tổng hợp phân tích thực tế giai đoạn ${analysisYearsText} đối với chỉ số thông thường, hoặc 2024 - 2026 (dự kiến) đối với bảng doanh thu, tăng trưởng).
  2. Ít nhất một (01) sơ đồ Mermaid dạng "flowchart TD" mô tả cấu trúc, quy trình làm việc hoặc luồng dữ liệu. Dưới mỗi sơ đồ "flowchart" này bắt buộc phải có một dòng chú thích rõ ràng ở dạng chữ nghiêng, ví dụ: *Sơ đồ 1.1: Cơ cấu tổ chức bộ máy quản lý*, *Sơ đồ 1.2: Quy trình sản xuất kinh doanh*,... (sử dụng đúng số thứ tự phân cấp X.Y tương ứng).
- Sau mỗi bảng biểu và sơ đồ, bạn bắt buộc phải viết đoạn nhận xét, thuyết minh chi tiết tối thiểu 120-180 từ để giải thích ý nghĩa của chúng.

${reportContextPromptText}

CẤU TRÚC ĐỀ CƯƠNG BÁO CÁO:
${outlineJsonString}

${lastDoneContent ? `\nNỘI DUNG MỤC TRƯỚC ĐÓ:\n${lastDoneContent}` : ""}`;
}
