-- Migration: Thêm cột phone vào bảng profiles
-- Chạy script này trên Supabase SQL Editor

-- 1. Thêm cột phone (nếu chưa có)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- 2. Cập nhật trigger handle_new_user để bao gồm phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'free',
    COALESCE(new.raw_user_meta_data->>'phone', NULL)
  );

  INSERT INTO public.ui_settings (user_id, theme_mode, primary_color)
  VALUES (new.id, 'system', 'indigo')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
