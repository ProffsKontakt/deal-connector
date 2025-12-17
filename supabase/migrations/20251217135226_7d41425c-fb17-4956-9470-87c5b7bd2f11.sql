-- Create enum for organization status
CREATE TYPE public.organization_status AS ENUM ('active', 'archived');

-- Add new columns to organizations table
ALTER TABLE public.organizations
ADD COLUMN contact_person_name text,
ADD COLUMN contact_phone text,
ADD COLUMN price_per_site_visit numeric,
ADD COLUMN status organization_status NOT NULL DEFAULT 'active';

-- Add index for status filtering
CREATE INDEX idx_organizations_status ON public.organizations(status);