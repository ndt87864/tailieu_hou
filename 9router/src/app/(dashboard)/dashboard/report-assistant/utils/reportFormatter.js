function textValue(val) {
  if (typeof val === "string") return val;
  return String(val || "");
}

export function removeVietnameseTones(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
}

export function normalizeForMatch(str) {
  return removeVietnameseTones(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMajorHeadingLine(line) {
  return normalizeForMatch(
    textValue(line)
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.+?)\*\*:?$/, "$1")
      .replace(/^(?:chuong|chapter|phan|muc)\s*\d+[:.-]?\s*/i, "")
      .replace(/^(?:[0-9ivxlcdm]+|[IVXLCDM]+)\.?\s*/i, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function isListItemLine(line) {
  const trimmed = textValue(line).trim();
  return /^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);
}

export function isMajorSectionHeadingLine(line) {
  if (isListItemLine(line)) return false;

  const trimmed = textValue(line).trim();
  if (trimmed.length > 150) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("đóng vai trò") ||
    lower.includes("là kết quả") ||
    lower.includes("chương này") ||
    lower.includes("tác giả") ||
    lower.includes("được chia thành") ||
    lower.includes("chúng ta") ||
    lower.includes("nghiên cứu này") ||
    lower.includes("xin cam đoan") ||
    lower.includes("cam đoan rằng") ||
    (trimmed.endsWith(".") && !/\d+\.$/.test(trimmed) && !/chương\s+\d+\.$/i.test(trimmed))
  ) {
    return false;
  }

  const normalized = normalizeMajorHeadingLine(line);
  if (!normalized) return false;
  return (
    /^loi mo dau\b/.test(normalized) ||
    /^mo dau\b/.test(normalized) ||
    /^phan mo dau\b/.test(normalized) ||
    /^phan noi dung\b/.test(normalized) ||
    /^chuong\s+([0-9ivxlcdm]+)\b/.test(normalized) ||
    /^chuong\s*(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\b/.test(
      normalized,
    ) ||
    /^chapter\s+\d+\b/.test(normalized) ||
    /^ket luan\b/.test(normalized) ||
    /^tai lieu tham khao\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^muc luc\b/.test(normalized) ||
    /^nhan xet kien tap\b/.test(normalized) ||
    /^xac nhan cua can bo huong dan\b/.test(normalized)
  );
}

export function isReferenceHeadingLine(line) {
  if (isListItemLine(line)) return false;
  const normalized = normalizeMajorHeadingLine(line);
  return (
    /^tai lieu tham khao\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^references?\b/.test(normalized) ||
    /^bibliograph/.test(normalized)
  );
}

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

      const numberMatch = cleanText.match(/^(\d+(?:\.\d+)+)\.?\s+(.*)$/);
      if (!numberMatch) return line;

      const numberPart = numberMatch[1];
      const titlePart = numberMatch[2].replace(/^\*\*|\*\*$/g, "").replace(/^\*|\*$/g, "").trim();
      const dotCount = numberPart.split(".").length;

      const targetLevel = Math.min(6, Math.max(2, dotCount));
      const targetHashes = "#".repeat(targetLevel);
      return `${targetHashes} ${numberPart}. ${titlePart}`.trim();
    })
    .join("\n")
    .trim();
}

