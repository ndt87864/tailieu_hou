-- Migration: Create question_ratios table to configure dynamic question limits per role
CREATE TABLE IF NOT EXISTS public.question_ratios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE, -- 'free', 'plus', 'pro'
  ratio_percent integer NOT NULL DEFAULT 100 CHECK (ratio_percent >= 0 AND ratio_percent <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.question_ratios ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "allow_public_read_question_ratios" ON public.question_ratios;
DROP POLICY IF EXISTS "admin_all_question_ratios" ON public.question_ratios;

-- Policies
CREATE POLICY "allow_public_read_question_ratios" ON public.question_ratios
  FOR SELECT USING (true);

CREATE POLICY "admin_all_question_ratios" ON public.question_ratios
  FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS question_ratios_set_updated_at ON public.question_ratios;
CREATE TRIGGER question_ratios_set_updated_at BEFORE UPDATE ON public.question_ratios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Insert default values if not exists
INSERT INTO public.question_ratios (role, ratio_percent) VALUES
  ('free', 20),
  ('plus', 50),
  ('pro', 70)
ON CONFLICT (role) DO NOTHING;
