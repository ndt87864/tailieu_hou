-- Test Data Seed Script for Tài Liệu HOU
-- Creates: 3 categories, 6 documents, 30 questions
-- All data prefixed with TEST- for easy identification

BEGIN;

-- ============================================
-- STEP 1: Clean up old test data
-- ============================================
DELETE FROM questions 
WHERE document_id IN (
  SELECT id FROM documents 
  WHERE category_id IN (
    SELECT id FROM categories 
    WHERE slug LIKE 'test-%'
  )
);

DELETE FROM documents 
WHERE category_id IN (
  SELECT id FROM categories 
  WHERE slug LIKE 'test-%'
);

DELETE FROM categories 
WHERE slug LIKE 'test-%';

-- ============================================
-- STEP 2: Insert 3 Test Categories
-- ============================================
INSERT INTO categories (name, slug, description, icon, color, is_active, created_at, updated_at)
VALUES 
(
  'TEST-Môn Đại Cương',
  'test-mon-dai-cuong',
  'Các môn học đại cương cho tất cả sinh viên',
  'BookOpen',
  '#167d4a',
  true,
  NOW(),
  NOW()
),
(
  'TEST-Kế Toán Tài Chính',
  'test-ke-toan-tai-chinh',
  'Các môn học về kế toán, tài chính và kiểm toán',
  'BarChart3',
  '#ff7a3d',
  true,
  NOW(),
  NOW()
),
(
  'TEST-Quản Trị Kinh Doanh',
  'test-quan-tri-kinh-doanh',
  'Các môn học về quản lý và phát triển kinh doanh',
  'Briefcase',
  '#167d4a',
  true,
  NOW(),
  NOW()
);

-- ============================================
-- STEP 3: Insert 6 Test Documents (2 per category)
-- ============================================

-- Category 1: Môn Đại Cương
INSERT INTO documents (category_id, title, slug, description, is_active, created_at, updated_at)
SELECT id, 'TEST-Tiếng Anh Cơ Bản 1', 'test-tieng-anh-co-ban-1', 'Tài liệu ôn tập tiếng Anh cơ bản dành cho sinh viên năm 1', true, NOW(), NOW()
FROM categories WHERE slug = 'test-mon-dai-cuong'
UNION ALL
SELECT id, 'TEST-Triết Học Mác Lênin', 'test-triet-hoc-mac-lenin', 'Tài liệu ôn tập triết học Mác Lênin - Tư tưởng Hồ Chí Minh', true, NOW(), NOW()
FROM categories WHERE slug = 'test-mon-dai-cuong'

-- Category 2: Kế Toán Tài Chính
UNION ALL
SELECT id, 'TEST-Kế Toán Tổng Hợp', 'test-ke-toan-tong-hop', 'Tài liệu ôn tập kế toán tổng hợp - Nguyên lý cơ bản', true, NOW(), NOW()
FROM categories WHERE slug = 'test-ke-toan-tai-chinh'
UNION ALL
SELECT id, 'TEST-Kiểm Toán Nội Bộ', 'test-kiem-toan-noi-bo', 'Tài liệu ôn tập kiểm toán nội bộ - Quy trình và thủ tục', true, NOW(), NOW()
FROM categories WHERE slug = 'test-ke-toan-tai-chinh'

-- Category 3: Quản Trị Kinh Doanh
UNION ALL
SELECT id, 'TEST-Quản Lý Chiến Lược', 'test-quan-ly-chien-luoc', 'Tài liệu ôn tập quản lý chiến lược doanh nghiệp', true, NOW(), NOW()
FROM categories WHERE slug = 'test-quan-tri-kinh-doanh'
UNION ALL
SELECT id, 'TEST-Quản Lý Tài Chính Doanh Nghiệp', 'test-quan-ly-tai-chinh-doanh-nghiep', 'Tài liệu ôn tập quản lý tài chính doanh nghiệp', true, NOW(), NOW()
FROM categories WHERE slug = 'test-quan-tri-kinh-doanh';

-- ============================================
-- STEP 4: Insert 30 Test Questions (5 per document)
-- ============================================

-- Document 1: TEST-Tiếng Anh Cơ Bản 1 (5 questions)
INSERT INTO questions (document_id, question_text, question_type, is_active, created_at, updated_at)
SELECT d.id, 'TEST-Q1.1: What is the present simple tense used for?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-tieng-anh-co-ban-1'
UNION ALL
SELECT d.id, 'TEST-Q1.2: Choose the correct form of the verb in the sentence: She _____ (go) to school every day.', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-tieng-anh-co-ban-1'
UNION ALL
SELECT d.id, 'TEST-Q1.3: Fill in the blank: They are _____ (read) a book right now.', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-tieng-anh-co-ban-1'
UNION ALL
SELECT d.id, 'TEST-Q1.4: Translate to English: "Tôi thích ăn trái cây vào buổi sáng"', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-tieng-anh-co-ban-1'
UNION ALL
SELECT d.id, 'TEST-Q1.5: What is the difference between "a" and "an"?', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-tieng-anh-co-ban-1'

