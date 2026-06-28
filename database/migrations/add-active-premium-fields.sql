-- ================================================================
-- Migration: Thêm trường active và premium cho categories & documents
-- active = true  → hiển thị trên trang thường
-- active = false → ẩn khỏi trang thường
-- premium = true → chỉ hiển thị với tài khoản premium (plus/pro/ultra/admin)
-- premium = false → hiển thị cho tất cả tài khoản
-- ================================================================

-- 1. Bảng categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS active  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS premium BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Bảng documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS active  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS premium BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Index để filter nhanh
CREATE INDEX IF NOT EXISTS idx_categories_active  ON categories (active);
CREATE INDEX IF NOT EXISTS idx_categories_premium ON categories (premium);
CREATE INDEX IF NOT EXISTS idx_documents_active   ON documents  (active);
CREATE INDEX IF NOT EXISTS idx_documents_premium  ON documents  (premium);

-- Ghi chú:
-- Tất cả bản ghi cũ mặc định active = true, premium = false
-- → hành vi không thay đổi so với trước khi migrate
