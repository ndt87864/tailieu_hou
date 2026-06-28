-- Migration: Create premium_user table for granular document/category access control
CREATE TABLE IF NOT EXISTS public.premium_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Prevent duplicates
  CONSTRAINT unique_profile_document UNIQUE (profile_id, document_id),
  CONSTRAINT unique_profile_category UNIQUE (profile_id, category_id)
);

-- Enable RLS
ALTER TABLE public.premium_user ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "admin_all_premium_user" ON public.premium_user;
DROP POLICY IF EXISTS "user_read_own_premium_user" ON public.premium_user;

-- Policies
CREATE POLICY "admin_all_premium_user" ON public.premium_user
  FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'management'));

CREATE POLICY "user_read_own_premium_user" ON public.premium_user
  FOR SELECT USING (profile_id = auth.uid());

-- Trigger for updated_at
DROP TRIGGER IF EXISTS premium_user_set_updated_at ON public.premium_user;
CREATE TRIGGER premium_user_set_updated_at BEFORE UPDATE ON public.premium_user FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
