-- ============================================================
-- Migration: create-extension-config
-- Mục đích: Tạo table quản lý cấu hình extension từ xa
--           Cho phép bật/tắt kết nối DB của extension (db_mode)
-- Idempotent: chạy lại nhiều lần không bị lỗi
-- ============================================================

-- Tạo ENUM type (bỏ qua nếu đã tồn tại)
DO $$ BEGIN
  CREATE TYPE db_mode_enum AS ENUM ('off', 'questions', 'question_crawler');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tạo table quản lý cấu hình extension từ xa
CREATE TABLE IF NOT EXISTS extension_config (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,           -- tên config, ví dụ: 'db_mode'
  value       db_mode_enum NOT NULL,          -- chỉ cho phép: 'off' | 'questions' | 'question_crawler'
  description TEXT,                           -- mô tả (tuỳ chọn)
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by  TEXT                            -- ghi lại ai đã thay đổi (tuỳ chọn)
);

-- Function tự động cập nhật updated_at khi có thay đổi
CREATE OR REPLACE FUNCTION update_extension_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Xoá trigger cũ nếu tồn tại rồi tạo lại
DROP TRIGGER IF EXISTS trg_extension_config_updated_at ON extension_config;
CREATE TRIGGER trg_extension_config_updated_at
  BEFORE UPDATE ON extension_config
  FOR EACH ROW EXECUTE FUNCTION update_extension_config_timestamp();

-- Chèn giá trị mặc định cho db_mode (bỏ qua nếu đã tồn tại)
INSERT INTO extension_config (key, value, description)
VALUES ('db_mode', 'questions', 'Chế độ kết nối DB của extension: off | questions | question_crawler')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RLS Policies
-- - Anon / authenticated: chỉ được đọc (SELECT)
-- - Service role (backend): toàn quyền
-- ============================================================
ALTER TABLE extension_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extension_config: allow public read" ON extension_config;
CREATE POLICY "extension_config: allow public read"
  ON extension_config FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "extension_config: allow service role write" ON extension_config;
CREATE POLICY "extension_config: allow service role write"
  ON extension_config FOR ALL
  USING (auth.role() = 'service_role');
