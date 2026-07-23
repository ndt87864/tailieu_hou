import { getSharedDraftingBase } from "./promptsBaseDraft";

export function getDraftingSystemCareer({
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
* Khi soạn thảo mục "IV. XÁC NHẬN CỦA CÁN BỘ HƯỚNG DẪN THỰC TẬP":
  - CẤM TUYỆT ĐỐI VIẾT THÊM BẤT KỲ ĐOẠN VĂN DẪN DẮT, BÌNH LUẬN, HOẶC GIẢI THÍCH NÀO KHÔNG NẰM TRONG CÁC KHUNG TĨNH DƯỚI ĐÂY. Mục IV chỉ chứa chính xác nội dung của các tiểu mục 4.1, 4.2, 4.3 theo đúng form được cung cấp, không thêm bớt lời dẫn.
  - Phải triển khai chính xác các tiểu mục sau:
    4.1. Xác nhận thời gian thực tập: Từ 01/06/2026 đến 30/06/2026
    Bắt buộc phải xuất ra nội dung cực kỳ chính xác theo định dạng form tĩnh dưới đây:
    | TT | THỜI GIAN | NỘI DUNG CÔNG VIỆC | GHI CHÚ |
    |---|---|---|---|
    | 1 |  .../.../... - .../.../... | |Hoàn thành |
    | 2 |  .../.../... - .../.../... | |Hoàn thành |
    | 3 |  .../.../... - .../.../... | |Hoàn thành |
    | 4 |  .../.../... - .../.../... | |Hoàn thành |
    Tôi là: ...... xác nhận sinh viên: ...... đã thực tập định hướng nghề nghiệp 2 ...... tổng số ... buổi.
    | | ....., ngày .... tháng ..... năm 2026<br><br>**NGƯỜI XÁC NHẬN CBHD**<br>*(Kí và ghi rõ họ tên)* |
    |---|---|

    4.2. Xác nhận nội dung Báo cáo thực tập
    Tôi là:.... xác nhận các nội dung trình bày trong Báo cáo này là trung thực...
    | | ....., ngày .... tháng ..... năm 2026 |
    |---|---|
    | **XÁC NHẬN CỦA CƠ QUAN**<br>*(Kí tên và đóng dấu)* | **NGƯỜI XÁC NHẬN CBHD**<br>*(Kí và ghi rõ họ tên)* |
    
    4.3. Đánh giá kết quả thực tập
    <center>
    **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**
    **Độc lập - Tự do - Hạnh phúc**
    ___________
    **ĐÁNH GIÁ KẾT QUẢ THỰC TẬP ĐỊNH HƯỚNG NGHỀ NGHIỆP 2**
    </center>
    Họ tên cán bộ hướng dẫn: ......
    Chức vụ:
    Họ tên sinh viên:
    Lớp:
    Đánh giá của cán bộ hướng dẫn:
    1. Về ý thức chấp hành nội quy, quy định của cơ quan:
    2. Ý thức, thái độ trong công việc:
    3. Mức độ hoàn thành các công việc được giao:
    Hoàn thành tốt các công việc được giao.
    4. Đánh giá chung:
    Sinh viên ...... có tinh thần học hỏi tốt...
    Sinh viên đạt điểm: 10/10 điểm (Bằng chữ: Mười điểm)
    | | ....., ngày .... tháng ..... năm 2026<br><br>**CÁN BỘ HƯỚNG DẪN**<br>*(Kí và ghi rõ họ tên)* |
    |---|---|`;
  } else {
    sectionSpecificRules = `
BẮT BUỘC VỀ ĐỘ CHI TIẾT VÀ DUNG LƯỢNG LỚN:
- Mỗi tiểu mục cấp 3 như 1.1.1, 1.1.2, 1.1.3 phải được triển khai thành tối thiểu 3-4 đoạn văn và dung lượng tối thiểu từ 340 - 880 từ; riêng các mục lớn 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3 phải tổng hợp lên tối thiểu 1.200 - 2.700 từ.

CẤM TUYỆT ĐỐI CHÈN BẢNG BIỂU VÀ SƠ ĐỒ/BIỂU ĐỒ:
- Đối với báo cáo Thực tập định hướng nghề nghiệp, TUYỆT ĐỐI CẤM tự ý tạo hoặc chèn bất kỳ bảng biểu (Markdown tables), biểu đồ hoặc sơ đồ (Mermaid diagrams) nào vào báo cáo, NGOẠI TRỪ duy nhất sơ đồ bộ máy lãnh đạo ở phần "Bộ máy lãnh đạo" thuộc mục 1.1 và bảng biểu nhật ký thực tập ở mục 4.1. Tất cả các phần còn lại BẮT BUỘC 100% phải được viết hoàn toàn bằng văn xuôi (paragraphs) phân tích chuyên sâu.`;
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
