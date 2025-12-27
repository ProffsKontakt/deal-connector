-- Add collaboration_start_date to organizations
ALTER TABLE public.organizations
ADD COLUMN collaboration_start_date timestamp with time zone;

-- Create organization_timeline_events table
CREATE TABLE public.organization_timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT,
  title TEXT NOT NULL,
  description TEXT,
  is_scheduled BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_timeline_events_org_date ON public.organization_timeline_events(organization_id, event_date);
CREATE INDEX idx_timeline_events_scheduled ON public.organization_timeline_events(is_scheduled, event_date) WHERE is_scheduled = true;

-- Enable RLS
ALTER TABLE public.organization_timeline_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for timeline events
CREATE POLICY "Admins can manage timeline events"
ON public.organization_timeline_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Teamleaders can view timeline events"
ON public.organization_timeline_events
FOR SELECT
USING (has_role(auth.uid(), 'teamleader'::user_role));

CREATE POLICY "Organizations can view own timeline events"
ON public.organization_timeline_events
FOR SELECT
USING (has_role(auth.uid(), 'organization'::user_role) AND organization_id = get_user_organization(auth.uid()));

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_record ON public.audit_log(record_id);
CREATE INDEX idx_audit_log_changed_at ON public.audit_log(changed_at DESC);
CREATE INDEX idx_audit_log_changed_by ON public.audit_log(changed_by);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_log
CREATE POLICY "Admins can view audit log"
ON public.audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can insert audit log"
ON public.audit_log
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_values, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for organizations table
CREATE TRIGGER audit_organizations
AFTER INSERT OR UPDATE OR DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Create triggers for organization_timeline_events table
CREATE TRIGGER audit_organization_timeline_events
AFTER INSERT OR UPDATE OR DELETE ON public.organization_timeline_events
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Create triggers for products table
CREATE TRIGGER audit_products
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Create triggers for organization_status_history table
CREATE TRIGGER audit_organization_status_history
AFTER INSERT OR UPDATE OR DELETE ON public.organization_status_history
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Create function to process scheduled timeline events
CREATE OR REPLACE FUNCTION public.process_scheduled_timeline_events()
RETURNS void AS $$
DECLARE
  event_record RECORD;
BEGIN
  -- Find all scheduled events that should now be active
  FOR event_record IN
    SELECT * FROM public.organization_timeline_events
    WHERE is_scheduled = true
    AND event_date <= now()
    AND event_type IN ('status_change', 'pause_scheduled', 'activation_scheduled')
  LOOP
    -- Update organization status based on event
    IF event_record.event_type = 'pause_scheduled' THEN
      UPDATE public.organizations SET status = 'archived', updated_at = now()
      WHERE id = event_record.organization_id;
    ELSIF event_record.event_type = 'activation_scheduled' THEN
      UPDATE public.organizations SET status = 'active', updated_at = now()
      WHERE id = event_record.organization_id;
    ELSIF event_record.event_type = 'status_change' AND event_record.status IS NOT NULL THEN
      UPDATE public.organizations SET status = event_record.status::organization_status, updated_at = now()
      WHERE id = event_record.organization_id;
    END IF;
    
    -- Mark event as no longer scheduled (it's now historical)
    UPDATE public.organization_timeline_events
    SET is_scheduled = false, updated_at = now()
    WHERE id = event_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for updated_at on timeline events
CREATE TRIGGER update_organization_timeline_events_updated_at
BEFORE UPDATE ON public.organization_timeline_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing status history to timeline events
INSERT INTO public.organization_timeline_events (organization_id, event_type, event_date, status, title, description, is_scheduled, created_by, created_at)
SELECT 
  organization_id,
  'status_change',
  effective_from,
  status,
  CASE 
    WHEN status = 'active' THEN 'Partner aktiverad'
    WHEN status = 'archived' THEN 'Partner pausad'
    ELSE 'Statusändring'
  END,
  NULL,
  false,
  created_by,
  created_at
FROM public.organization_status_history;

-- Set collaboration_start_date based on earliest status history
UPDATE public.organizations o
SET collaboration_start_date = (
  SELECT MIN(effective_from)
  FROM public.organization_status_history h
  WHERE h.organization_id = o.id
)
WHERE EXISTS (
  SELECT 1 FROM public.organization_status_history h WHERE h.organization_id = o.id
);