-- Migration: Create pricing_content table for contact instructions and steps
CREATE TABLE IF NOT EXISTS public.pricing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  text text NOT NULL,
  links jsonb DEFAULT '[]'::jsonb, -- Store list of link objects: [{"linkText": "...", "linkUrl": "..."}]
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "allow_public_read_pricing_content" ON public.pricing_content;
DROP POLICY IF EXISTS "admin_all_pricing_content" ON public.pricing_content;

-- Policies
CREATE POLICY "allow_public_read_pricing_content" ON public.pricing_content
  FOR SELECT USING (true);

CREATE POLICY "admin_all_pricing_content" ON public.pricing_content
  FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS pricing_content_set_updated_at ON public.pricing_content;
CREATE TRIGGER pricing_content_set_updated_at BEFORE UPDATE ON public.pricing_content FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
