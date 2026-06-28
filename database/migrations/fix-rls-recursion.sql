-- =============================================================
-- FIX RLS INFINITE RECURSION FOR PROFILES TABLE
-- =============================================================

-- 1. Helper function with SECURITY DEFINER to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text AS $$
DECLARE
  u_role text;
BEGIN
  SELECT role::text INTO u_role FROM public.profiles WHERE id = user_id;
  RETURN COALESCE(u_role, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Update CATEGORIES POLICIES
DROP POLICY IF EXISTS "insert_categories_admin" ON public.categories;
CREATE POLICY "insert_categories_admin" ON public.categories 
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "update_categories_admin" ON public.categories;
CREATE POLICY "update_categories_admin" ON public.categories 
  FOR UPDATE USING (public.get_user_role(auth.uid()) IN ('admin', 'management'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "delete_categories_admin" ON public.categories;
CREATE POLICY "delete_categories_admin" ON public.categories 
  FOR DELETE USING (public.get_user_role(auth.uid()) IN ('admin', 'management'));


-- 3. Update DOCUMENTS POLICIES
DROP POLICY IF EXISTS "insert_documents_admin" ON public.documents;
CREATE POLICY "insert_documents_admin" ON public.documents 
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "update_documents_admin" ON public.documents;
CREATE POLICY "update_documents_admin" ON public.documents 
  FOR UPDATE USING (public.get_user_role(auth.uid()) IN ('admin', 'management'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "delete_documents_admin" ON public.documents;
CREATE POLICY "delete_documents_admin" ON public.documents 
  FOR DELETE USING (public.get_user_role(auth.uid()) IN ('admin', 'management'));


-- 4. Update QUESTIONS POLICIES
DROP POLICY IF EXISTS "insert_questions_admin" ON public.questions;
CREATE POLICY "insert_questions_admin" ON public.questions 
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "update_questions_admin" ON public.questions;
CREATE POLICY "update_questions_admin" ON public.questions 
  FOR UPDATE USING (public.get_user_role(auth.uid()) IN ('admin', 'management'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'management'));

DROP POLICY IF EXISTS "delete_questions_admin" ON public.questions;
CREATE POLICY "delete_questions_admin" ON public.questions 
  FOR DELETE USING (public.get_user_role(auth.uid()) IN ('admin', 'management'));


-- 5. Update STUDENT_INFOR POLICIES
DROP POLICY IF EXISTS "insert_student_infor_admin" ON public.student_infor;
CREATE POLICY "insert_student_infor_admin" ON public.student_infor 
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "update_student_infor_admin" ON public.student_infor;
CREATE POLICY "update_student_infor_admin" ON public.student_infor 
  FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "delete_student_infor_admin" ON public.student_infor;
CREATE POLICY "delete_student_infor_admin" ON public.student_infor 
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');


-- 6. Update PROFILES POLICIES
DROP POLICY IF EXISTS "select_profiles_rules" ON public.profiles;
CREATE POLICY "select_profiles_rules" ON public.profiles 
  FOR SELECT USING (id = auth.uid() OR (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "update_profiles_rules" ON public.profiles;
CREATE POLICY "update_profiles_rules" ON public.profiles 
  FOR UPDATE USING (id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "delete_profiles_rules" ON public.profiles;
CREATE POLICY "delete_profiles_rules" ON public.profiles 
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');
