-- =============================================================
-- SQL SETUP CHO LMS CRAWLER THỬ NGHIỆM ĐỘC LẬP
-- =============================================================

-- 1. Tạo bảng crawler_courses
CREATE TABLE IF NOT EXISTS public.crawler_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  moodle_course_id text,
  title text NOT NULL,
  url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bật RLS
ALTER TABLE public.crawler_courses ENABLE ROW LEVEL SECURITY;

-- 2. Tạo bảng crawler_resources
CREATE TABLE IF NOT EXISTS public.crawler_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.crawler_courses(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'file', 'youtube', 'announcement'
  title text NOT NULL,
  content_url text, -- link youtube hoặc link file đã tải lên storage
  raw_content text, -- nội dung thông báo
  week_name text,
  created_at timestamptz DEFAULT now()
);

-- Bật RLS
ALTER TABLE public.crawler_resources ENABLE ROW LEVEL SECURITY;

-- 3. Tạo bảng crawler_questions
CREATE TABLE IF NOT EXISTS public.crawler_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.crawler_courses(id) ON DELETE CASCADE,
  week_name text,
  question text NOT NULL,
  choices jsonb DEFAULT '[]'::jsonb,
  answer text DEFAULT '',
  url_question text,
  url_answer text,
  url_choices text,
  order_index integer,
  created_at timestamptz DEFAULT now()
);

-- Bật RLS
ALTER TABLE public.crawler_questions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Allow public select crawler_courses" ON public.crawler_courses;
CREATE POLICY "Allow public select crawler_courses" ON public.crawler_courses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin all crawler_courses" ON public.crawler_courses;
CREATE POLICY "Allow admin all crawler_courses" ON public.crawler_courses FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Allow public select crawler_resources" ON public.crawler_resources;
CREATE POLICY "Allow public select crawler_resources" ON public.crawler_resources FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin all crawler_resources" ON public.crawler_resources;
CREATE POLICY "Allow admin all crawler_resources" ON public.crawler_resources FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Allow public select crawler_questions" ON public.crawler_questions;
CREATE POLICY "Allow public select crawler_questions" ON public.crawler_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin all crawler_questions" ON public.crawler_questions;
CREATE POLICY "Allow admin all crawler_questions" ON public.crawler_questions FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- 5. Đăng ký Storage Bucket mới
INSERT INTO storage.buckets (id, name, public)
VALUES ('lms-crawler-assets', 'lms-crawler-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policies cho Storage
DROP POLICY IF EXISTS "Allow public select from lms-crawler-assets" ON storage.objects;
CREATE POLICY "Allow public select from lms-crawler-assets" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'lms-crawler-assets');

DROP POLICY IF EXISTS "Allow admin full access to lms-crawler-assets" ON storage.objects;
CREATE POLICY "Allow admin full access to lms-crawler-assets" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'lms-crawler-assets'
    AND public.get_user_role(auth.uid()) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'lms-crawler-assets'
    AND public.get_user_role(auth.uid()) = 'admin'
  );
