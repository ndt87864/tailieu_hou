import { getSharedDraftingBase } from "./promptsBaseDraft";

export function getDraftingSystemCareer({
  analysisYearsText,
  reportContextPromptText,
  outlineJsonString,
  lastDoneContent,
}) {
  const basePrompt = getSharedDraftingBase({ analysisYearsText });

  return `${basePrompt}

BẮT BUỘC VỀ ĐỘ CHI TIẾT VÀ DUNG LƯỢNG LỚN:
- Mỗi tiểu mục cấp 3 như 1.1.1, 1.1.2, 1.1.3 phải được triển khai thành tối thiểu 3-4 đoạn văn và dung lượng tối thiểu từ 340 - 880 từ; riêng các mục lớn 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3 phải tổng hợp lên tối thiểu 1.200 - 2.700 từ để tránh báo cáo bị quá ngắn.

CẤM TUYỆT ĐỐI CHÈN BẢNG BIỂU VÀ SƠ ĐỒ/BIỂU ĐỒ:
- Đối với báo cáo Thực tập định hướng nghề nghiệp, TUYỆT ĐỐI CẤM tự ý tạo hoặc chèn bất kỳ bảng biểu (Markdown tables), biểu đồ hoặc sơ đồ (Mermaid diagrams) nào vào báo cáo, NGOẠI TRỪ duy nhất sơ đồ/biểu đồ bộ máy lãnh đạo ở phần "Bộ máy lãnh đạo" thuộc mục 1.1 (nếu là cơ quan nhà nước / công ty luật) và bảng biểu nhật ký thực tập ở mục 4.1. Tất cả các phần còn lại (bao gồm mục 1.2, 2.1, 2.2, 2.3, 2.4, 3,...) BẮT BUỘC 100% phải được viết hoàn toàn bằng văn xuôi (paragraphs) phân tích chuyên sâu. Tuyệt đối không được chèn bảng hay sơ đồ nào khác.

ĐẶC BIỆT LƯU Ý VỚI BÁO CÁO THỰC TẬP ĐỊNH HƯỚNG NGHỀ NGHIỆP:
* Khung báo cáo luôn tuân thủ chính xác cấu trúc sau:
  I. PHẦN MỞ ĐẦU
    1.1. Giới thiệu về cơ quan thực tập ( gồm 2 loại : công ty luật/ nhà nước và công ty bình thường )
    1.2 Cơ cấu tổ chức, chức năng, nhiệm vụ( mục này xuất hiện khi là công ty luật/ nhà nước )
    1.3. Giới thiệu về vị trí nghề nghiệp mà mình định tìm hiểu( với công ty bình thường thì mục này là 1.2 - do không có mục "1.2 Cơ cấu tổ chức, chức năng, nhiệm vụ")
  II. PHẦN NỘI DUNG.
    2.1. Nêu các lí do để lựa chọn vị trí nghề nghiệp
    2.2. Đánh giá sự phù hợp của bản thân với yêu cầu công việc
    2.3. Phân tích những thuận lợi và khó khăn trong tương lai khi được giao đảm nhận vị trí nghề nghiệp
    2.4. Nhận xét chung
  III. KẾT LUẬN
  IV. XÁC NHẬN CỦA CÁN BỘ HƯỚNG DẪN THỰC TẬP
    4.1. Xác nhận thời gian thực tập: Từ 01/06/2026 đến 30/06/2026 ( thuần bảng nhật kí thực tập kèm chữ kí xác nhận cam đoan bảng đúng )
    4.2. Xác nhận nội dung Báo cáo thực tập ( biên bản xác nhận báo cáo )
    4.3. Đánh giá kết quả thực tập

* Khi soạn thảo mục "1.1. Giới thiệu về cơ quan thực tập":
  - Phải tự xác định xem đơn vị thực tập là "công ty luật/ cơ quan nhà nước" hay là "công ty bình thường" (dựa trên tên đơn vị thực tập hoặc bối cảnh yêu cầu).
  - Nếu đơn vị là "công ty bình thường", phần này BẮT BUỘC phải chia thành các tiểu mục và liệt kê thông tin chính xác sau (TUYỆT ĐỐI KHÔNG viết đoạn văn giới thiệu hay văn xuôi ngay dưới mục 1.1, mà phải đi thẳng vào mục 1.1.1. CẤM SỬ DỤNG TIÊU ĐỀ "1.1 Tên cơ quan thực tập", phải luôn dùng "1.1. Giới thiệu về cơ quan thực tập"):
    1.1. Giới thiệu về cơ quan thực tập
    1.1.1. Thông tin pháp lý và tổng quan về doanh nghiệp
    + Tên công ty: [Điền tên]
    + Tên tiếng anh: [Điền tên tiếng Anh]
    + Tên viết tắt: [Điền tên viết tắt]
    + Địa chỉ trụ sở chính: [Điền địa chỉ]
    (Chỉ viết đúng các mục trên, KHÔNG ĐƯỢC THÊM BẤT KỲ ĐOẠN VĂN NÀO DƯỚI MỤC 1.1 HOẶC 1.1.1)
    1.1.2. Bộ máy lãnh đạo
    + Giám đốc: [Họ tên Giám đốc / CEO]
    + Phó Giám đốc: [Họ tên Phó Giám đốc / COO]
    + Bộ phận Kinh doanh: [Họ và tên lãnh đạo bộ phận]
    + Phòng pháp chế : [Họ và tên lãnh đạo phòng]
    + Phòng Tài chính - Kế toán : [Họ và tên lãnh đạo phòng]
    (chỉ liệt kê đủ thông tin như mẫu, KHÔNG ĐƯỢC chuyển thành đoạn văn ngắn hoặc thêm đoạn văn ngắn vào sau)
    1.1.3. Cơ cấu tổ chức; chức năng, nhiệm vụ
    (Trình bày chi tiết cơ cấu tổ chức Kèm sơ đồ cấu trúc bộ máy tổ chức vẽ bằng Mermaid flowchart TD; chức năng, nhiệm vụ của từng phòng ban; tiểu mục "Lịch sử hình thành và phát triển").
    
  - Nếu đơn vị là "công ty luật/ cơ quan nhà nước", phần này BẮT BUỘC phải chia thành các tiểu mục và thuộc tính chính xác sau:
    1.1. Giới thiệu về cơ quan thực tập
    1.1.1. Tên cơ quan thực tập
    - Tên công ty: [Văn phòng Luật sư / Tên Cơ quan]
    - Địa chỉ trụ sở: [Điền địa chỉ trụ sở]
    - Giấy đăng ký hoạt động số: [Số giấy đăng ký hoặc Quyết định thành lập do Sở Tư pháp / Cơ quan có thẩm quyền cấp ngày...]
    - Điện thoại: [Số điện thoại nếu có chính xác, còn không thì ghi liên hệ văn phòng/cơ quan]
    - Fax: [Số Fax nếu có, không thì bỏ qua thuộc tính này]
    - Email: [Địa chỉ Email chính xác hoặc liên hệ văn phòng]
    - Lĩnh vực hoạt động chính: [Liệt kê các lĩnh vực hoạt động chính dạng các dấu cộng '+', ví dụ: '+ Tư vấn pháp luật và giải quyết tranh chấp.', '+ Tư vấn hợp đồng...', ...]
    (Viết thêm 1 đoạn giới thiệu khái quát khoảng 100-150 từ ngay sau khi liệt kê đầu dòng các thông tin này).
    1.2 Cơ cấu tổ chức, chức năng, nhiệm vụ
    a) Cơ cấu tổ chức: (Liệt kê rõ Trưởng Văn phòng / Người đứng đầu, các luật sư thành viên / phó ban, cố vấn, chuyên viên pháp lý, bộ phận hành chính... Kèm sơ đồ cấu trúc bộ máy tổ chức vẽ bằng Mermaid flowchart TD).
    b) Chức năng các phòng ban: (Mô tả chi tiết chức năng cụ thể của Ban lãnh đạo, Bộ phận Luật sư / Chuyên môn, Bộ phận Cố vấn, Chuyên viên pháp lý và Hành chính).
    c) Lịch sử hình thành và phát triển, nhiệm vụ của công ty: (Phân tích chi tiết quá trình thành lập, các mốc phát triển chính của đơn vị và nhiệm vụ hành nghề).

* Khi soạn thảo mục "IV. XÁC NHẬN CỦA CÁN BỘ HƯỚNG DẪN THỰC TẬP":
  - CẤM TUYỆT ĐỐI VIẾT THÊM BẤT KỲ ĐOẠN VĂN DẪN DẮT, BÌNH LUẬN, HOẶC GIẢI THÍCH NÀO KHÔNG NẰM TRONG CÁC KHUNG TĨNH DƯỚI ĐÂY. Mục IV chỉ chứa chính xác nội dung của các tiểu mục 4.1, 4.2, 4.3 theo đúng form được cung cấp, không thêm bớt lời dẫn.
  - Phải triển khai chính xác các tiểu mục sau:
    4.1. Xác nhận thời gian thực tập: Từ 01/06/2026 đến 30/06/2026
    Bắt buộc phải xuất ra nội dung cực kỳ chính xác theo định dạng form tĩnh dưới đây mà không tự ý biến tấu thêm bớt bất kỳ nội dung nào khác:
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
    Bắt buộc phải xuất ra nội dung cực kỳ chính xác theo định dạng form tĩnh dưới đây mà không tự ý biến tấu thêm bớt bất kỳ nội dung nào khác:
    Tôi là:.... xác nhận các nội dung trình bày trong Báo cáo này là trung thực, đúng với các nội dung công việc của sinh viên: ...... đã thực hiện trong thời gian thực tập định hướng nghề nghiệp 2 tại ......
    | | ....., ngày .... tháng ..... năm 2026 |
    |---|---|
    | **XÁC NHẬN CỦA CƠ QUAN**<br>*(Kí tên và đóng dấu)* | **NGƯỜI XÁC NHẬN CBHD**<br>*(Kí và ghi rõ họ tên)* |
    
    4.3. Đánh giá kết quả thực tập
    Bắt buộc phải xuất ra nội dung cực kỳ chính xác theo định dạng form tĩnh dưới đây mà không tự ý biến tấu thêm bớt bất kỳ nội dung nào khác:
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
    Sinh viên ...... có tinh thần học hỏi tốt, nắm bắt nhanh công việc, rèn luyện được nhiều kỹ năng hành chính – văn phòng.
    Sinh viên đạt điểm: 10/10 điểm (Bằng chữ: Mười điểm)
    | | ....., ngày .... tháng ..... năm 2026<br><br>**CÁN BỘ HƯỚNG DẪN**<br>*(Kí và ghi rõ họ tên)* |
    |---|---|

${reportContextPromptText}

CẤU TRÚC ĐỀ CƯƠNG BÁO CÁO:
${outlineJsonString}

${lastDoneContent ? `\nNỘI DUNG MỤC TRƯỚC ĐÓ:\n${lastDoneContent}` : ""}`;
}