export function splitReferenceBlocks(content) {
  const lines = textValue(content).split(/\r?\n/);
  const body = [];
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (isReferenceHeadingLine(line)) {
      if (current) blocks.push(current);
      current = { heading: line, lines: [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else {
      body.push(line);
    }
  }
  if (current) blocks.push(current);
  return { body: body.join("\n").trim(), blocks };
}

export function normalizeReferenceListItem(line, nextIndex) {
  const trimmed = textValue(line).trim();
  if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return "";
  if (isReferenceHeadingLine(trimmed)) return "";
  const match = trimmed.match(/^(?:[-*]\s+|\d+[.)]\s+)?(.+)$/);
  const item = (match?.[1] || trimmed).trim();
  if (!item) return "";
  return `${nextIndex}. ${item}`;
}

export function mergeDuplicateReferenceSections(content) {
  const { body, blocks } = splitReferenceBlocks(content);
  if (!blocks.length) return textValue(content).trim();

  const seen = new Set();
  const items = [];
  for (const block of blocks) {
    for (const rawLine of block.lines) {
      const item = normalizeReferenceListItem(rawLine, items.length + 1);
      if (!item) continue;
      const key = normalizeForMatch(item.replace(/^\d+[.)]\s*/, ""));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  const referenceSection = [
    "[PAGE_BREAK]",
    "## DANH MỤC TÀI LIỆU THAM KHẢO",
    ...items.map((item, index) => item.replace(/^\d+[.)]\s*/, `${index + 1}. `)),
  ].join("\n");

  return body ? `${body.trim()}\n\n${referenceSection}` : referenceSection;
}

export function isTocHeadingLine(line) {
  const normalized = normalizeMajorHeadingLine(line);
  return (
    /^muc luc\b/.test(normalized) || /^table of contents\b/.test(normalized)
  );
}

export function isLikelyTocEntryLine(line) {
  const raw = textValue(line).trim();
  const normalized = normalizeMajorHeadingLine(raw);
  if (!normalized) return false;
  if (/[.\u2026]{3,}\s*\d*\s*$/.test(raw)) return true;
  if (/^\d+(?:\.\d+)*\s+/.test(raw)) return true;
  return (
    /^phan\s+/.test(normalized) ||
    /^chuong\s+([0-9ivxlcdm]+)\b/.test(normalized) ||
    /^ket luan\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^tai lieu tham khao\b/.test(normalized)
  );
}

export function injectSectionPageBreaks(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let lastMajorHeading = "";
  let inTableOfContents = false;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (trimmed.toUpperCase() === "[PAGE_BREAK]") {
      out.push("[PAGE_BREAK]");
      inTableOfContents = false;
      continue;
    }

    if (isTocHeadingLine(trimmed)) {
      inTableOfContents = true;
      out.push(line);
      continue;
    }

    if (inTableOfContents && isLikelyTocEntryLine(trimmed)) {
      out.push(line);
      continue;
    }

    if (isMajorSectionHeadingLine(trimmed)) {
      const normalizedHeading = normalizeMajorHeadingLine(trimmed);
      if (normalizedHeading && normalizedHeading === lastMajorHeading) {
        continue;
      }

      const nextMeaningful =
        lines
          .slice(idx + 1)
          .map((nextLine) => nextLine.trim())
          .find(Boolean) || "";
      const previousMeaningful =
        out
          .slice()
          .reverse()
          .map((prevLine) => textValue(prevLine).trim())
          .find(Boolean) || "";
      const looksLikeChapterList =
        (nextMeaningful &&
          (isMajorSectionHeadingLine(nextMeaningful) ||
            /[.\u2026]{3,}\s*\d*\s*$/.test(nextMeaningful))) ||
        (previousMeaningful &&
          previousMeaningful.toUpperCase() !== "[PAGE_BREAK]" &&
          (isMajorSectionHeadingLine(previousMeaningful) ||
            /[.\u2026]{3,}\s*\d*\s*$/.test(previousMeaningful)));

      if (looksLikeChapterList) {
        out.push(line);
        lastMajorHeading = normalizedHeading;
        continue;
      }

      const lastMeaningful = out
        .slice()
        .reverse()
        .map((l) => textValue(l).trim().toUpperCase())
        .find((l) => l !== "") || "";
      let skipPageBreak = false;
      if (normalizedHeading === "nhan xet kien tap" || normalizedHeading === "nhan xet kien tap cua co quan" || normalizedHeading === "xac nhan cua can bo huong dan" || normalizedHeading === "nhan xet cua can bo huong dan" || normalizedHeading === "xac nhan cua don vi tiep nhan kien tap") {
        const lastPageBreakIdx = out.lastIndexOf("[PAGE_BREAK]");
        const currentPageContent = out.slice(lastPageBreakIdx + 1).join("\n").toLowerCase();
        if (currentPageContent.includes("cộng hòa xã hội") || currentPageContent.includes("cong hoa xa hoi")) {
          skipPageBreak = true;
        }
      }
      if (out.length > 0 && lastMeaningful !== "[PAGE_BREAK]" && !skipPageBreak) {
        out.push("[PAGE_BREAK]");
      }

      lastMajorHeading = normalizedHeading;
    } else if (trimmed) {
      lastMajorHeading = "";
      inTableOfContents = false;
    }

    out.push(line);
  }

  return out.join("\n").trim();
}

