-- Create table to track historical partner pricing with timestamps
CREATE TABLE public.organization_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  price_per_solar_deal NUMERIC,
  price_per_battery_deal NUMERIC,
  price_per_site_visit NUMERIC,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  effective_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.organization_price_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage organization price history" 
ON public.organization_price_history 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authenticated users can view organization price history" 
ON public.organization_price_history 
FOR SELECT 
USING (true);

-- Create index for efficient lookups
CREATE INDEX idx_org_price_history_org_id ON public.organization_price_history(organization_id);
CREATE INDEX idx_org_price_history_effective_from ON public.organization_price_history(effective_from);

-- Function to capture price changes
CREATE OR REPLACE FUNCTION public.capture_organization_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Close out any existing active price record
  UPDATE public.organization_price_history
  SET effective_until = now()
  WHERE organization_id = NEW.id 
    AND effective_until IS NULL;
  
  -- Insert new price record
  INSERT INTO public.organization_price_history (
    organization_id,
    price_per_solar_deal,
    price_per_battery_deal,
    price_per_site_visit,
    effective_from,
    created_by
  ) VALUES (
    NEW.id,
    NEW.price_per_solar_deal,
    NEW.price_per_battery_deal,
    NEW.price_per_site_visit,
    now(),
    auth.uid()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for price changes on organizations
CREATE TRIGGER trigger_capture_price_change
AFTER INSERT OR UPDATE OF price_per_solar_deal, price_per_battery_deal, price_per_site_visit
ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.capture_organization_price_change();

-- Backfill existing organizations with their current prices
INSERT INTO public.organization_price_history (
  organization_id,
  price_per_solar_deal,
  price_per_battery_deal,
  price_per_site_visit,
  effective_from
)
SELECT 
  id,
  price_per_solar_deal,
  price_per_battery_deal,
  price_per_site_visit,
  created_at
FROM public.organizations;