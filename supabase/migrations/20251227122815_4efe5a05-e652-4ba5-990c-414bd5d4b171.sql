-- Enable PostGIS extension for geographic operations
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create organization coverage areas table to store WKT polygons
CREATE TABLE public.organization_coverage_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  coverage_polygon GEOMETRY(POLYGON, 4326) NOT NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('offert', 'salj')),
  region_id UUID REFERENCES public.regions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create spatial index for efficient geographic queries
CREATE INDEX idx_coverage_polygon ON public.organization_coverage_areas USING GIST(coverage_polygon);

-- Enable RLS
ALTER TABLE public.organization_coverage_areas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage organization coverage areas"
ON public.organization_coverage_areas
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Organizations can view their own coverage areas"
ON public.organization_coverage_areas
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Authenticated users can view coverage areas"
ON public.organization_coverage_areas
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_organization_coverage_areas_updated_at
BEFORE UPDATE ON public.organization_coverage_areas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-assign region_id to contacts based on postal_code
CREATE OR REPLACE FUNCTION public.auto_assign_region_on_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Only update if postal_code is provided and region_id is not already set
  IF NEW.postal_code IS NOT NULL AND NEW.region_id IS NULL THEN
    NEW.region_id := get_region_by_postal_code(NEW.postal_code);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign region on contact insert/update
CREATE TRIGGER auto_assign_region_on_contact_insert
BEFORE INSERT ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_region_on_contact();

CREATE TRIGGER auto_assign_region_on_contact_update
BEFORE UPDATE OF postal_code ON public.contacts
FOR EACH ROW
WHEN (OLD.postal_code IS DISTINCT FROM NEW.postal_code)
EXECUTE FUNCTION public.auto_assign_region_on_contact();

-- Update existing contacts that have postal_code but no region_id
UPDATE public.contacts
SET region_id = get_region_by_postal_code(postal_code)
WHERE postal_code IS NOT NULL AND region_id IS NULL;