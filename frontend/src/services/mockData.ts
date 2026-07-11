/**
 * Mock data service - provides hard-coded test data
 * for categories, documents, and questions
 */

export interface MockCategory {
  id: string;
  title: string;
  logo?: string | null;
  stt?: number;
}

export interface MockDocument {
  id: string;
  title: string;
  description: string;
  category_id: string;
  slug?: string;
  premium?: boolean;
  created_at: string;
  category?: {
    title: string;
    logo?: string | null;
  } | null;
}

export interface MockQuestion {
  id: string;
  document_id: string;
  question: string;
  answer?: string;
  choices?: any[];
  order_index?: number;
}

export interface GroupedCategory {
  id: string;
  title: string;
  logo?: string | null;
  documents: MockDocument[];
  total_count: number;
}

// Mock categories
const mockCategories: MockCategory[] = [
  {
    id: "cat-001",
    title: "TEST-Môn Đại Cương",
    logo: "BookOpen",
    stt: 1,
  },
  {
    id: "cat-002",
    title: "TEST-Kế Toán Tài Chính",
    logo: "BarChart3",
    stt: 2,
  },
  {
    id: "cat-003",
    title: "TEST-Quản Trị Kinh Doanh",
    logo: "Briefcase",
    stt: 3,
  },
];

// Mock documents
const mockDocuments: MockDocument[] = [
  {
    id: "doc-001",
    title: "TEST-Tiếng Anh Cơ Bản 1",
    description: "Tài liệu ôn tập tiếng Anh cơ bản dành cho sinh viên năm 1",
    category_id: "cat-001",
    slug: "test-tieng-anh-co-ban-1",
    premium: false,
    created_at: new Date().toISOString(),
    category: { title: "TEST-Môn Đại Cương", logo: "BookOpen" },
  },
  {
    id: "doc-002",
    title: "TEST-Triết Học Mác Lênin",
    description: "Tài liệu ôn tập triết học Mác Lênin - Tư tưởng Hồ Chí Minh",
    category_id: "cat-001",
    slug: "test-triet-hoc-mac-lenin",
    premium: false,
    created_at: new Date().toISOString(),
    category: { title: "TEST-Môn Đại Cương", logo: "BookOpen" },
  },
  {
    id: "doc-003",
    title: "TEST-Kế Toán Tổng Hợp",
    description: "Tài liệu ôn tập kế toán tổng hợp - Nguyên lý cơ bản",
    category_id: "cat-002",
    slug: "test-ke-toan-tong-hop",
    premium: false,
    created_at: new Date().toISOString(),
    category: { title: "TEST-Kế Toán Tài Chính", logo: "BarChart3" },
  },
  {
    id: "doc-004",
    title: "TEST-Kiểm Toán Nội Bộ",
    description: "Tài liệu ôn tập kiểm toán nội bộ - Quy trình và thủ tục",
    category_id: "cat-002",
    slug: "test-kiem-toan-noi-bo",
    premium: false,
    created_at: new Date().toISOString(),
    category: { title: "TEST-Kế Toán Tài Chính", logo: "BarChart3" },
  },
  {
    id: "doc-005",
    title: "TEST-Quản Lý Chiến Lược",
    description: "Tài liệu ôn tập quản lý chiến lược doanh nghiệp",
    category_id: "cat-003",
    slug: "test-quan-ly-chien-luoc",
    premium: false,
    created_at: new Date().toISOString(),
    category: { title: "TEST-Quản Trị Kinh Doanh", logo: "Briefcase" },
  },
  {
    id: "doc-006",
    title: "TEST-Quản Lý Tài Chính Doanh Nghiệp",
    description: "Tài liệu ôn tập quản lý tài chính doanh nghiệp",
    category_id: "cat-003",
    slug: "test-quan-ly-tai-chinh-doanh-nghiep",
    premium: false,
    created_at: new Date().toISOString(),
    category: { title: "TEST-Quản Trị Kinh Doanh", logo: "Briefcase" },
  },
];

