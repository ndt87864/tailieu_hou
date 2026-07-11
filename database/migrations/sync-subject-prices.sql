-- Migration: Create trigger to delete subject prices when no student_infor has that subject.
-- Run this on Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.delete_unused_subject_price()
RETURNS trigger AS $$
BEGIN
  -- Check if the subject is still referenced by any student_infor record
  IF NOT EXISTS (
    SELECT 1 FROM public.student_infor 
    WHERE subject = OLD.subject
  ) THEN
    -- If no records reference the subject, delete it from subject_prices
    DELETE FROM public.subject_prices 
    WHERE subject = OLD.subject;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_delete_unused_subject_price ON public.student_infor;
CREATE TRIGGER trigger_delete_unused_subject_price
AFTER DELETE OR UPDATE OF subject ON public.student_infor
FOR EACH ROW
EXECUTE FUNCTION public.delete_unused_subject_price();

-- Dọn dẹp dữ liệu cũ (Xóa các môn học trong subject_prices không tồn tại trong student_infor)
DELETE FROM public.subject_prices
WHERE subject NOT IN (
  SELECT DISTINCT subject 
  FROM public.student_infor 
  WHERE subject IS NOT NULL
);

-- Khởi tạo mặc định (Thêm các môn học có trong student_infor nhưng subject_prices chưa có với giá mặc định 100k)
INSERT INTO public.subject_prices (subject, price)
SELECT DISTINCT subject, 100000
FROM public.student_infor
WHERE subject IS NOT NULL AND subject != ''
ON CONFLICT (subject) DO NOTHING;

