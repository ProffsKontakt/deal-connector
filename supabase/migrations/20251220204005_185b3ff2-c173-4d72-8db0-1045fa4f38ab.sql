-- Add new opener commission fields
-- opener_commission_per_deal is now the BONUS when their lead results in a sale (default 1000)
-- We need a new field for per-lead commission (default 200)

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS opener_commission_per_lead numeric DEFAULT 200;

-- Add closer commission settings
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS closer_base_commission numeric DEFAULT 8000,
ADD COLUMN IF NOT EXISTS closer_markup_percentage numeric DEFAULT 40,
ADD COLUMN IF NOT EXISTS closer_company_markup_share numeric DEFAULT 70;

-- Add employer cost settings table for salary calculations
CREATE TABLE IF NOT EXISTS public.employer_cost_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  percentage numeric NOT NULL DEFAULT 31.42,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employer_cost_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage employer cost settings
CREATE POLICY "Admins can manage employer cost settings"
ON public.employer_cost_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- All authenticated users can view employer cost settings
CREATE POLICY "Authenticated users can view employer cost settings"
ON public.employer_cost_settings
FOR SELECT
USING (true);

-- Insert default Swedish employer costs (arbetsgivaravgifter)
INSERT INTO public.employer_cost_settings (name, percentage, description)
VALUES 
  ('Arbetsgivaravgift', 31.42, 'Standard arbetsgivaravgift för anställda'),
  ('Semesterersättning', 12.00, 'Semesterersättning (12% för timavlönade)')
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_employer_cost_settings_updated_at
  BEFORE UPDATE ON public.employer_cost_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();