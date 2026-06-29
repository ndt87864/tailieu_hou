-- Migration: Add excel_ratio_unpaid and excel_ratio_paid to question_ratios table
ALTER TABLE public.question_ratios 
ADD COLUMN IF NOT EXISTS excel_ratio_unpaid integer NOT NULL DEFAULT 100 CHECK (excel_ratio_unpaid >= 0 AND excel_ratio_unpaid <= 100),
ADD COLUMN IF NOT EXISTS excel_ratio_paid integer NOT NULL DEFAULT 100 CHECK (excel_ratio_paid >= 0 AND excel_ratio_paid <= 100);

-- Update default values for existing roles
UPDATE public.question_ratios SET excel_ratio_unpaid = 0, excel_ratio_paid = 0 WHERE role = 'free';
UPDATE public.question_ratios SET excel_ratio_unpaid = 50, excel_ratio_paid = 100 WHERE role = 'plus';
UPDATE public.question_ratios SET excel_ratio_unpaid = 100, excel_ratio_paid = 100 WHERE role = 'pro';
