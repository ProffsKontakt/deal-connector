-- Create table to track organization status history
CREATE TABLE public.organization_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  effective_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for efficient queries
CREATE INDEX idx_org_status_history_org_id ON public.organization_status_history(organization_id);
CREATE INDEX idx_org_status_history_dates ON public.organization_status_history(effective_from, effective_until);

-- Enable RLS
ALTER TABLE public.organization_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage status history" ON public.organization_status_history
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Teamleaders view status history" ON public.organization_status_history
  FOR SELECT USING (has_role(auth.uid(), 'teamleader'::user_role));

-- Insert initial status history for all existing organizations
INSERT INTO public.organization_status_history (organization_id, status, effective_from)
SELECT id, status::text, created_at
FROM public.organizations;

-- Create function to automatically track status changes
CREATE OR REPLACE FUNCTION public.track_organization_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Close the previous status period
    UPDATE public.organization_status_history
    SET effective_until = now()
    WHERE organization_id = NEW.id
      AND effective_until IS NULL;
    
    -- Insert new status period
    INSERT INTO public.organization_status_history (organization_id, status, effective_from, created_by)
    VALUES (NEW.id, NEW.status::text, now(), auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for status changes
CREATE TRIGGER track_org_status_change
  AFTER UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.track_organization_status_change();

-- Create trigger for new organizations
CREATE OR REPLACE FUNCTION public.init_organization_status_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_status_history (organization_id, status, effective_from, created_by)
  VALUES (NEW.id, NEW.status::text, now(), auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER init_org_status_history
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.init_organization_status_history();