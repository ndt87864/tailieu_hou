import {
  cleanOutlineLine,
  normalizeOutlineMatchText,
  sanitizeOutlineSubsections,
  stripOutlineNumberPrefix,
  isOpeningSection,
  isConclusionSection,
  isReferenceOnlySection,
  isInternshipB49ReportSection,
  isCareerOrientationReportSection,
  getChapterNumber
} from "./utils";

export function buildInternshipB49Outline(reportContext = null) {
  const baseContext = reportContext || null;
  return [
    {
      id: "1.1",
      title: "1.1. Khái quát chung về doanh nghiệp",
      description: "Phải triển khai sâu theo các tiểu mục 1.1.1, 1.1.2, 1.1.3 để làm rõ lịch sử, chức năng, nguồn lực và năng lực hoạt động.",
      level: 1,
      parent_id: null,
      subsections: [
        "1.1.1. Quá trình hình thành và phát triển của doanh nghiệp",
        "1.1.2. Chức năng, nhiệm vụ, ngành nghề kinh doanh và đặc điểm sản xuất kinh doanh",
        "1.1.3. Năng lực hoạt động của doanh nghiệp",
        "1.1.4. Tình hình nhân lực của doanh nghiệp",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.2",
      title: "1.2. Môi trường hoạt động của doanh nghiệp",
      description: "Phải triển khai sâu theo các tiểu mục 1.2.1, 1.2.2, 1.2.3... để phân tích vị thế, khách hàng, đối tác, đối thủ và khó khăn.",
      level: 1,
      parent_id: null,
      subsections: [
        "1.2.1. Vị thế của doanh nghiệp trong môi trường cạnh tranh",
        "1.2.2. Tình hình khách hàng của doanh nghiệp",
        "1.2.3. Các đối tác, nhà cung cấp chủ yếu của doanh nghiệp",
        "1.2.4. Một số đối thủ cạnh tranh của doanh nghiệp",
        "1.2.5. Thuận lợi và khó khăn của doanh nghiệp",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.3",
      title: "1.3. Cơ cấu bộ máy tổ chức quản lý của doanh nghiệp",
      description: "Phải có sơ đồ tổ chức và tách sâu chức năng, nhiệm vụ từng phòng ban, mối quan hệ phối hợp.",
      level: 1,
      parent_id: null,
      subsections: [
        "1.3.1. Mô hình bộ máy tổ chức quản lý",
        "1.3.2. Chức năng, nhiệm vụ từng phòng ban",
        "1.3.3. Tổ chức sản xuất kinh doanh trong doanh nghiệp",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.4",
      title: "1.4. Khái quát về công tác quản trị kinh doanh của doanh nghiệp",
      description: "Phải triển khai sâu theo các quy trình quản trị, có sơ đồ và bảng mô tả công việc chủ chốt.",
      level: 1,
      parent_id: null,
      subsections: [
        "1.4.1. Tổ chức bộ máy quản trị của doanh nghiệp",
        "1.4.2. Các quy trình quản trị cơ bản của doanh nghiệp",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.5",
      title: "1.5. Kết luận",
      description: "Tổng hợp ngắn gọn, rút ra nhận xét chung và liên hệ thực tiễn.",
      level: 1,
      parent_id: null,
      subsections: [],
      reportContext: baseContext,
    },
    {
      id: "1.6",
      title: "NHẬN XÉT KIẾN TẬP",
      description: "Mẫu nhận xét kiến tập đầy đủ. AI sẽ tự động điền các nhận xét đánh giá chi tiết về quá trình kiến tập của sinh viên dựa trên đề tài thực hiện, tránh để trống.",
      level: 1,
      parent_id: null,
      subsections: [],
      reportContext: baseContext,
    },
  ];
}

export function buildCareerOrientationOutline(reportContext = null) {
  const baseContext = reportContext || null;
  const userPrompt = reportContext?.userPrompt || "";
  const targetCompany = reportContext?.targetCompany || "";
  const normalizedCompany = targetCompany.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const normalizedPrompt = userPrompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

  // Check company first (the most reliable source)
  let isLawOrState = /\b(cong ty luat|van phong luat|luat|law|phap ly|phap che|toa an|vien kiem sat|nha nuoc|uy ban|ubnd|so|bo|cuc|chi cuc|thue|hai quan|cong an|co quan|chinh quyen|vien|so tu phap|doanh nghiep nha nuoc|vpls|vp luat|vks)\b/.test(
    normalizedCompany
  );

  // If company check is negative or generic, check prompt but exclude academic major phrases
  if (!isLawOrState && (!targetCompany || targetCompany === "đơn vị được yêu cầu")) {
    const cleanedPrompt = normalizedPrompt
      .replace(/\b(nganh|mon|chuyen nganh|hoc phan|huong)\s+(luat|law|phap ly)\b/g, "")
      .replace(/\bluat\s+(kinh te|hinh su|dan su|hanh chinh|lao dong|thuong mai)\b/g, "");
    
    isLawOrState = /\b(cong ty luat|van phong luat|toa an|vien kiem sat|nha nuoc|uy ban|ubnd|so tu phap|doanh nghiep nha nuoc|vpls|vp luat|vks|thue|hai quan|cong an|chinh quyen)\b/.test(
      cleanedPrompt
    );
  }

  const introSubsections = isLawOrState
    ? [
      "1.1 Tên cơ quan thực tập",
      "1.2 Cơ cấu tổ chức, chức năng, nhiệm vụ",
      "1.3 Giới thiệu về vị trí nghề nghiệp mà mình định tìm hiểu",
    ]
    : [
      "1.1. Giới thiệu về cơ quan thực tập",
      "1.1.1. Thông tin pháp lý và tổng quan về doanh nghiệp",
      "1.1.2. Bộ máy lãnh đạo",
      "1.1.3. Cơ cấu tổ chức; chức năng, nhiệm vụ",
      "1.2. Giới thiệu về vị trí nghề nghiệp mà mình định tìm hiểu",
    ];

  return [
    {
      id: "1.1",
      title: "I. PHẦN MỞ ĐẦU",
      description: "Giới thiệu khái quát về cơ quan thực tập (công ty luật/nhà nước hoặc công ty bình thường) và vị trí nghề nghiệp định tìm hiểu.",
      level: 1,
      parent_id: null,
      subsections: introSubsections,
      reportContext: baseContext,
    },
    {
      id: "1.2",
      title: "II. PHẦN NỘI DUNG.",
      description: "Nêu lý do chọn vị trí, đánh giá sự phù hợp cá nhân, phân tích những thuận lợi và khó khăn trong tương lai, nhận xét chung.",
      level: 1,
      parent_id: null,
      subsections: [
        "2.1. Nêu các lí do để lựa chọn vị trí nghề nghiệp",
        "2.2. Đánh giá sự phù hợp của bản thân với yêu cầu công việc",
        "2.3. Phân tích những thuận lợi và khó khăn trong tương lai khi được giao đảm nhận vị trí nghề nghiệp",
        "2.4. Nhận xét chung",
      ],
      reportContext: baseContext,
    },
    {
      id: "1.3",
      title: "III. KẾT LUẬN",
      description: "Tổng hợp các kết quả thực tập định hướng nghề nghiệp, đúc kết kinh nghiệm.",
      level: 1,
      parent_id: null,
      subsections: [],
      reportContext: baseContext,
    },
    {
      id: "1.4",
      title: "IV. XÁC NHẬN CỦA CÁN BỘ HƯỚNG DẪN THỰC TẬP",
      description: "Bảng nhật ký thực tập cam đoan đúng thời gian thực tế, biên bản xác nhận nội dung báo cáo và đánh giá kết quả thực tập.",
      level: 1,
      parent_id: null,
      subsections: [
        "4.1. Xác nhận thời gian thực tập: Từ 01/06/2026 đến 30/06/2026",
        "4.2. Xác nhận nội dung Báo cáo thực tập (biên bản xác nhận báo cáo)",
        "4.3. Đánh giá kết quả thực tập",
      ],
      reportContext: baseContext,
    }
  ];
}

export function normalizeOutlineNumbering(outline) {
  if (!Array.isArray(outline)) return [];
  let chapterIndex = 0;

  return outline.map((item, index) => {
    const section = { ...item };
    const subsections = sanitizeOutlineSubsections(section.subsections);

    if (isOpeningSection(section) || isConclusionSection(section) || isReferenceOnlySection(section)) {
      section.subsections = subsections.map((subsection, subsectionIndex) => (
        `${subsectionIndex + 1}. ${stripOutlineNumberPrefix(subsection)}`
      ));
      return section;
    }

    const normalizedTitle = normalizeOutlineMatchText(section.title || "");
    const isChapter = /\bchuong\b/.test(normalizedTitle) || /^\d+\.\d+/.test(subsections[0] || "");
    if (isChapter) {
      chapterIndex = getChapterNumber(section, chapterIndex + 1);
      section.subsections = subsections.map((subsection, subsectionIndex) => (
        `${chapterIndex}.${subsectionIndex + 1}. ${stripOutlineNumberPrefix(subsection)}`
      ));
      return section;
    }

    section.subsections = subsections.map((subsection, subsectionIndex) => (
      `${index + 1}.${subsectionIndex + 1}. ${stripOutlineNumberPrefix(subsection)}`
    ));
    return section;
  });
}

export function normalizeReportOutlineSections(outline) {
  const internshipContext = Array.isArray(outline)
    ? outline.find((item) => item?.reportContext?.internshipReport)?.reportContext
    : null;
  if (internshipContext?.internshipReport) {
    const template = buildInternshipB49Outline(internshipContext);
    return template.map((item) => {
      const existing = Array.isArray(outline)
        ? outline.find((p) => String(p.id) === String(item.id))
        : null;
      return {
        ...item,
        status: existing?.status || "todo",
        content: existing?.content || "",
        feedback: existing?.feedback || "",
        web_sources: existing?.web_sources || [],
        activity: existing?.activity || null,
        activity_history: existing?.activity_history || [],
      };
    });
  }

  const careerContext = Array.isArray(outline)
    ? outline.find((item) => item?.reportContext?.careerOrientationReport)?.reportContext
    : null;
  if (careerContext?.careerOrientationReport) {
    const template = buildCareerOrientationOutline(careerContext);
    return template.map((item) => {
      const existing = Array.isArray(outline)
        ? outline.find((p) => String(p.id) === String(item.id))
        : null;
      return {
        ...item,
        status: existing?.status || "todo",
        content: existing?.content || "",
        feedback: existing?.feedback || "",
        web_sources: existing?.web_sources || [],
        activity: existing?.activity || null,
        activity_history: existing?.activity_history || [],
      };
    });
  }

  const normalized = normalizeOutlineNumbering(outline);
  const result = [];
  let referenceSection = null;
  let hasConclusion = false;

  for (const item of normalized) {
    if (isReferenceOnlySection(item)) {
      referenceSection = referenceSection || {
        ...item,
        title: "DANH M\u1ee4C T\u00c0I LI\u1ec6U THAM KH\u1ea2O",
        description: "Li\u1ec7t k\u00ea m\u1ed9t danh m\u1ee5c t\u00e0i li\u1ec7u tham kh\u1ea3o duy nh\u1ea5t \u1edf cu\u1ed1i b\u00e1o c\u00e1o.",
        subsections: [],
        is_reference_section: true,
      };
      continue;
    }
    if (isConclusionSection(item)) {
      hasConclusion = true;
    }
    result.push(item);
  }

  if (!hasConclusion) {
    const inheritedReportContext = normalized.find((item) => item?.reportContext)?.reportContext || null;
    result.push({
      id: "ket_luan",
      title: "K\u1ebeT LU\u1eacN",
      description: "T\u1ed5ng h\u1ee3p k\u1ebft qu\u1ea3 nghi\u00ean c\u1ee9u, \u0111\u00e1nh gi\u00e1 nh\u1eefng n\u1ed9i dung ch\u00ednh, n\u00eau \u00fd ngh\u0129a th\u1ef1c ti\u1ec5n v\u00e0 \u0111\u1ecbnh h\u01b0\u1edbng/ki\u1ebfn ngh\u1ecb ph\u00f9 h\u1ee3p v\u1edbi \u0111\u1ec1 c\u01b0\u01a1ng.",
      level: 1,
      subsections: [
        "1. T\u00f3m t\u1eaft k\u1ebft qu\u1ea3 nghi\u00ean c\u1ee9u",
        "2. \u00dd ngh\u0129a th\u1ef1c ti\u1ec5n v\u00e0 ki\u1ebfn ngh\u1ecb",
      ],
      is_conclusion_section: true,
      reportContext: inheritedReportContext,
    });
  }

  // Skip reference section for BA49/SL06/SL07/EL67 internship and career orientation reports
  const anyReportContext = normalized.find((item) => item?.reportContext)?.reportContext || null;
  const isInternshipOrCareer = anyReportContext?.internshipReport || anyReportContext?.careerOrientationReport;
  if (referenceSection && !isInternshipOrCareer) result.push(referenceSection);
  return result;
}
