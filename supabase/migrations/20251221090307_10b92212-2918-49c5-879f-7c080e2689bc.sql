-- Create organization_product_provisions table for storing custom provisions per organization per product
CREATE TABLE public.organization_product_provisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  provision_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, product_id)
);

-- Enable RLS
ALTER TABLE public.organization_product_provisions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage organization product provisions"
  ON public.organization_product_provisions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authenticated users can view organization product provisions"
  ON public.organization_product_provisions
  FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_organization_product_provisions_updated_at
  BEFORE UPDATE ON public.organization_product_provisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add custom_product fields to sales table for lead-specific custom products
ALTER TABLE public.sales 
ADD COLUMN custom_product_name text,
ADD COLUMN custom_product_price numeric,
ADD COLUMN custom_product_material_cost_eur numeric;