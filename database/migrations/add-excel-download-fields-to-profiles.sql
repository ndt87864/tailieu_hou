-- Migration: Add Excel download permission and percentage fields to public.profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_excel_enabled boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS excel_percentage integer DEFAULT 100;
