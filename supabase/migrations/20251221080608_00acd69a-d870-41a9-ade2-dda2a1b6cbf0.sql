-- Add Säljkonsult (sales consultant) fields to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS is_sales_consultant boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_model text DEFAULT 'fixed', -- 'fixed' or 'above_cost'
ADD COLUMN IF NOT EXISTS company_markup_share numeric DEFAULT 70, -- ProffsKontakts andel av påslag
ADD COLUMN IF NOT EXISTS base_cost_for_billing numeric DEFAULT 23000, -- Base cost for "Allt över" model
ADD COLUMN IF NOT EXISTS eur_to_sek_rate numeric DEFAULT 11, -- EUR to SEK exchange rate
ADD COLUMN IF NOT EXISTS lf_finans_percent numeric DEFAULT 3, -- LF Finans financing percentage
ADD COLUMN IF NOT EXISTS default_customer_price numeric DEFAULT 78000; -- Default customer price inc VAT

-- Create cost segments/centers table for organizations
CREATE TABLE IF NOT EXISTS public.organization_cost_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  is_eur boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_cost_segments ENABLE ROW LEVEL SECURITY;

-- RLS policies for cost segments
CREATE POLICY "Admins can manage organization cost segments"
ON public.organization_cost_segments
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authenticated users can view organization cost segments"
ON public.organization_cost_segments
FOR SELECT
USING (true);

-- Update trigger for cost segments
CREATE TRIGGER update_organization_cost_segments_updated_at
BEFORE UPDATE ON public.organization_cost_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Remove company_markup_share from profiles (moving to organizations)
-- We keep the column for now for backwards compatibility but mark as deprecated
COMMENT ON COLUMN public.profiles.closer_company_markup_share IS 'DEPRECATED: Use organizations.company_markup_share instead for Säljkonsult organizations';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_organization_cost_segments_org_id 
ON public.organization_cost_segments(organization_id);