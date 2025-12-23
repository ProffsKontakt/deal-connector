-- =====================================================
-- AIR-TIGHT DATA ISOLATION: RLS POLICY UPDATES
-- =====================================================

-- =====================================================
-- 1. FIX contact_organizations TABLE
-- =====================================================
DROP POLICY IF EXISTS "View contact organizations" ON public.contact_organizations;

-- Admins and teamleaders can view all
CREATE POLICY "Admins and teamleaders view all contact_orgs"
ON public.contact_organizations FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'teamleader'::user_role));

-- Organizations only see their own
CREATE POLICY "Organizations view own contact_orgs"
ON public.contact_organizations FOR SELECT
USING (
  has_role(auth.uid(), 'organization'::user_role) 
  AND organization_id = get_user_organization(auth.uid())
);

-- Closers see contact_orgs for contacts they're assigned to via sales
CREATE POLICY "Closers view assigned contact_orgs"
ON public.contact_organizations FOR SELECT
USING (
  has_role(auth.uid(), 'closer'::user_role)
  AND EXISTS (
    SELECT 1 FROM public.sales 
    WHERE sales.contact_id = contact_organizations.contact_id 
    AND sales.closer_id = auth.uid()
  )
);

-- =====================================================
-- 2. FIX organizations TABLE
-- =====================================================
DROP POLICY IF EXISTS "Anyone authenticated can view organizations" ON public.organizations;

-- Admins and teamleaders can view all
CREATE POLICY "Admins and teamleaders view all orgs"
ON public.organizations FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'teamleader'::user_role));

-- Organizations only see their own
CREATE POLICY "Organizations view own org"
ON public.organizations FOR SELECT
USING (
  has_role(auth.uid(), 'organization'::user_role) 
  AND id = get_user_organization(auth.uid())
);

-- Closers view organizations they're assigned to work with
CREATE POLICY "Closers view assigned orgs"
ON public.organizations FOR SELECT
USING (
  has_role(auth.uid(), 'closer'::user_role)
  AND EXISTS (
    SELECT 1 FROM public.closer_regions 
    WHERE closer_regions.closer_id = auth.uid() 
    AND closer_regions.organization_id = organizations.id
  )
);

-- Openers can view organizations (needed for creating contacts)
CREATE POLICY "Openers view orgs"
ON public.organizations FOR SELECT
USING (has_role(auth.uid(), 'opener'::user_role));

-- =====================================================
-- 3. ADD CLOSER ACCESS TO contacts (for assigned leads)
-- =====================================================
CREATE POLICY "Closers view assigned contacts"
ON public.contacts FOR SELECT
USING (
  has_role(auth.uid(), 'closer'::user_role)
  AND EXISTS (
    SELECT 1 FROM public.sales 
    WHERE sales.contact_id = contacts.id 
    AND sales.closer_id = auth.uid()
  )
);

-- =====================================================
-- 4. RESTRICT organization_price_history
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view organization price history" ON public.organization_price_history;

-- Admins and teamleaders view all
CREATE POLICY "Admins and teamleaders view all price history"
ON public.organization_price_history FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'teamleader'::user_role));

-- Organizations only see their own
CREATE POLICY "Organizations view own price history"
ON public.organization_price_history FOR SELECT
USING (
  has_role(auth.uid(), 'organization'::user_role) 
  AND organization_id = get_user_organization(auth.uid())
);

-- =====================================================
-- 5. RESTRICT organization_product_provisions
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view organization product provisions" ON public.organization_product_provisions;

-- Admins and teamleaders view all
CREATE POLICY "Admins and teamleaders view all product provisions"
ON public.organization_product_provisions FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'teamleader'::user_role));

-- Organizations only see their own
CREATE POLICY "Organizations view own product provisions"
ON public.organization_product_provisions FOR SELECT
USING (
  has_role(auth.uid(), 'organization'::user_role) 
  AND organization_id = get_user_organization(auth.uid())
);

-- =====================================================
-- 6. RESTRICT organization_cost_segments
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view organization cost segments" ON public.organization_cost_segments;

-- Admins and teamleaders view all
CREATE POLICY "Admins and teamleaders view all cost segments"
ON public.organization_cost_segments FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'teamleader'::user_role));

-- Organizations only see their own
CREATE POLICY "Organizations view own cost segments"
ON public.organization_cost_segments FOR SELECT
USING (
  has_role(auth.uid(), 'organization'::user_role) 
  AND organization_id = get_user_organization(auth.uid())
);

-- =====================================================
-- 7. RESTRICT employer_cost_settings to admin only
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view employer cost settings" ON public.employer_cost_settings;

-- Only admins can view employer cost settings
CREATE POLICY "Admins view employer cost settings"
ON public.employer_cost_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- =====================================================
-- 8. RESTRICT organization_commission_settings
-- =====================================================
-- Already has good RLS, but add teamleader access
CREATE POLICY "Teamleaders view all commission settings"
ON public.organization_commission_settings FOR SELECT
USING (has_role(auth.uid(), 'teamleader'::user_role));

-- =====================================================
-- 9. RESTRICT organization_regions
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view organization regions" ON public.organization_regions;

-- Admins and teamleaders view all
CREATE POLICY "Admins and teamleaders view all org regions"
ON public.organization_regions FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'teamleader'::user_role));

-- Organizations only see their own regions
CREATE POLICY "Organizations view own regions"
ON public.organization_regions FOR SELECT
USING (
  has_role(auth.uid(), 'organization'::user_role) 
  AND organization_id = get_user_organization(auth.uid())
);

-- Closers view regions for organizations they work with
CREATE POLICY "Closers view assigned org regions"
ON public.organization_regions FOR SELECT
USING (
  has_role(auth.uid(), 'closer'::user_role)
  AND EXISTS (
    SELECT 1 FROM public.closer_regions cr
    WHERE cr.closer_id = auth.uid() 
    AND cr.organization_id = organization_regions.organization_id
  )
);

-- Openers can view org regions (for lead creation)
CREATE POLICY "Openers view org regions"
ON public.organization_regions FOR SELECT
USING (has_role(auth.uid(), 'opener'::user_role));