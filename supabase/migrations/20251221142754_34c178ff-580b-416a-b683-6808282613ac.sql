-- Add field to allow manual calculation parameters per organization
ALTER TABLE public.organizations 
ADD COLUMN allow_manual_calculation BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.organizations.allow_manual_calculation IS 'When true, closers can manually input calculation parameters in their deal cards instead of using organization defaults';