// Mock questions (5 per document = 30 total)
const mockQuestions: MockQuestion[] = [
  // Document 1: Tiếng Anh Cơ Bản 1
  {
    id: "q-001",
    document_id: "doc-001",
    question: "TEST-Q1.1: What is the present simple tense used for?",
    answer: "To describe habits, facts, and general truths",
    order_index: 1,
  },
  {
    id: "q-002",
    document_id: "doc-001",
    question: "TEST-Q1.2: Choose the correct form: She _____ (go) to school every day.",
    answer: "goes",
    order_index: 2,
  },
  {
    id: "q-003",
    document_id: "doc-001",
    question: "TEST-Q1.3: Fill in the blank: They are _____ (read) a book right now.",
    answer: "reading",
    order_index: 3,
  },
  {
    id: "q-004",
    document_id: "doc-001",
    question: "TEST-Q1.4: Translate to English: 'Tôi thích ăn trái cây vào buổi sáng'",
    answer: "I like eating fruits in the morning",
    order_index: 4,
  },
  {
    id: "q-005",
    document_id: "doc-001",
    question: "TEST-Q1.5: What is the difference between 'a' and 'an'?",
    answer: "Use 'a' before consonants and 'an' before vowels",
    order_index: 5,
  },
  // Document 2: Triết Học Mác Lênin
  {
    id: "q-006",
    document_id: "doc-002",
    question: "TEST-Q2.1: Khái niệm chủ nghĩa duy vật lịch sử là gì?",
    answer: "Quan điểm rằng sự phát triển xã hội được xác định bởi yếu tố kinh tế",
    order_index: 1,
  },
  {
    id: "q-007",
    document_id: "doc-002",
    question: "TEST-Q2.2: Hãy giải thích nguyên lý mâu thuẫn trong triết học Mác",
    answer: "Mâu thuẫn là lực lượng thúc đẩy sự phát triển của mọi sự vật",
    order_index: 2,
  },
  {
    id: "q-008",
    document_id: "doc-002",
    question: "TEST-Q2.3: Karl Marx và Friedrich Engels đã viết cuốn sách quan trọng nào?",
    answer: "Tuyên ngôn Đảng Cộng Sản (The Communist Manifesto)",
    order_index: 3,
  },
  {
    id: "q-009",
    document_id: "doc-002",
    question: "TEST-Q2.4: Giai cấp nào được Mác coi là lực lượng cách mạng chính?",
    answer: "Giai cấp vô sản (công nhân)",
    order_index: 4,
  },
  {
    id: "q-010",
    document_id: "doc-002",
    question: "TEST-Q2.5: Nêu quan điểm của Lenin về vai trò của Đảng Cộng Sản",
    answer: "Đảng là vanguard lãnh đạo cách mạng vô sản",
    order_index: 5,
  },
  // Document 3: Kế Toán Tổng Hợp
  {
    id: "q-011",
    document_id: "doc-003",
    question: "TEST-Q3.1: Phương trình kế toán cơ bản là gì?",
    answer: "Tài sản = Nợ phải trả + Vốn chủ sở hữu",
    order_index: 1,
  },
  {
    id: "q-012",
    document_id: "doc-003",
    question: "TEST-Q3.2: Hãy nêu 5 loại tài khoản chính trong kế toán",
    answer: "Tài sản, Nợ phải trả, Vốn, Thu nhập, Chi phí",
    order_index: 2,
  },
  {
    id: "q-013",
    document_id: "doc-003",
    question: "TEST-Q3.3: Nguyên tắc 'Debit bằng Credit' có nghĩa là gì?",
    answer: "Tổng số bên debit phải bằng tổng số bên credit trong mỗi ghi sổ",
    order_index: 3,
  },
  {
    id: "q-014",
    document_id: "doc-003",
    question: "TEST-Q3.4: Sự khác biệt giữa chi phí và tài sản là gì?",
    answer: "Tài sản có giá trị lâu dài, chi phí là các khoản chi tiêu trong kỳ",
    order_index: 4,
  },
  {
    id: "q-015",
    document_id: "doc-003",
    question: "TEST-Q3.5: Báo cáo tài chính chính thức gồm những gì?",
    answer: "Bảng cân đối kế toán, Báo cáo kết quả hoạt động, Báo cáo lưu chuyển tiền mặt",
    order_index: 5,
  },
  // Document 4: Kiểm Toán Nội Bộ
  {
    id: "q-016",
    document_id: "doc-004",
    question: "TEST-Q4.1: Định nghĩa kiểm toán nội bộ là gì?",
    answer: "Hoạt động đánh giá độc lập để kiểm tra hiệu quả của hệ thống kiểm soát nội bộ",
    order_index: 1,
  },
  {
    id: "q-017",
    document_id: "doc-004",
    question: "TEST-Q4.2: Vai trò của kiểm toán nội bộ trong doanh nghiệp",
    answer: "Đảm bảo tuân thủ quy định, bảo vệ tài sản, cải thiện hoạt động",
    order_index: 2,
  },
  {
    id: "q-018",
    document_id: "doc-004",
    question: "TEST-Q4.3: Các giai đoạn chính của quá trình kiểm toán nội bộ",
    answer: "Lập kế hoạch, chuẩn bị, thực hiện kiểm tra, lập báo cáo",
    order_index: 3,
  },
  {
    id: "q-019",
    document_id: "doc-004",
    question: "TEST-Q4.4: Khác biệt giữa kiểm toán nội bộ và kiểm toán độc lập",
    answer: "Kiểm toán nội bộ do doanh nghiệp tổ chức, kiểm toán độc lập do bên thứ ba",
    order_index: 4,
  },
  {
    id: "q-020",
    document_id: "doc-004",
    question: "TEST-Q4.5: Nêu các phương pháp kiểm toán quan trọng",
    answer: "Kiểm tra chứng chỉ, xác minh thực, quan sát, phỏng vấn",
    order_index: 5,
  },
  // Document 5: Quản Lý Chiến Lược
  {
    id: "q-021",
    document_id: "doc-005",
    question: "TEST-Q5.1: Chiến lược kinh doanh là gì?",
    answer: "Kế hoạch dài hạn để đạt được mục tiêu cạnh tranh của doanh nghiệp",
    order_index: 1,
  },
  {
    id: "q-022",
    document_id: "doc-005",
    question: "TEST-Q5.2: Phân tích SWOT bao gồm những yếu tố nào?",
    answer: "Strengths, Weaknesses, Opportunities, Threats",
    order_index: 2,
  },
  {
    id: "q-023",
    document_id: "doc-005",
    question: "TEST-Q5.3: Mục tiêu của lập kế hoạch chiến lược là gì?",
    answer: "Xác định hướng phát triển và định hướng sử dụng tài nguyên hiệu quả",
    order_index: 3,
  },
  {
    id: "q-024",
    document_id: "doc-005",
    question: "TEST-Q5.4: Sự khác biệt giữa chiến lược và kế hoạch là gì?",
    answer: "Chiến lược là hướng dài hạn, kế hoạch là các bước cụ thể trong kỳ",
    order_index: 4,
  },
  {
    id: "q-025",
    document_id: "doc-005",
    question: "TEST-Q5.5: Nêu 3 chiến lược cạnh tranh cơ bản của Porter",
    answer: "Chi phí thấp, phân biệt hóa sản phẩm, tập trung vào thị trường có độ chuyên biệt",
    order_index: 5,
  },
  // Document 6: Quản Lý Tài Chính Doanh Nghiệp
  {
    id: "q-026",
    document_id: "doc-006",
    question: "TEST-Q6.1: Tài chính doanh nghiệp bao gồm những lĩnh vực nào?",
    answer: "Tài chính đầu tư, tài chính hoạt động, tài chính tài trợ",
    order_index: 1,
  },
  {
    id: "q-027",
    document_id: "doc-006",
    question: "TEST-Q6.2: Hãy nêu các nguồn vốn chính của doanh nghiệp",
    answer: "Vốn chủ sở hữu (equity) và vốn vay (debt)",
    order_index: 2,
  },
  {
    id: "q-028",
    document_id: "doc-006",
    question: "TEST-Q6.3: Chỉ số ROA (Return on Assets) được tính như thế nào?",
    answer: "ROA = Lợi nhuận ròng / Tổng tài sản",
    order_index: 3,
  },
  {
    id: "q-029",
    document_id: "doc-006",
    question: "TEST-Q6.4: Quản lý vốn lưu động có tác dụng gì?",
    answer: "Đảm bảo doanh nghiệp có đủ tiền mặt để thanh toán các khoản nợ ngắn hạn",
    order_index: 4,
  },
  {
    id: "q-030",
    document_id: "doc-006",
    question: "TEST-Q6.5: Nêu cách tính giá vốn của hàng tồn kho (COGS)",
    answer: "COGS = Tồn kho đầu kỳ + Nhập hàng - Tồn kho cuối kỳ",
    order_index: 5,
  },
];

/**
 * Get grouped categories with preview documents
 * Returns categories with limited documents for preview
 */
export const getGroupedCategories = (): GroupedCategory[] => {
  return mockCategories.map((cat) => ({
    id: cat.id,
    title: cat.title,
    logo: cat.logo,
    documents: mockDocuments
      .filter((doc) => doc.category_id === cat.id)
      .slice(0, 2), // Return only first 2 documents for preview
    total_count: mockDocuments.filter((doc) => doc.category_id === cat.id)
      .length,
  }));
};

/**
 * Get all documents (for search)
 */
export const getAllDocuments = (): MockDocument[] => {
  return mockDocuments;
};

/**
 * Get documents by category
 */
export const getDocumentsByCategory = (categoryId: string): MockDocument[] => {
  return mockDocuments.filter((doc) => doc.category_id === categoryId);
};

/**
 * Get questions by document
 */
export const getQuestionsByDocument = (documentId: string): MockQuestion[] => {
  return mockQuestions.filter((q) => q.document_id === documentId);
};

/**
 * Get a single document by ID
 */
export const getDocumentById = (docId: string): MockDocument | undefined => {
  return mockDocuments.find((doc) => doc.id === docId);
};
