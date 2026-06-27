-- =============================================================
-- FULL ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- =============================================================

-- Ensure RLS is enabled on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_infor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check user role (prevents recursion on profiles table if written carefully)
-- Note: Supabase custom claims or direct role comparison is used.

-- 1. CATEGORIES POLICIES
DROP POLICY IF EXISTS "select_categories_all" ON public.categories;
CREATE POLICY "select_categories_all" ON public.categories 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_categories_admin" ON public.categories;
CREATE POLICY "insert_categories_admin" ON public.categories 
  FOR INSERT WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "update_categories_admin" ON public.categories;
CREATE POLICY "update_categories_admin" ON public.categories 
  FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "delete_categories_admin" ON public.categories;
CREATE POLICY "delete_categories_admin" ON public.categories 
  FOR DELETE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));


-- 2. DOCUMENTS POLICIES
DROP POLICY IF EXISTS "select_documents_all" ON public.documents;
CREATE POLICY "select_documents_all" ON public.documents 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_documents_admin" ON public.documents;
CREATE POLICY "insert_documents_admin" ON public.documents 
  FOR INSERT WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "update_documents_admin" ON public.documents;
CREATE POLICY "update_documents_admin" ON public.documents 
  FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "delete_documents_admin" ON public.documents;
CREATE POLICY "delete_documents_admin" ON public.documents 
  FOR DELETE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));


-- 3. QUESTIONS POLICIES
DROP POLICY IF EXISTS "select_questions_all" ON public.questions;
CREATE POLICY "select_questions_all" ON public.questions 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_questions_admin" ON public.questions;
CREATE POLICY "insert_questions_admin" ON public.questions 
  FOR INSERT WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "update_questions_admin" ON public.questions;
CREATE POLICY "update_questions_admin" ON public.questions 
  FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'))
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "delete_questions_admin" ON public.questions;
CREATE POLICY "delete_questions_admin" ON public.questions 
  FOR DELETE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));


-- 4. STUDENT_INFOR POLICIES
DROP POLICY IF EXISTS "select_student_infor_all" ON public.student_infor;
CREATE POLICY "select_student_infor_all" ON public.student_infor 
  FOR SELECT USING (true); -- Cho phép tra cứu lịch thi tự do hoặc lọc theo mã sinh viên

DROP POLICY IF EXISTS "insert_student_infor_admin" ON public.student_infor;
CREATE POLICY "insert_student_infor_admin" ON public.student_infor 
  FOR INSERT WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "update_student_infor_admin" ON public.student_infor;
CREATE POLICY "update_student_infor_admin" ON public.student_infor 
  FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "delete_student_infor_admin" ON public.student_infor;
CREATE POLICY "delete_student_infor_admin" ON public.student_infor 
  FOR DELETE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- 5. PROFILES POLICIES
DROP POLICY IF EXISTS "select_profiles_rules" ON public.profiles;
CREATE POLICY "select_profiles_rules" ON public.profiles 
  FOR SELECT USING (id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "insert_profiles_rules" ON public.profiles;
CREATE POLICY "insert_profiles_rules" ON public.profiles 
  FOR INSERT WITH CHECK (true); -- Cho phép tạo mới profile khi đăng ký (hoặc qua trigger chạy definer)

DROP POLICY IF EXISTS "update_profiles_rules" ON public.profiles;
CREATE POLICY "update_profiles_rules" ON public.profiles 
  FOR UPDATE USING (id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "delete_profiles_rules" ON public.profiles;
CREATE POLICY "delete_profiles_rules" ON public.profiles 
  FOR DELETE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- 6. UI_SETTINGS POLICIES
DROP POLICY IF EXISTS "select_ui_settings_rules" ON public.ui_settings;
CREATE POLICY "select_ui_settings_rules" ON public.ui_settings 
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "all_ui_settings_rules" ON public.ui_settings;
CREATE POLICY "all_ui_settings_rules" ON public.ui_settings 
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
