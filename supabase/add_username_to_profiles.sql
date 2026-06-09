-- Add username support to the existing public.profiles table.
-- Supabase Auth still signs in with email/password; the app resolves
-- username -> email from public.profiles before calling Auth.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

UPDATE public.profiles
SET username = lower(split_part(email, '@', 1))
WHERE username IS NULL
  AND email IS NOT NULL;

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
