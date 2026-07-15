-- =============================================================
-- SPREADSHEET FORMULAS SETUP - TABLE FOR COMMON FORMULAS
-- =============================================================

CREATE TABLE IF NOT EXISTS public.spreadsheet_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  formula text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bật RLS
ALTER TABLE public.spreadsheet_formulas ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách RLS
DROP POLICY IF EXISTS "select_formulas" ON public.spreadsheet_formulas;
CREATE POLICY "select_formulas" ON public.spreadsheet_formulas 
  FOR SELECT 
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  );

DROP POLICY IF EXISTS "insert_formulas" ON public.spreadsheet_formulas;
CREATE POLICY "insert_formulas" ON public.spreadsheet_formulas 
  FOR INSERT 
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  );

DROP POLICY IF EXISTS "update_formulas" ON public.spreadsheet_formulas;
CREATE POLICY "update_formulas" ON public.spreadsheet_formulas 
  FOR UPDATE 
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  );

DROP POLICY IF EXISTS "delete_formulas" ON public.spreadsheet_formulas;
CREATE POLICY "delete_formulas" ON public.spreadsheet_formulas 
  FOR DELETE 
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'management')
  );

-- Thêm trigger tự cập nhật updated_at
DROP TRIGGER IF EXISTS spreadsheet_formulas_set_updated_at ON public.spreadsheet_formulas;
CREATE TRIGGER spreadsheet_formulas_set_updated_at 
  BEFORE UPDATE ON public.spreadsheet_formulas 
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_updated_at();

-- Thêm một vài công thức mẫu cơ bản ban đầu
INSERT INTO public.spreadsheet_formulas (name, formula, description)
VALUES 
  ('Tính tổng doanh thu', '=SUM(E2:E10)', 'Tính tổng giá trị cột doanh thu từ ô E2 đến E10'),
  ('Tìm kiếm thông tin sinh viên', '=VLOOKUP(A2, B2:D10, 2, FALSE)', 'Tìm tên sinh viên theo mã số ở cột A2 trong vùng B2:D10'),
  ('Đếm số lượng sinh viên đạt', '=COUNTIF(F2:F10, ">=5")', 'Đếm các ô có điểm số từ 5 trở lên trong cột F2 đến F10')
ON CONFLICT DO NOTHING;