export function normalizeDisplayLineForDedup(line) {
  return normalizeForMatch(
    textValue(line)
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.+?)\*\*:?$/, "$1")
      .replace(/^\d+(?:\.\d+)*\s*/, "")
      .replace(/^[\-*•]\s+/, "")
      .replace(/\s+/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function stripDuplicateAdjacentDisplayLines(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let lastKey = "";
  let lastHeadingKey = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      lastKey = "";
      continue;
    }

    const normalized = normalizeDisplayLineForDedup(trimmed);
    const headingLike =
      isMajorSectionHeadingLine(trimmed) ||
      /^\*\*(.+?)\*\*:?\s*$/.test(trimmed);

    if (
      headingLike &&
      normalized &&
      (normalized === lastKey || normalized === lastHeadingKey)
    ) {
      continue;
    }

    out.push(line);
    lastKey = normalized;
    lastHeadingKey = headingLike ? normalized : "";
  }

  return out.join("\n").trim();
}

export function isStandaloneSeparatorLine(line) {
  const trimmed = textValue(line).trim();
  if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return false;
  return /^[-*_]{3,}$/.test(trimmed) || /^[-*_](?:\s*[-*_]){2,}$/.test(trimmed);
}

export function stripStandaloneSeparatorLines(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === "[PAGE_BREAK]") {
      out.push("[PAGE_BREAK]");
      continue;
    }
    if (isStandaloneSeparatorLine(trimmed)) continue;
    out.push(line);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removePageBreaksAfterHeadingOnly(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let segmentLines = [];

  for (const line of lines) {
    if (line.trim().toUpperCase() === "[PAGE_BREAK]") {
      if (!isHeadingOnlyReportBlock(segmentLines.join("\n"))) {
        out.push("[PAGE_BREAK]");
        segmentLines = [];
      }
      continue;
    }

    out.push(line);
    if (line.trim()) segmentLines.push(line);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isHeadingOnlyReportBlock(block) {
  const meaningfulLines = textValue(block)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (meaningfulLines.length === 0 || meaningfulLines.length > 3) return false;
  return meaningfulLines.every((line) => {
    if (line.toUpperCase() === "[PAGE_BREAK]") return true;
    return (
      isMajorSectionHeadingLine(line) ||
      /^#{1,6}\s+/.test(line) ||
      /^\*\*(.+?)\*\*:?\s*$/.test(line)
    );
  });
}

export function stripSupabaseReportLinks(content) {
  if (!content) return "";
  return String(content)
    .replace(/\[Tải\s+báo\s+cáo\s+tại\s+Supabase\].*?\n/gi, "")
    .replace(/\[Link\s+tải\s+báo\s+cáo\s+Supabase\].*?\n/gi, "");
}

export function ensurePageBreakBeforeConclusion(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (isMajorSectionHeadingLine(trimmed)) {
      const norm = normalizeMajorHeadingLine(trimmed);
      if (norm === "ket luan" || norm === "phan ket luan") {
        const lastMeaningful = out.slice().reverse().map(l => l.trim().toUpperCase()).find(l => l !== "") || "";
        if (out.length > 0 && lastMeaningful !== "[PAGE_BREAK]") {
          out.push("[PAGE_BREAK]");
        }
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

export function ensurePageBreakBeforeReferences(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (isReferenceHeadingLine(trimmed)) {
      const lastMeaningful = out.slice().reverse().map(l => l.trim().toUpperCase()).find(l => l !== "") || "";
      if (out.length > 0 && lastMeaningful !== "[PAGE_BREAK]") {
        out.push("[PAGE_BREAK]");
      }
    }
    out.push(line);
  }
  return out.join("\n");
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

export function getReportTitleWithDownloadCounter() {
  if (typeof window === "undefined") return "Báo cáo hoàn chỉnh";
  try {
    const now = new Date();
    const dateKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
    const countKey = `report_download_count_${dateKey}`;
    let count = parseInt(localStorage.getItem(countKey) || "0", 10);
    if (count === 0) {
      count = 1;
      localStorage.setItem(countKey, "1");
    }
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `bc_${count}_${dd}_${mm}_${yyyy}`;
  } catch (e) {
    const now = new Date();
    return `bc_1_${String(now.getDate()).padStart(2, '0')}_${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;
  }
}

export function prepareReportContent(content, title = "", isDocx = false) {
  if (!content) return "";
  let cleanedContent = stripTrailingProseAfterSignature(content, title);
  cleanedContent = cleanedContent.replace(/\|\s*([^|]*?xác\s+nhận\s+của\s+cơ\s+quan[^|]*?)\s*\|/gi, "| **XÁC NHẬN CỦA CƠ QUAN**<br>*(Kí tên và đóng dấu)* |");

  if (shouldExcludeReferences(title, content)) {
    cleanedContent = cleanedContent.replace(/\[PAGE_BREAK\]\s*(?:#+\s*(?:danh\s+mục\s+)?tài\s+liệu\s+tham\s+khảo[\s\S]*)$/i, "");
    cleanedContent = cleanedContent.replace(/(?:#+\s*(?:danh\s+mục\s+)?tài\s+liệu\s+tham\s+khảo[\s\S]*)$/i, "");
  }

  const isBa49 = title.toLowerCase().includes("ba49") ||
    title.toLowerCase().includes("b49") ||
    title.toLowerCase().includes("kiến tập") ||
    content.toLowerCase().includes("ba49") ||
    content.toLowerCase().includes("b49") ||
    content.toLowerCase().includes("kiến tập");

  cleanedContent = cleanedContent
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return !isDocx;

      if (trimmed.startsWith("|") && trimmed.endsWith("|")) return true;
      if (trimmed.startsWith("```")) return true;
      if (/^[-*_]{3,}$/.test(trimmed)) return true;

      const cleanLine = trimmed
        .replace(/^[-*+•#\s|]+|[-*+•\s|]+$/g, "")
        .replace(/[\[\]()]/g, "")
        .trim();

      const hasAlphanumeric = /[a-zA-Z0-9\u00C0-\u1EF9]/u.test(cleanLine);
      if (!hasAlphanumeric) return false;

      const lower = cleanLine.toLowerCase();
      return lower !== "no text" &&
        lower !== "no_text" &&
        lower !== "notext" &&
        lower !== "no content" &&
        lower !== "no_content" &&
        lower !== "nocontent";
    })
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("###")) {
        return line.replace(/\*\*/g, "");
      }
      if (/^\s*(?:Bảng|BẢNG)\s+\d+(?:\.\d+)*[:.-]?\s+\S/i.test(trimmed)) {
        const cleanText = trimmed.replace(/^\*\*|\*\*$/g, "").trim();
        return `**${cleanText}**`;
      }
      if (/^\s*(?:Hình|HÌNH|Sơ đồ|SƠ ĐỒ|Biểu đồ|BIỂU ĐỒ)\s+\d+(?:\.\d+)*[:.-]?\s+\S/i.test(trimmed)) {
        const cleanText = trimmed.replace(/^\*|\*$/g, "").replace(/^\*\*|\*\*$/g, "").trim();
        return `*${cleanText}*`;
      }

      const isHeader = trimmed.startsWith("#");
      const isList = /^(?:[-*•+]|\d+[.)])\s/.test(trimmed);
      const isTable = trimmed.startsWith("|");
      const isCode = trimmed.startsWith("```");
      const isPageBreak = trimmed.toUpperCase() === "[PAGE_BREAK]";
      const isHtml = trimmed.startsWith("<");

      if (isHtml) return trimmed;
      if (!isHeader && !isList && !isTable && !isCode && !isPageBreak && !isHtml && trimmed) {
        if (/^[\t ]+/.test(line)) {
          return line.replace(/^[\t ]+/, "\t");
        }
      }
      return line;
    })
    .join("\n");

  if (isBa49 && !cleanedContent.includes("NHẬN XÉT KIẾN TẬP")) {
    const meta = extractMetadataFromContent(content, title);
    cleanedContent = cleanedContent.trim() + "\n" + generateEvaluationForm(meta);
  }

  const coverHtml = injectCoverPageFull(cleanedContent, title);
  let finalContent;
  if (cleanedContent.includes("TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI") || cleanedContent.includes("[LOGO_HOU]") || cleanedContent.includes("logo-hou.png") || cleanedContent.includes("cover-page-container")) {
    if (isBa49 && (cleanedContent.includes("TRUNG TÂM ĐÀO TẠO TRỰC TUYẾN") || !cleanedContent.includes("VIỆN ĐÀO TẠO VÀ PHÁT TRIỂN HỌC TẬP SUỐT ĐỜI"))) {
      const parts = cleanedContent.split("[PAGE_BREAK]");
      const remainingPart = parts.slice(1).join("[PAGE_BREAK]");
      finalContent = coverHtml.trim() + "\n\n" + remainingPart.trim();
    } else {
      finalContent = cleanedContent;
    }
  } else {
    finalContent = coverHtml.trim() ? (coverHtml.trim() + "\n\n" + cleanedContent) : cleanedContent;
  }

  finalContent = ensurePageBreakBeforeReferences(
    ensurePageBreakBeforeConclusion(
      removePageBreaksAfterHeadingOnly(
        normalizeNumberedHeadingLevels(
          normalizeMajorHeadingLevels(
            mergeDuplicateReferenceSections(
              stripDuplicateAdjacentDisplayLines(
                stripStandaloneSeparatorLines(stripSupabaseReportLinks(finalContent)),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  if (isDocx) {
    return finalContent.replace(/\n+/g, "\n");
  }

  finalContent = finalContent.replace(/\n{2,}/g, "\n\n");
  const lines = finalContent.split("\n");
  const processedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const prev = lines[i - 1];

    if (current.trim().startsWith("|") && current.trim().endsWith("|")) {
      if (prev !== undefined && !(prev.trim().startsWith("|") && prev.trim().endsWith("|")) && prev.trim() !== "") {
        processedLines.push("");
      }
    }
    processedLines.push(current);

    const next = lines[i + 1];
    if (current.trim().startsWith("|") && current.trim().endsWith("|")) {
      if (next !== undefined && !(next.trim().startsWith("|") && next.trim().endsWith("|")) && next.trim() !== "") {
        processedLines.push("");
      }
    }
  }
  return processedLines.join("\n");
}

export function isB49OpeningSection(section) {
  const reportContext = section?.reportContext || null;
  if (!reportContext?.internshipReport && !reportContext?.careerOrientationReport) return false;
  const normalizedTitle = normalizeForMatch(String(section?.title || ""));
  return /^\s*(?:loi mo dau|phan mo dau|mo dau|i phan mo dau)\b/.test(normalizedTitle);
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

export function stripTrailingProseAfterSignature(content, title) {
  if (!content) return "";
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let foundCutoff = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.toLowerCase().includes("bản nháp này được chuẩn bị") ||
      trimmed.toLowerCase().includes("báo cáo được tạo bởi") ||
      trimmed.toLowerCase().includes("trợ lý ai báo cáo")
    ) {
      foundCutoff = true;
    }
    if (!foundCutoff) {
      out.push(line);
    }
  }
  return out.join("\n").trim();
}

export function shouldExcludeReferences(title, content) {
  const normTitle = normalizeForMatch(title);
  if (normTitle.includes("ba49") || normTitle.includes("b49") || normTitle.includes("kiến tập")) return true;
  return false;
}

export function prepareReportContentForDocx(content, title = "") {
  const withPageBreaks = injectSectionPageBreaks(content);
  return prepareReportContent(withPageBreaks, title, true);
}


