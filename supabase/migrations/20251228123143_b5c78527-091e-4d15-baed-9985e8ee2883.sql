-- Add credit_deadline_days column to organizations
ALTER TABLE public.organizations
ADD COLUMN credit_deadline_days integer DEFAULT 14;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.credit_deadline_days IS 'Number of days within which a partner can return a lead for credit';