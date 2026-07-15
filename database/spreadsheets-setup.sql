-- =============================================================
-- GOOGLE SHEETS SETUP - TABLE FOR SPREADSHEETS
-- =============================================================

CREATE TABLE IF NOT EXISTS public.spreadsheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Trang tính chưa có tên',
  content jsonb DEFAULT '{"cells": {}, "rowCount": 100, "columnCount": 26}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Thêm Indexes để tối ưu hóa truy vấn
CREATE INDEX IF NOT EXISTS idx_spreadsheets_created_by ON public.spreadsheets(created_by);
CREATE INDEX IF NOT EXISTS idx_spreadsheets_updated_at ON public.spreadsheets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_spreadsheets_title ON public.spreadsheets(title);
CREATE INDEX IF NOT EXISTS idx_spreadsheets_created_at ON public.spreadsheets(created_at DESC);

-- Bật RLS
ALTER TABLE public.spreadsheets ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách RLS
DROP POLICY IF EXISTS "select_spreadsheets" ON public.spreadsheets;
CREATE POLICY "select_spreadsheets" ON public.spreadsheets 
  FOR SELECT 
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  );

DROP POLICY IF EXISTS "insert_spreadsheets" ON public.spreadsheets;
CREATE POLICY "insert_spreadsheets" ON public.spreadsheets 
  FOR INSERT 
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  );

DROP POLICY IF EXISTS "update_spreadsheets" ON public.spreadsheets;
CREATE POLICY "update_spreadsheets" ON public.spreadsheets 
  FOR UPDATE 
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  );

DROP POLICY IF EXISTS "delete_spreadsheets" ON public.spreadsheets;
CREATE POLICY "delete_spreadsheets" ON public.spreadsheets 
  FOR DELETE 
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  );

-- Thêm trigger tự cập nhật updated_at
DROP TRIGGER IF EXISTS spreadsheets_set_updated_at ON public.spreadsheets;
CREATE TRIGGER spreadsheets_set_updated_at 
  BEFORE UPDATE ON public.spreadsheets 
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_updated_at();
