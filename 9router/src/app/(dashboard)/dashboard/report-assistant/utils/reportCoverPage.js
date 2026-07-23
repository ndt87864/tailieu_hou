import {
  textValue,
  normalizeForMatch,
  normalizeMajorHeadingLine,
  isMajorSectionHeadingLine,
  isReferenceHeadingLine,
} from "./reportFormatter.js";

export function canonicalizeMajorHeading(line) {
  const raw = textValue(line).trim();
  const normalized = normalizeMajorHeadingLine(raw);
  if (!normalized) return raw;
  const title = raw
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\*(.+?)\*\*:?\s*$/, "$1")
    .trim();

  if (isReferenceHeadingLine(raw)) return "## DANH MỤC TÀI LIỆU THAM KHẢO";
  if (/^ket luan\b/.test(normalized) || /^phan ket luan\b/.test(normalized)) {
    return `# ${title.replace(/^phan\s+/i, "")}`;
  }
  if (
    /^loi mo dau\b/.test(normalized) ||
    /^mo dau\b/.test(normalized) ||
    /^phan mo dau\b/.test(normalized) ||
    /^phan noi dung\b/.test(normalized) ||
    /^nhan xet kien tap\b/.test(normalized) ||
    /^xac nhan cua can bo huong dan\b/.test(normalized) ||
    /^chuong\s+([0-9ivxlcdm]+)\b/.test(normalized) ||
    /^chuong\s*(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\b/.test(normalized) ||
    /^chapter\s+\d+\b/.test(normalized)
  ) {
    return `# ${title}`;
  }
  return raw;
}

export function normalizeMajorHeadingLevels(content) {
  return textValue(content)
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return line;
      return isMajorSectionHeadingLine(trimmed) ? canonicalizeMajorHeading(trimmed) : line;
    })
    .join("\n")
    .trim();
}

export function normalizeNumberedHeadingLevels(content) {
  return textValue(content)
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return line;

      let cleanText = trimmed.replace(/^(###*|#+)\s+/, "");
      cleanText = cleanText.replace(/^\*\*|\*\*$/g, "");
      cleanText = cleanText.replace(/^\*|\*$/g, "");
      cleanText = cleanText.trim();

      const numberMatch = cleanText.match(/^(\d+(?:\.\d+)*)\.?\s+(.*)$/);
      if (!numberMatch) return line;

      const numberPart = numberMatch[1];
      const titlePart = numberMatch[2].replace(/^\*\*|\*\*$/g, "").replace(/^\*|\*$/g, "").trim();
      const parts = numberPart.split(".");
      const dotCount = parts.length;

      // Single part like "1" or "2" - leave untouched unless it has dots
      if (dotCount < 2) return line;

      // 1.1 -> level 2 (##), 1.1.1 -> level 3 (###)
      const targetLevel = Math.min(6, Math.max(2, dotCount));
      const targetHashes = "#".repeat(targetLevel);
      return `${targetHashes} ${numberPart}. ${titlePart}`.trim();
    })
    .join("\n")
    .trim();
}

