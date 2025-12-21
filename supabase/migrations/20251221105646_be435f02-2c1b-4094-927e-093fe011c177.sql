-- Create organization_regions table to track which regions each partner operates in
CREATE TABLE public.organization_regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, region_id)
);

-- Enable RLS
ALTER TABLE public.organization_regions ENABLE ROW LEVEL SECURITY;

-- Admins can manage organization regions
CREATE POLICY "Admins can manage organization regions"
ON public.organization_regions
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Authenticated users can view organization regions
CREATE POLICY "Authenticated users can view organization regions"
ON public.organization_regions
FOR SELECT
USING (true);