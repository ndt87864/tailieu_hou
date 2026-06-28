-- Migration: Thay đổi hành vi xóa category và document thành CASCADE
-- Chạy script này trên Supabase SQL Editor

-- 1. Xóa ràng buộc khóa ngoại cũ của documents tham chiếu đến categories (mặc định là documents_category_id_fkey)
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_category_id_fkey;

-- 2. Tạo lại ràng buộc khóa ngoại với ON DELETE CASCADE
ALTER TABLE public.documents
  ADD CONSTRAINT documents_category_id_fkey 
  FOREIGN KEY (category_id) 
  REFERENCES public.categories(id) 
  ON DELETE CASCADE;

-- 3. Đảm bảo questions tham chiếu đến documents cũng là ON DELETE CASCADE
-- Xóa ràng buộc cũ nếu có và thêm lại để đảm bảo tính đồng bộ
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_document_id_fkey;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_document_id_fkey 
  FOREIGN KEY (document_id) 
  REFERENCES public.documents(id) 
  ON DELETE CASCADE;
