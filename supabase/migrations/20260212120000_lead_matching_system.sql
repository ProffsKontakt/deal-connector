-- ============================================================================
-- Lead Matching System
-- Ersätter Google Sheets-baserad PartnerRouting + PartnerRoundRobin
-- med en databasbaserad lösning som stödjer 7+ säljare per partner
-- ============================================================================

-- Lägg till external_partner_id på organizations så n8n/webhooks kan referera
-- till partnern med sitt externa ID (t.ex. Pipedrive-id)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS external_partner_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_external_partner_id
  ON public.organizations(external_partner_id)
  WHERE external_partner_id IS NOT NULL;

-- ============================================================================
-- 1. lead_routing_rules — ersätter PartnerRouting-arket
--    En rad per säljare per partner/pipeline-kombination
-- ============================================================================
CREATE TABLE public.lead_routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_name TEXT,
  pipeline_id INTEGER,
  stage_name TEXT,
  stage_id INTEGER,
  owner_user_name TEXT NOT NULL,
  owner_user_id INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  -- Kommaseparerad lista eller 'ALL'. T.ex. 'Batteri, Solceller'
  lead_types TEXT DEFAULT 'ALL',
  -- Lägre nummer = högre prioritet. Samma prioritet = jämn fördelning
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routing_rules_org_active
  ON public.lead_routing_rules(organization_id, active);

-- ============================================================================
-- 2. lead_routing_state — en rad per säljare per partner
--    Håller koll på NÄR varje säljare senast fick ett lead
--    Detta ersätter den enkla "last_user_name"-lösningen
-- ============================================================================
CREATE TABLE public.lead_routing_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_name TEXT NOT NULL,
  total_assigned INTEGER NOT NULL DEFAULT 0,
  last_assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, owner_user_name)
);

-- ============================================================================
-- 3. lead_assignment_log — fullständig historik
--    Gör det möjligt att se vem som fått vilka leads och när
-- ============================================================================
CREATE TABLE public.lead_assignment_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  routing_rule_id UUID REFERENCES public.lead_routing_rules(id) ON DELETE SET NULL,
  owner_user_name TEXT NOT NULL,
  owner_user_id INTEGER,
  lead_type TEXT NOT NULL,
  lead_type_for_routing TEXT NOT NULL,
  -- Valfri extra data om leadet (kontakt-info, webhook-data etc.)
  lead_reference JSONB,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignment_log_org_date
  ON public.lead_assignment_log(organization_id, assigned_at DESC);

CREATE INDEX idx_assignment_log_user_date
  ON public.lead_assignment_log(owner_user_name, assigned_at DESC);

-- ============================================================================
-- Update triggers
-- ============================================================================
CREATE TRIGGER update_lead_routing_rules_updated_at
  BEFORE UPDATE ON public.lead_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_routing_state_updated_at
  BEFORE UPDATE ON public.lead_routing_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS policies
-- ============================================================================
ALTER TABLE public.lead_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_routing_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_log ENABLE ROW LEVEL SECURITY;

-- Routing rules: alla autentiserade kan läsa, admins kan ändra
CREATE POLICY "Authenticated can view routing rules"
  ON public.lead_routing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage routing rules"
  ON public.lead_routing_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Routing state: alla autentiserade kan läsa, systemet uppdaterar via service role
CREATE POLICY "Authenticated can view routing state"
  ON public.lead_routing_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage routing state"
  ON public.lead_routing_state FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Assignment log: alla autentiserade kan läsa, systemet skriver via service role
CREATE POLICY "Authenticated can view assignment log"
  ON public.lead_assignment_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage assignment log"
  ON public.lead_assignment_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 4. match_lead_to_salesperson — atomisk matchningsfunktion
