-- =============================================================
-- MIGRATION: CREATE TABLES FOR EXAM SCHEDULE & PROXY REGISTRATION
-- =============================================================

-- 1. Table: subject_prices
CREATE TABLE IF NOT EXISTS public.subject_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL UNIQUE,
  price numeric NOT NULL DEFAULT 100000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subject_prices ENABLE ROW LEVEL SECURITY;

-- Policies for subject_prices
DROP POLICY IF EXISTS "select_subject_prices_all" ON public.subject_prices;
CREATE POLICY "select_subject_prices_all" ON public.subject_prices 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_all_subject_prices" ON public.subject_prices;
CREATE POLICY "admin_all_subject_prices" ON public.subject_prices 
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Trigger for updated_at
DROP TRIGGER IF EXISTS subject_prices_set_updated_at ON public.subject_prices;
CREATE TRIGGER subject_prices_set_updated_at BEFORE UPDATE ON public.subject_prices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. Table: proxy_registrations
CREATE TABLE IF NOT EXISTS public.proxy_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL UNIQUE,
  selected_ids text,
  bill_url text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proxy_registrations ENABLE ROW LEVEL SECURITY;

-- Policies for proxy_registrations
DROP POLICY IF EXISTS "select_proxy_registrations_all" ON public.proxy_registrations;
CREATE POLICY "select_proxy_registrations_all" ON public.proxy_registrations 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_all_proxy_registrations" ON public.proxy_registrations;
CREATE POLICY "admin_all_proxy_registrations" ON public.proxy_registrations 
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Trigger for updated_at
DROP TRIGGER IF EXISTS proxy_registrations_set_updated_at ON public.proxy_registrations;
CREATE TRIGGER proxy_registrations_set_updated_at BEFORE UPDATE ON public.proxy_registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3. Table: registration_queue
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

-- Enable RLS
ALTER TABLE public.registration_queue ENABLE ROW LEVEL SECURITY;

-- Policies for registration_queue
DROP POLICY IF EXISTS "select_registration_queue_all" ON public.registration_queue;
CREATE POLICY "select_registration_queue_all" ON public.registration_queue 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_registration_queue_all" ON public.registration_queue;
CREATE POLICY "insert_registration_queue_all" ON public.registration_queue 
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_registration_queue" ON public.registration_queue;
CREATE POLICY "admin_all_registration_queue" ON public.registration_queue 
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Trigger for updated_at
DROP TRIGGER IF EXISTS registration_queue_set_updated_at ON public.registration_queue;
CREATE TRIGGER registration_queue_set_updated_at BEFORE UPDATE ON public.registration_queue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