-- Document 2: TEST-Triết Học Mác Lênin (5 questions)
UNION ALL
SELECT d.id, 'TEST-Q2.1: Khái niệm chủ nghĩa duy vật lịch sử là gì?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-triet-hoc-mac-lenin'
UNION ALL
SELECT d.id, 'TEST-Q2.2: Hãy giải thích nguyên lý mâu thuẫn trong triết học Mác', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-triet-hoc-mac-lenin'
UNION ALL
SELECT d.id, 'TEST-Q2.3: Karl Marx và Friedrich Engels đã viết cuốn sách quan trọng nào?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-triet-hoc-mac-lenin'
UNION ALL
SELECT d.id, 'TEST-Q2.4: Giai cấp nào được Mác coi là lực lượng cách mạng chính?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-triet-hoc-mac-lenin'
UNION ALL
SELECT d.id, 'TEST-Q2.5: Nêu quan điểm của Lenin về vai trò của Đảng Cộng Sản', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-triet-hoc-mac-lenin'

-- Document 3: TEST-Kế Toán Tổng Hợp (5 questions)
UNION ALL
SELECT d.id, 'TEST-Q3.1: Phương trình kế toán cơ bản là gì?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-ke-toan-tong-hop'
UNION ALL
SELECT d.id, 'TEST-Q3.2: Hãy nêu 5 loại tài khoản chính trong kế toán', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-ke-toan-tong-hop'
UNION ALL
SELECT d.id, 'TEST-Q3.3: Nguyên tắc "Debit bằng Credit" có nghĩa là gì?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-ke-toan-tong-hop'
UNION ALL
SELECT d.id, 'TEST-Q3.4: Sự khác biệt giữa chi phí và tài sản là gì?', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-ke-toan-tong-hop'
UNION ALL
SELECT d.id, 'TEST-Q3.5: Báo cáo tài chính chính thức gồm những gì?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-ke-toan-tong-hop'

-- Document 4: TEST-Kiểm Toán Nội Bộ (5 questions)
UNION ALL
SELECT d.id, 'TEST-Q4.1: Định nghĩa kiểm toán nội bộ là gì?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-kiem-toan-noi-bo'
UNION ALL
SELECT d.id, 'TEST-Q4.2: Vai trò của kiểm toán nội bộ trong doanh nghiệp', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-kiem-toan-noi-bo'
UNION ALL
SELECT d.id, 'TEST-Q4.3: Các giai đoạn chính của quá trình kiểm toán nội bộ', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-kiem-toan-noi-bo'
UNION ALL
SELECT d.id, 'TEST-Q4.4: Khác biệt giữa kiểm toán nội bộ và kiểm toán độc lập', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-kiem-toan-noi-bo'
UNION ALL
SELECT d.id, 'TEST-Q4.5: Nêu các phương pháp kiểm toán quan trọng', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-kiem-toan-noi-bo'

-- Document 5: TEST-Quản Lý Chiến Lược (5 questions)
UNION ALL
SELECT d.id, 'TEST-Q5.1: Chiến lược kinh doanh là gì?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-chien-luoc'
UNION ALL
SELECT d.id, 'TEST-Q5.2: Phân tích SWOT bao gồm những yếu tố nào?', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-chien-luoc'
UNION ALL
SELECT d.id, 'TEST-Q5.3: Mục tiêu của lập kế hoạch chiến lược là gì?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-chien-luoc'
UNION ALL
SELECT d.id, 'TEST-Q5.4: Sự khác biệt giữa chiến lược và kế hoạch là gì?', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-chien-luoc'
UNION ALL
SELECT d.id, 'TEST-Q5.5: Nêu 3 chiến lược cạnh tranh cơ bản của Porter', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-chien-luoc'

-- Document 6: TEST-Quản Lý Tài Chính Doanh Nghiệp (5 questions)
UNION ALL
SELECT d.id, 'TEST-Q6.1: Tài chính doanh nghiệp bao gồm những lĩnh vực nào?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-tai-chinh-doanh-nghiep'
UNION ALL
SELECT d.id, 'TEST-Q6.2: Hãy nêu các nguồn vốn chính của doanh nghiệp', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-tai-chinh-doanh-nghiep'
UNION ALL
SELECT d.id, 'TEST-Q6.3: Chỉ số ROA (Return on Assets) được tính như thế nào?', 'multiple_choice', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-tai-chinh-doanh-nghiep'
UNION ALL
SELECT d.id, 'TEST-Q6.4: Quản lý vốn lưu động có tác dụng gì?', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-tai-chinh-doanh-nghiep'
UNION ALL
SELECT d.id, 'TEST-Q6.5: Nêu cách tính giá vốn của hàng tồn kho (COGS)', 'short_answer', true, NOW(), NOW()
FROM documents d WHERE d.slug = 'test-quan-ly-tai-chinh-doanh-nghiep';

-- ============================================
-- STEP 5: Verification & Commit
-- ============================================
-- Verify data inserted
SELECT 'Categories created:' as info, COUNT(*) as count FROM categories WHERE slug LIKE 'test-%'
UNION ALL
SELECT 'Documents created:', COUNT(*) FROM documents WHERE category_id IN (SELECT id FROM categories WHERE slug LIKE 'test-%')
UNION ALL
SELECT 'Questions created:', COUNT(*) FROM questions WHERE document_id IN (SELECT id FROM documents WHERE category_id IN (SELECT id FROM categories WHERE slug LIKE 'test-%'));

COMMIT;
