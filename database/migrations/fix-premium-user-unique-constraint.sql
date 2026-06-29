-- Migration: Fix premium_user table unique constraints to allow plus users to unlock multiple documents in the same category
ALTER TABLE public.premium_user DROP CONSTRAINT IF EXISTS unique_profile_category;

-- Create unique index only for category unlocks (when document_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_category_null_doc 
ON public.premium_user (profile_id, category_id) 
WHERE document_id IS NULL;
