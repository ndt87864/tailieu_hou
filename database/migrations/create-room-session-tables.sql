-- =============================================================
-- MIGRATION: CREATE TABLES FOR EXAM_SESSIONS
-- =============================================================

-- Ensure helper functions exist
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text AS $$
DECLARE
  u_role text;
BEGIN
  SELECT role::text INTO u_role FROM public.profiles WHERE id = user_id;
  RETURN COALESCE(u_role, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Table: exam_sessions
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  "startTime" text,
  "endTime" text,
  "examDate" date,
  "examType" text DEFAULT 'Onsite',
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_composite ON public.exam_sessions ("examDate", "startTime");

-- Enable RLS
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for exam_sessions
DROP POLICY IF EXISTS "select_exam_sessions_all" ON public.exam_sessions;
CREATE POLICY "select_exam_sessions_all" ON public.exam_sessions 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_all_exam_sessions" ON public.exam_sessions;
CREATE POLICY "admin_all_exam_sessions" ON public.exam_sessions 
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'management'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS exam_sessions_set_updated_at ON public.exam_sessions;
CREATE TRIGGER exam_sessions_set_updated_at BEFORE UPDATE ON public.exam_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
