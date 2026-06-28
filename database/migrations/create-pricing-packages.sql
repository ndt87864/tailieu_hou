-- Migration: Create pricing_packages table for frontend contact page and admin pricing tab
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price text NOT NULL,
  savings text,
  icon text,
  features jsonb DEFAULT '[]'::jsonb, -- Store list of feature strings: ["feature 1", "feature 2"]
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "allow_public_read_pricing_packages" ON public.pricing_packages;
DROP POLICY IF EXISTS "admin_all_pricing_packages" ON public.pricing_packages;

-- Policies
CREATE POLICY "allow_public_read_pricing_packages" ON public.pricing_packages
  FOR SELECT USING (true);

CREATE POLICY "admin_all_pricing_packages" ON public.pricing_packages
  FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS pricing_packages_set_updated_at ON public.pricing_packages;
CREATE TRIGGER pricing_packages_set_updated_at BEFORE UPDATE ON public.pricing_packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Insert default packages
INSERT INTO public.pricing_packages (name, price, savings, icon, features, display_order) VALUES
  (
    'Gói Free',
    '0đ',
    'Mặc định khi đăng ký',
    'free',
    '["Xem tối đa 10 câu hỏi/ngày", "Tỷ lệ câu hỏi hiển thị giới hạn (20%)", "Quảng cáo cơ bản"]'::jsonb,
    1
  ),
  (
    'Gói Plus',
    '99.000đ',
    'Phù hợp ôn tập nhanh (30 ngày)',
    'plus',
    '["Mở khóa bộ câu hỏi đã chọn trong 30 ngày", "Xem tối đa 100 câu hỏi/ngày", "Xem đáp án chi tiết và giải thích đầy đủ", "Không có quảng cáo phiền toái"]'::jsonb,
    2
  ),
  (
    'Gói Pro',
    '249.000đ',
    'Tiết kiệm hơn (90 ngày)',
    'pro',
    '["Mở khóa toàn bộ danh mục tài liệu đã chọn", "Không giới hạn số câu hỏi xem mỗi ngày", "Xem đáp án chi tiết và giải thích đầy đủ", "Hỗ trợ học tập trực tiếp từ Admin"]'::jsonb,
    3
  ),
  (
    'Gói Ultra',
    '399.000đ',
    'Đầy đủ đặc quyền VIP (180 ngày)',
    'ultra',
    '["Mở khóa toàn bộ tài nguyên trên hệ thống", "Không giới hạn số câu hỏi xem mỗi ngày", "Ưu tiên hỗ trợ kỹ thuật và giải đáp 24/7", "Nhận đề thi thử & tài liệu ôn tập độc quyền"]'::jsonb,
    4
  )
ON CONFLICT DO NOTHING;
