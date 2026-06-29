-- =============================================================
-- SUPABASE STORAGE BUCKET AND RLS POLICIES SETUP
-- =============================================================

-- 1. Create the public bucket 'tailieuhou' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('tailieuhou', 'tailieuhou', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Clean up existing policies for the 'tailieuhou' bucket to prevent conflicts
DROP POLICY IF EXISTS "Allow public select from tailieuhou" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload to tailieuhou" ON storage.objects;
DROP POLICY IF EXISTS "Allow admin full access to tailieuhou" ON storage.objects;

-- 3. Create SELECT policy (Allow everyone to view files in the public bucket)
CREATE POLICY "Allow public select from tailieuhou" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'tailieuhou');

-- 4. Create INSERT policy (Allow public/anonymous visitors to upload proof of payment files to 'bills/' folder)
CREATE POLICY "Allow public upload to tailieuhou" ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'tailieuhou'
    AND (position('bills/' in name) = 1)
  );

-- 5. Create ALL policies for admins (Full access to manage files in the bucket)
CREATE POLICY "Allow admin full access to tailieuhou" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'tailieuhou'
    AND public.get_user_role(auth.uid()) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'tailieuhou'
    AND public.get_user_role(auth.uid()) = 'admin'
  );
