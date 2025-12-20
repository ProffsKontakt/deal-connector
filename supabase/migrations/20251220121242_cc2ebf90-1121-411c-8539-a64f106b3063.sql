-- Add 'closer' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'closer';

-- Create regions table with postal code prefixes
CREATE TABLE public.regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  postal_prefixes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on regions
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- RLS policies for regions
CREATE POLICY "Admins can manage regions"
  ON public.regions FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authenticated users can view regions"
  ON public.regions FOR SELECT
  USING (true);

-- Create closer_regions junction table (which closers cover which regions)
CREATE TABLE public.closer_regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(closer_id, region_id, organization_id)
);

-- Enable RLS on closer_regions
ALTER TABLE public.closer_regions ENABLE ROW LEVEL SECURITY;

-- RLS policies for closer_regions
CREATE POLICY "Admins can manage closer regions"
  ON public.closer_regions FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Closers can view their own regions"
  ON public.closer_regions FOR SELECT
  USING (closer_id = auth.uid());

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'battery',
  capacity_kwh NUMERIC,
  base_price_incl_moms NUMERIC NOT NULL,
  material_cost_eur NUMERIC NOT NULL,
  green_tech_deduction_percent NUMERIC NOT NULL DEFAULT 48.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS policies for products
CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  USING (true);

-- Insert default Emaldo battery product
INSERT INTO public.products (name, type, capacity_kwh, base_price_incl_moms, material_cost_eur, green_tech_deduction_percent)
VALUES ('Emaldo 15.36 kWh', 'battery', 15.36, 78000, 6150, 48.5);

-- Create sales table for tracking closer deals through pipeline
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  closer_id UUID NOT NULL REFERENCES public.profiles(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  product_id UUID REFERENCES public.products(id),
  
  -- Pipeline status
  pipeline_status TEXT NOT NULL DEFAULT 'new' CHECK (pipeline_status IN ('new', 'contacted', 'meeting_booked', 'offer_sent', 'negotiation', 'closed_won', 'closed_lost')),
  
  -- Pricing fields
  price_to_customer_incl_moms NUMERIC,
  discount_amount NUMERIC DEFAULT 0,
  num_property_owners INTEGER DEFAULT 1,
  full_green_deduction BOOLEAN DEFAULT true,
  
  -- Calculated fields (stored for reporting)
  total_order_value NUMERIC,
  invoiceable_amount NUMERIC,
  closer_commission NUMERIC,
  opener_commission NUMERIC DEFAULT 1000,
  
  -- Notes (only visible to closers/admin)
  closer_notes TEXT,
  offer_details TEXT,
  
  -- Partner visible notes
  partner_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales
CREATE POLICY "Admins can manage all sales"
  ON public.sales FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Teamleaders can view all sales"
  ON public.sales FOR SELECT
  USING (has_role(auth.uid(), 'teamleader'::user_role));

CREATE POLICY "Closers can manage their own sales"
  ON public.sales FOR ALL
  USING (closer_id = auth.uid());

CREATE POLICY "Organizations can view their sales partner notes only"
  ON public.sales FOR SELECT
  USING (
    has_role(auth.uid(), 'organization'::user_role) 
    AND organization_id = get_user_organization(auth.uid())
  );

-- Add region_id to contacts for automatic assignment based on postal code
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id);
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Create organization commission settings table
CREATE TABLE public.organization_commission_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  base_cost NUMERIC NOT NULL DEFAULT 23000,
  eur_to_sek_rate NUMERIC NOT NULL DEFAULT 11,
  lf_finans_percent NUMERIC NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_commission_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage commission settings"
  ON public.organization_commission_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Organizations can view their own settings"
  ON public.organization_commission_settings FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

-- Insert default regions
INSERT INTO public.regions (name, postal_prefixes) VALUES
  ('Västkusten', ARRAY['40', '41', '42', '43', '44', '45', '46', '47']),
  ('Skåne', ARRAY['20', '21', '22', '23', '24', '25', '26', '27', '28', '29']),
  ('Mälardalen', ARRAY['10', '11', '12', '13', '14', '15', '16', '17', '18', '19']);

-- Create function to get region by postal code
CREATE OR REPLACE FUNCTION public.get_region_by_postal_code(postal TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.regions 
  WHERE LEFT(postal, 2) = ANY(postal_prefixes)
  LIMIT 1
$$;

-- Update updated_at trigger for new tables
CREATE TRIGGER update_regions_updated_at
  BEFORE UPDATE ON public.regions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_commission_updated_at
  BEFORE UPDATE ON public.organization_commission_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();