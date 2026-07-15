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

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text AS $$
DECLARE
  u_role text;
BEGIN
  SELECT role::text INTO u_role FROM public.profiles WHERE id = user_id;
  RETURN COALESCE(u_role, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


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
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
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
CREATE POLICY "admin_all_categories" ON public.categories FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin','management'));

DROP POLICY IF EXISTS "anon_select_documents" ON public.documents;
CREATE POLICY "anon_select_documents" ON public.documents FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_all_documents" ON public.documents;
CREATE POLICY "admin_all_documents" ON public.documents FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin','management'));

DROP POLICY IF EXISTS "anon_select_questions" ON public.questions;
CREATE POLICY "anon_select_questions" ON public.questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_all_questions" ON public.questions;
CREATE POLICY "admin_all_questions" ON public.questions FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin','management'));

DROP POLICY IF EXISTS "student_read_own" ON public.student_infor;
CREATE POLICY "student_read_own" ON public.student_infor FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_all_student" ON public.student_infor;
DROP POLICY IF EXISTS "insert_student_infor_admin" ON public.student_infor;
CREATE POLICY "insert_student_infor_admin" ON public.student_infor FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
DROP POLICY IF EXISTS "update_student_infor_admin" ON public.student_infor;
CREATE POLICY "update_student_infor_admin" ON public.student_infor FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin') WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
DROP POLICY IF EXISTS "delete_student_infor_admin" ON public.student_infor;
CREATE POLICY "delete_student_infor_admin" ON public.student_infor FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "select_profiles_rules" ON public.profiles;
CREATE POLICY "select_profiles_rules" ON public.profiles FOR SELECT USING (id = auth.uid() OR (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'admin');
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "user_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "user_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_profiles_rules" ON public.profiles;
CREATE POLICY "update_profiles_rules" ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin') WITH CHECK (id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin');
DROP POLICY IF EXISTS "delete_profiles_rules" ON public.profiles;
CREATE POLICY "delete_profiles_rules" ON public.profiles FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

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

-- 7. PREMIUM USER
CREATE TABLE IF NOT EXISTS public.premium_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_profile_document UNIQUE (profile_id, document_id),
  CONSTRAINT unique_profile_category UNIQUE (profile_id, category_id)
);

ALTER TABLE public.premium_user ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_premium_user" ON public.premium_user;
CREATE POLICY "admin_all_premium_user" ON public.premium_user FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin','management'));

DROP POLICY IF EXISTS "user_read_own_premium_user" ON public.premium_user;
CREATE POLICY "user_read_own_premium_user" ON public.premium_user FOR SELECT USING (profile_id = auth.uid());

DROP TRIGGER IF EXISTS premium_user_set_updated_at ON public.premium_user;
CREATE TRIGGER premium_user_set_updated_at BEFORE UPDATE ON public.premium_user FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. SUBJECT_PRICES
CREATE TABLE IF NOT EXISTS public.subject_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL UNIQUE,
  price numeric NOT NULL DEFAULT 100000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subject_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_subject_prices_all" ON public.subject_prices;
CREATE POLICY "select_subject_prices_all" ON public.subject_prices FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_all_subject_prices" ON public.subject_prices;
CREATE POLICY "admin_all_subject_prices" ON public.subject_prices FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

DROP TRIGGER IF EXISTS subject_prices_set_updated_at ON public.subject_prices;
CREATE TRIGGER subject_prices_set_updated_at BEFORE UPDATE ON public.subject_prices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. PROXY_REGISTRATIONS
CREATE TABLE IF NOT EXISTS public.proxy_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL UNIQUE,
  selected_ids text,
  bill_url text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.proxy_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_proxy_registrations_all" ON public.proxy_registrations;
CREATE POLICY "select_proxy_registrations_all" ON public.proxy_registrations FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_all_proxy_registrations" ON public.proxy_registrations;
CREATE POLICY "admin_all_proxy_registrations" ON public.proxy_registrations FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

DROP TRIGGER IF EXISTS proxy_registrations_set_updated_at ON public.proxy_registrations;
CREATE TRIGGER proxy_registrations_set_updated_at BEFORE UPDATE ON public.proxy_registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. REGISTRATION_QUEUE
CREATE TABLE IF NOT EXISTS public.registration_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text,
  selected_ids text,
  full_name text,
  username text,
  bill_url text,
  quantity integer,
  total_amount numeric,
  status text DEFAULT 'pending',
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.registration_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_registration_queue_all" ON public.registration_queue;
CREATE POLICY "select_registration_queue_all" ON public.registration_queue FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_registration_queue_all" ON public.registration_queue;
CREATE POLICY "insert_registration_queue_all" ON public.registration_queue FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_registration_queue" ON public.registration_queue;
CREATE POLICY "admin_all_registration_queue" ON public.registration_queue FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

DROP TRIGGER IF EXISTS registration_queue_set_updated_at ON public.registration_queue;
CREATE TRIGGER registration_queue_set_updated_at BEFORE UPDATE ON public.registration_queue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE questions ADD COLUMN url_choices TEXT DEFAULT NULL;

-- Tối ưu hóa hiệu năng truy vấn cho bảng student_infor
CREATE INDEX IF NOT EXISTS idx_student_infor_studentId ON public.student_infor("studentId");
CREATE INDEX IF NOT EXISTS idx_student_infor_fullName ON public.student_infor("fullName");
CREATE INDEX IF NOT EXISTS idx_student_infor_username ON public.student_infor("username");
CREATE INDEX IF NOT EXISTS idx_student_infor_subject ON public.student_infor(subject);
CREATE INDEX IF NOT EXISTS idx_student_infor_course ON public.student_infor(course);
CREATE INDEX IF NOT EXISTS idx_student_infor_majorCode ON public.student_infor("majorCode");
CREATE INDEX IF NOT EXISTS idx_student_infor_created_at ON public.student_infor(created_at DESC);

-- Tối ưu hóa hiệu năng truy vấn cho bảng spreadsheets
CREATE INDEX IF NOT EXISTS idx_spreadsheets_title ON public.spreadsheets(title);
CREATE INDEX IF NOT EXISTS idx_spreadsheets_created_at ON public.spreadsheets(created_at DESC);

-- Sử dụng extension pg_prewarm để tải trước (prewarm) dữ liệu và index vào RAM (Buffer Cache) của PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_prewarm;
SELECT pg_prewarm('public.student_infor');
SELECT pg_prewarm('public.spreadsheets');
