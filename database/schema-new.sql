-- =============================================================
-- SCHEMA MỚI - TINH GỌN - CHO DB SUPABASE MỚI (tailieu_hou)
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text,
  logo text,
  stt integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  slug text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_category_id ON public.documents(category_id);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 3. QUESTIONS (Đã bỏ correct_answer)
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text DEFAULT '',
  choices jsonb DEFAULT '[]'::jsonb,
  url_question text,
  url_answer text,
  order_index integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_document_id ON public.questions(document_id);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 4. STUDENT_INFOR
CREATE TABLE IF NOT EXISTS public.student_infor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "studentId" text,
  course text,
  dob date,
  "examDate" date,
  "examLink" text,
  "examRoom" text,
  "examSession" text,
  "examTime" text,
  "examType" text,
  "fullName" text,
  "majorCode" text,
  subject text,
  username text,
  status text DEFAULT 'unverified',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.student_infor ENABLE ROW LEVEL SECURITY;

-- 5. PROFILES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'management', 'ultra', 'pro', 'plus', 'free');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  phone text,
  role user_role DEFAULT 'free' NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'free',
    COALESCE(new.raw_user_meta_data->>'phone', NULL)
  );
  
  INSERT INTO public.ui_settings (user_id, theme_mode, primary_color)
  VALUES (new.id, 'system', 'indigo')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES
DROP POLICY IF EXISTS "anon_select_categories" ON public.categories;
CREATE POLICY "anon_select_categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_all_categories" ON public.categories;
CREATE POLICY "admin_all_categories" ON public.categories FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','management'));

DROP POLICY IF EXISTS "anon_select_documents" ON public.documents;
CREATE POLICY "anon_select_documents" ON public.documents FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_all_documents" ON public.documents;
CREATE POLICY "admin_all_documents" ON public.documents FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','management'));

DROP POLICY IF EXISTS "anon_select_questions" ON public.questions;
CREATE POLICY "anon_select_questions" ON public.questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_all_questions" ON public.questions;
CREATE POLICY "admin_all_questions" ON public.questions FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','management'));

DROP POLICY IF EXISTS "student_read_own" ON public.student_infor;
CREATE POLICY "student_read_own" ON public.student_infor FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_all_student" ON public.student_infor;
CREATE POLICY "admin_all_student" ON public.student_infor FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
CREATE POLICY "admin_all_profiles" ON public.profiles FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
DROP POLICY IF EXISTS "user_read_own_profile" ON public.profiles;
CREATE POLICY "user_read_own_profile" ON public.profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "user_update_own_profile" ON public.profiles;
CREATE POLICY "user_update_own_profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Triggers updated_at
DROP TRIGGER IF EXISTS categories_set_updated_at ON public.categories;
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS documents_set_updated_at ON public.documents;
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS questions_set_updated_at ON public.questions;
CREATE TRIGGER questions_set_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS student_infor_set_updated_at ON public.student_infor;
CREATE TRIGGER student_infor_set_updated_at BEFORE UPDATE ON public.student_infor FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. UI SETTINGS
CREATE TABLE IF NOT EXISTS public.ui_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme_mode text DEFAULT 'system',
  primary_color text DEFAULT 'indigo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ui_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_read_own_ui" ON public.ui_settings;
CREATE POLICY "user_read_own_ui" ON public.ui_settings FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_all_own_ui" ON public.ui_settings;
CREATE POLICY "user_all_own_ui" ON public.ui_settings FOR ALL USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS ui_settings_set_updated_at ON public.ui_settings;
CREATE TRIGGER ui_settings_set_updated_at BEFORE UPDATE ON public.ui_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
