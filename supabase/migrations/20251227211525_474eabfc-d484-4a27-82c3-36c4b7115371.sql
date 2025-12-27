-- Add can_request_credits column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN can_request_credits BOOLEAN NOT NULL DEFAULT true;

-- Create organization_lead_quotas table for the "Kvoter" feature
CREATE TABLE public.organization_lead_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,
  quota_amount INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, period_type, period_start)
);

-- Enable RLS
ALTER TABLE public.organization_lead_quotas ENABLE ROW LEVEL SECURITY;

-- RLS policies for organization_lead_quotas
CREATE POLICY "Admins can manage lead quotas"
ON public.organization_lead_quotas
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teamleaders can view lead quotas"
ON public.organization_lead_quotas
FOR SELECT
USING (has_role(auth.uid(), 'teamleader'));

CREATE POLICY "Organizations can view own quotas"
ON public.organization_lead_quotas
FOR SELECT
USING (has_role(auth.uid(), 'organization') AND organization_id = get_user_organization(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_organization_lead_quotas_org_period 
ON public.organization_lead_quotas(organization_id, period_type, period_start);

-- Add audit trigger for organization_lead_quotas
CREATE TRIGGER audit_organization_lead_quotas
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_lead_quotas
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Add audit trigger for organizations (if not already exists)
DROP TRIGGER IF EXISTS audit_organizations ON public.organizations;
CREATE TRIGGER audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();