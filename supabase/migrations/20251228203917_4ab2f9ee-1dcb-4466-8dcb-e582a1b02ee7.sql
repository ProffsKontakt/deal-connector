-- Add employee-specific fields to profiles table for internal users (openers/closers)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS personal_number text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS account_number text,
ADD COLUMN IF NOT EXISTS employer_fee_percent numeric DEFAULT 31.42,
ADD COLUMN IF NOT EXISTS vacation_pay_percent numeric DEFAULT 12;

-- Add a user_type column to distinguish internal vs external users
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'internal' CHECK (user_type IN ('internal', 'external'));