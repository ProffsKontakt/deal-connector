-- Add sales_consultant_lead_type column to organizations table
-- This defines which lead types the sales consultant will sell on themselves
-- and should NOT be billed for those leads
ALTER TABLE public.organizations
ADD COLUMN sales_consultant_lead_type text DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN public.organizations.sales_consultant_lead_type IS 'Lead type that the sales consultant sells on themselves (sun, battery, sun_battery). Leads matching this type should not be billed to this organization.';