export function extractMetadataFromContent(content, title = "") {
  const result = {
    studentName: "..................................................",
    studentId: "..................................................",
    class: "..................................................",
    advisor: "..................................................",
    advisorRole: "Cán bộ hướng dẫn",
    company: "..................................................",
    reportTitle: "BÁO CÁO THỰC TẬP",
    year: "2026",
    dob: "..................................................",
    major: "..................................................",
    internshipDuration: "..................................................",
    courseId: "..................................................",
  };

  let rawTitle = "";
  if (title) {
    rawTitle = title.replace(/^(?:Báo cáo tạm dừng|Merged|Copy|Bản nháp|Bản xem trước)\s*-\s*/i, "").trim();
  }
  if (!rawTitle) {
    const headingMatch = content.match(/^\s*#\s+(.+)$/m);
    if (headingMatch) {
      rawTitle = headingMatch[1].trim();
    }
  }

  const normalizedText = String(content + " " + title).toLowerCase();
  if (normalizedText.includes("ba49") || normalizedText.includes("b49") || normalizedText.includes("kiến tập thực tế") || normalizedText.includes("kiến tập")) {
    result.reportTitle = "BÁO CÁO KIẾN TẬP THỰC TẾ";
  } else if (normalizedText.includes("định hướng nghề nghiệp") || normalizedText.includes("career orientation") || normalizedText.includes("sl06") || normalizedText.includes("sl07") || normalizedText.includes("el67")) {
    result.reportTitle = "BÁO CÁO THỰC TẬP ĐỊNH HƯỚNG NGHỀ NGHIỆP 2";
  } else if (rawTitle) {
    result.reportTitle = rawTitle.toUpperCase();
  } else {
    result.reportTitle = "BÁO CÁO KHÓA LUẬN TỐT NGHIỆP";
  }

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.replace(/[#*`_\-\[\]()]/g, "").trim();

    if (result.studentName.includes("...")) {
      const match = cleanLine.match(/^(?:Họ\s+tên\s+)?sinh\s+viên(?:\s+thực\s+hiện)?:\s*(.+)$/i);
      if (match) result.studentName = match[1].trim();
    }
    if (result.studentId.includes("...")) {
      const match = cleanLine.match(/^(?:Mã\s+số\s+sinh\s+viên|MSSV):\s*(.+)$/i);
      if (match) result.studentId = match[1].trim();
    }
    if (result.class.includes("...")) {
      const match = cleanLine.match(/^Lớp:\s*(.+)$/i);
      if (match) result.class = match[1].trim();
    }
    if (result.advisor.includes("...")) {
      const match = cleanLine.match(/^(?:Giảng\s+viên\s+hướng\s+dẫn|Cán\s+bộ\s+hướng\s+dẫn|GVHD):\s*(.+)$/i);
      if (match) result.advisor = match[1].trim();
    }
    if (result.advisorRole === "Cán bộ hướng dẫn") {
      const match = cleanLine.match(/^Chức\s+vụ:\s*(.+)$/i);
      if (match) result.advisorRole = match[1].trim();
    }
    if (result.company.includes("...")) {
      const origMatch = line.match(/^(?:Tại\s+đơn\s+vị|Tên\s+công\s+ty|Đơn\s+vị\s+kiến\s+tập|Đơn\s+vị\s+thực\s+tập|Cơ\s+quan\s+thực\s+tập):\s*(.+)$/i);
      if (origMatch) {
        let rawCompany = origMatch[1].replace(/[#*`_\-\[\]]/g, "").trim();
        rawCompany = rawCompany.replace(/\s*[([].*?[\])]\s*/g, " ").replace(/\s+/g, " ").trim();
        result.company = rawCompany;
      }
    }
    if (result.dob.includes("...")) {
      const match = cleanLine.match(/^(?:Ngày\s+sinh):\s*(.+)$/i);
      if (match) result.dob = match[1].trim();
    }
    if (result.major.includes("...")) {
      const match = cleanLine.match(/^(?:Ngành\s+đào\s+tạo|Ngành):\s*(.+)$/i);
      if (match) result.major = match[1].trim();
    }
    if (result.internshipDuration.includes("...")) {
      const match = cleanLine.match(/^(?:Thời\s+gian\s+thực\s+tập|Thời\s+gian\s+thực\s+hiện|Thời\s+gian):\s*(.+)$/i);
      if (match) result.internshipDuration = match[1].trim();
    }
    if (result.courseId.includes("...")) {
      const match = cleanLine.match(/^(?:Mã\s+course\s+học|Mã\s+course|Mã\s+khóa\s+học):\s*(.+)$/i);
      if (match) result.courseId = match[1].trim();
    }
    const yearMatch = cleanLine.match(/năm\s+(202[4-9])/i);
    if (yearMatch) {
      result.year = yearMatch[1].trim();
    }
  }

  return result;
}

export function injectCoverPageFull(content, title = "") {
  const meta = extractMetadataFromContent(content, title);
  const isBa49 = meta.reportTitle.toUpperCase().includes("KIẾN TẬP") ||
    title.toLowerCase().includes("ba49") ||
    title.toLowerCase().includes("b49") ||
    content.toLowerCase().includes("ba49") ||
    content.toLowerCase().includes("b49");

  let coverHtml = "";

  if (isBa49) {
    coverHtml = `
<div class="cover-page-container" style="display: flex; flex-direction: column; align-items: center; text-align: center; font-family: 'Times New Roman', Times, serif; min-height: 240mm; box-sizing: border-box; justify-content: space-between; padding: 1.5cm 1cm 1cm 1cm; position: relative;">
  
  <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
    <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; margin-bottom: 5px; text-align: center;">
      TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI
    </div>
    <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; text-align: center; text-decoration: underline;">
      VIỆN ĐÀO TẠO VÀ PHÁT TRIỂN HỌC TẬP SUỐT ĐỜI
    </div>
  </div>

  <div style="margin: 1.5cm 0; display: flex; justify-content: center; align-items: center; width: 100%;">
    [LOGO_HOU]
  </div>

  <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5cm;">
    <div style="font-size: 24pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 10px;">
      ${meta.reportTitle}
    </div>
    <div style="font-size: 14pt; text-align: center; max-width: 90%;">
      Tại đơn vị: ${meta.company}
    </div>
  </div>

  <table style="width: 85%; margin: 0 auto 2.5cm auto; border-collapse: collapse; border: none; font-size: 13pt; line-height: 2.0; text-align: left;">
    <tr><td style="width: 35%; padding: 8px; font-weight: bold;">Họ và tên sinh viên:</td><td style="width: 65%; padding: 8px;">${meta.studentName}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Lớp:</td><td style="padding: 8px;">${meta.class}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Ngày sinh:</td><td style="padding: 8px;">${meta.dob}</td></tr>
  </table>

  <div style="width: 100%; text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-top: auto;">
    NĂM ${meta.year}
  </div>

</div>

[PAGE_BREAK]
`;
  } else if (meta.reportTitle.toUpperCase().includes("ĐỊNH HƯỚNG NGHỀ NGHIỆP")) {
    let subTitle = "THỰC TẬP ĐỊNH HƯỚNG NGHỀ NGHIỆP 2";
    if (meta.reportTitle.toUpperCase().includes("ĐỊNH HƯỚNG NGHỀ NGHIỆP")) {
      subTitle = meta.reportTitle.toUpperCase()
        .replace(/^BÁO CÁO\s+/i, "")
        .replace(/^HỌC PHẦN\s+/i, "");
    }
    coverHtml = `
<div class="cover-page-container" style="display: flex; flex-direction: column; align-items: center; text-align: center; font-family: 'Times New Roman', Times, serif; min-height: 240mm; box-sizing: border-box; justify-content: space-between; padding: 1.5cm 1cm 1cm 1cm; position: relative;">
  
  <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
    <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; margin-bottom: 5px; text-align: center;">
      TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI
    </div>
    <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; text-align: center;">
      VIỆN ĐT & PT HỌC TẬP SUỐT ĐỜI
    </div>
    <div style="width: 120px; height: 1px; background-color: #000; margin: 8px auto 0 auto;"></div>
  </div>

  <div style="margin: 1.5cm 0; display: flex; justify-content: center; align-items: center; width: 100%;">
    [LOGO_HOU]
  </div>

  <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5cm;">
    <div style="font-size: 16pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 5px;">
      BÁO CÁO THỰC TẬP
    </div>
    <div style="font-size: 16pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 5px;">
      HỌC PHẦN
    </div>
    <div style="font-size: 16pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 10px;">
      ${subTitle}
    </div>
  </div>

  <div style="width: 85%; margin: 0 auto 2.5cm 15%; text-align: left; font-size: 13pt; line-height: 2.0; display: flex; flex-direction: column; align-items: flex-start;">
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Cán bộ hướng dẫn:</strong> ${meta.advisor}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Sinh viên thực hiện:</strong> ${meta.studentName}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Ngày sinh:</strong> ${meta.dob}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Lớp:</strong> ${meta.class}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Ngành đào tạo:</strong> ${meta.major}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Thời gian thực tập:</strong> ${meta.internshipDuration}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Mã course học:</strong> ${meta.courseId}</div>
  </div>

  <div style="width: 100%; text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-top: auto;">
    NĂM ${meta.year}
  </div>

</div>

[PAGE_BREAK]
`;
  } else {
    coverHtml = `
<div class="cover-page-container" style="display: flex; flex-direction: column; align-items: center; text-align: center; font-family: 'Times New Roman', Times, serif; min-height: 240mm; box-sizing: border-box; justify-content: space-between; padding: 1.5cm 1cm 1cm 1cm; position: relative;">
  
  <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
    <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; margin-bottom: 5px; text-align: center;">
      TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI
    </div>
    <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; text-align: center;">
      TRUNG TÂM ĐÀO TẠO TRỰC TUYẾN
    </div>
    <div style="width: 120px; height: 1px; background-color: #000; margin: 8px auto 0 auto;"></div>
  </div>

  <div style="margin: 2cm 0; display: flex; justify-content: center; align-items: center; width: 100%;">
    [LOGO_HOU]
  </div>

  <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-bottom: 2cm;">
    <div style="font-size: 18pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 10px;">
      ${meta.reportTitle}
    </div>
    <div style="font-size: 14pt; font-weight: bold; font-style: italic; text-align: center; max-width: 90%;">
      Tại đơn vị: ${meta.company}
    </div>
  </div>

  <div style="width: 85%; margin: 0 auto 3cm 15%; text-align: left; font-size: 13pt; line-height: 2.0; display: flex; flex-direction: column; align-items: flex-start;">
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Họ tên cán bộ hướng dẫn:</strong> ${meta.advisor}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Chức vụ:</strong> ${meta.advisorRole}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Họ tên sinh viên:</strong> ${meta.studentName}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Lớp:</strong> ${meta.class}</div>
  </div>

  <div style="width: 100%; text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-top: auto;">
    HÀ NỘI, NĂM ${meta.year}
  </div>

</div>

[PAGE_BREAK]
`;
  }
  return coverHtml;
}

export function generateEvaluationForm(meta) {
  return `
[PAGE_BREAK]
# NHẬN XÉT KIẾN TẬP
*(Dành cho Đơn vị tiếp nhận sinh viên kiến tập nhận xét và xác nhận)*

**1. Họ và tên sinh viên:** ${meta.studentName}
**2. Mã số sinh viên:** ${meta.studentId}
**3. Lớp:** ${meta.class}
**4. Đơn vị kiến tập:** ${meta.company}
**5. Nội dung nhận xét:**
- Ý thức tổ chức kỷ luật, tác phong sư phạm/công tác: ....................................................................
- Tinh thần trách nhiệm và thái độ học hỏi: .............................................................................
- Khả năng chuyên môn và kết quả thực hiện công việc: ................................................................
- Đánh giá chung: ............................................................................................................

<div style="width: 100%; display: flex; justify-content: space-between; margin-top: 1.5cm; font-family: 'Times New Roman', Times, serif;">
  <div style="width: 45%; text-align: center;">
    **CÁN BỘ HƯỚNG DẪN**<br>
    *(Ký, ghi rõ họ tên)*
  </div>
  <div style="width: 45%; text-align: center;">
    ....., ngày ..... tháng ..... năm ${meta.year}<br>
    **THỦ TRƯỞNG ĐƠN VỊ**<br>
    *(Ký tên và đóng dấu)*
  </div>
</div>
`;
}
