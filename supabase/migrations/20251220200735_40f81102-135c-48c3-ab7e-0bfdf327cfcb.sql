-- Add provision settings columns to profiles for openers
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS opener_commission_per_deal numeric DEFAULT 1000;

-- Create closer_commission_types table for different sales types
CREATE TABLE IF NOT EXISTS public.closer_commission_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  commission_amount numeric NOT NULL DEFAULT 8000,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.closer_commission_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage closer commission types"
ON public.closer_commission_types
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Closers can view their own commission types"
ON public.closer_commission_types
FOR SELECT
USING (closer_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_closer_commission_types_updated_at
BEFORE UPDATE ON public.closer_commission_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();