--
-- ALGORITM: Timestamp-baserad Priority Round Robin
--
-- 1. Filtrera aktiva routing-regler för (organization, lead_type)
-- 2. Säkerställ att varje säljare har en state-rad (upsert)
-- 3. Lås state-raderna (FOR UPDATE) för att undvika race conditions
-- 4. Sortera efter:
--    a) priority ASC (lägre = högre prioritet)
--    b) last_assigned_at ASC NULLS FIRST (aldrig tilldelad = först)
--    c) owner_user_name ASC (deterministic tiebreaker)
-- 5. Välj den första
-- 6. Uppdatera state + logga tilldelningen
-- 7. Returnera vald säljare
--
-- Med 7 säljare på samma prioritet:
--   Lead 1 → Alla har NULL timestamp → väljer alfabetiskt första
--   Lead 2 → Person 1 har timestamp, resten NULL → väljer nästa
--   Lead 7 → Alla har timestamps → väljer den med äldst timestamp
--   Lead 8 → Cykeln börjar om naturligt
--
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_lead_to_salesperson(
  p_organization_id UUID,
  p_lead_type TEXT,
  p_lead_reference JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_type_for_routing TEXT;
  v_selected RECORD;
  v_result JSONB;
BEGIN
  -- ── Normalisera lead-typ ──
  v_lead_type_for_routing := TRIM(p_lead_type);
  IF v_lead_type_for_routing = 'Solceller & Batteri' THEN
    v_lead_type_for_routing := 'Batteri';
  END IF;

  -- ── Säkerställ state-rader för alla eligible säljare ──
  INSERT INTO lead_routing_state (organization_id, owner_user_name)
  SELECT r.organization_id, r.owner_user_name
  FROM lead_routing_rules r
  WHERE r.organization_id = p_organization_id
    AND r.active = true
    AND (
      r.lead_types IS NULL
      OR UPPER(TRIM(r.lead_types)) = 'ALL'
      OR TRIM(r.lead_types) = ''
      OR EXISTS (
        SELECT 1
        FROM unnest(string_to_array(r.lead_types, ',')) AS t(val)
        WHERE TRIM(t.val) = v_lead_type_for_routing
      )
    )
  ON CONFLICT (organization_id, owner_user_name) DO NOTHING;

  -- ── Välj bästa säljare med radlås ──
  SELECT
    r.id AS rule_id,
    r.organization_id,
    r.pipeline_name,
    r.pipeline_id,
    r.stage_name,
    r.stage_id,
    r.owner_user_name,
    r.owner_user_id,
    r.priority,
    s.last_assigned_at,
    s.total_assigned
  INTO v_selected
  FROM lead_routing_rules r
  JOIN lead_routing_state s
    ON s.organization_id = r.organization_id
    AND s.owner_user_name = r.owner_user_name
  WHERE r.organization_id = p_organization_id
    AND r.active = true
    AND (
      r.lead_types IS NULL
      OR UPPER(TRIM(r.lead_types)) = 'ALL'
      OR TRIM(r.lead_types) = ''
      OR EXISTS (
        SELECT 1
        FROM unnest(string_to_array(r.lead_types, ',')) AS t(val)
        WHERE TRIM(t.val) = v_lead_type_for_routing
      )
    )
  ORDER BY
    r.priority ASC,
    s.last_assigned_at ASC NULLS FIRST,
    r.owner_user_name ASC
  LIMIT 1
  FOR UPDATE OF s;  -- Lås state-raden för att undvika race conditions

  -- ── Kolla om vi hittade någon ──
  IF v_selected IS NULL THEN
    -- Ge debug-info
    RAISE EXCEPTION 'Ingen aktiv routingrad för organization_id=% och lead_typ=%. '
      'Kontrollera att det finns aktiva regler med matchande lead_types.',
      p_organization_id, v_lead_type_for_routing;
  END IF;

  -- ── Uppdatera state ──
  UPDATE lead_routing_state
  SET
    total_assigned = total_assigned + 1,
    last_assigned_at = now()
  WHERE organization_id = v_selected.organization_id
    AND owner_user_name = v_selected.owner_user_name;

  -- ── Logga tilldelningen ──
  INSERT INTO lead_assignment_log (
    organization_id,
    routing_rule_id,
    owner_user_name,
    owner_user_id,
    lead_type,
    lead_type_for_routing,
    lead_reference
  )
  VALUES (
    v_selected.organization_id,
    v_selected.rule_id,
    v_selected.owner_user_name,
    v_selected.owner_user_id,
    p_lead_type,
    v_lead_type_for_routing,
    p_lead_reference
  );

  -- ── Bygg resultat (kompatibelt med n8n-formatet) ──
  v_result := jsonb_build_object(
    'selected_routing_rule_id', v_selected.rule_id,
    'selected_pipeline_id', v_selected.pipeline_id,
    'selected_pipeline_name', v_selected.pipeline_name,
    'selected_stage_id', v_selected.stage_id,
    'selected_stage_name', v_selected.stage_name,
    'selected_owner_user_id', v_selected.owner_user_id,
    'selected_owner_user_name', v_selected.owner_user_name,
    'lead_typ', p_lead_type,
    'lead_type_for_routing', v_lead_type_for_routing,
    'next_last_user_name', v_selected.owner_user_name
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 5. Hjälpvy: aktuell tilldelningsöversikt per partner
--    Visar alla säljare, deras senaste tilldelning och totalt antal
-- ============================================================================
CREATE OR REPLACE VIEW public.lead_routing_overview AS
SELECT
  o.name AS organization_name,
  r.owner_user_name,
  r.priority,
  r.lead_types,
  r.active,
  r.pipeline_name,
  r.stage_name,
  s.total_assigned,
  s.last_assigned_at,
  r.organization_id
FROM lead_routing_rules r
LEFT JOIN lead_routing_state s
  ON s.organization_id = r.organization_id
  AND s.owner_user_name = r.owner_user_name
JOIN organizations o
  ON o.id = r.organization_id
ORDER BY
  o.name,
  r.priority ASC,
  s.last_assigned_at ASC NULLS FIRST;
