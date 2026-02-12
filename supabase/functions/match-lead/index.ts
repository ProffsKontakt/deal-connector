import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * POST /match-lead
 *
 * Matchar ett inkommande lead till rätt säljare baserat på:
 *   - partner (organization_id eller external_partner_id)
 *   - lead-typ (t.ex. "Batteri", "Solceller", "Solceller & Batteri")
 *
 * Anropas från n8n, webhooks eller frontend.
 *
 * Body:
 *   {
 *     "partner_id": "abc-123" eller "ext-id",   // UUID eller externt ID
 *     "lead_type": "Batteri",                    // Lead-typ
 *     "lead_reference": { ... }                   // Valfri extra data
 *   }
 *
 * Returnerar:
 *   {
 *     "selected_pipeline_id": 123,
 *     "selected_pipeline_name": "SunBro Pipeline",
 *     "selected_stage_id": 456,
 *     "selected_stage_name": "Ny",
 *     "selected_owner_user_id": 789,
 *     "selected_owner_user_name": "Anna Andersson",
 *     "lead_typ": "Batteri",
 *     "lead_type_for_routing": "Batteri",
 *     "next_last_user_name": "Anna Andersson"
 *   }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const { partner_id, lead_type, lead_reference } = body

    // ── Validera input ──
    if (!partner_id) {
      return new Response(
        JSON.stringify({ error: 'partner_id saknas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!lead_type) {
      return new Response(
        JSON.stringify({ error: 'lead_type saknas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Resolva partner_id till organization_id (UUID) ──
    let organizationId: string = partner_id

    // Kolla om det redan är ett giltigt UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(partner_id)) {
      // Försök slå upp via external_partner_id
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('external_partner_id', partner_id)
        .single()

      if (orgError || !org) {
        return new Response(
          JSON.stringify({
            error: `Ingen organisation hittad med external_partner_id="${partner_id}". `
              + 'Kontrollera att external_partner_id är satt på organisationen i databasen.'
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      organizationId = org.id
    }

    // ── Anropa matchningsfunktionen ──
    const { data, error } = await supabase.rpc('match_lead_to_salesperson', {
      p_organization_id: organizationId,
      p_lead_type: lead_type,
      p_lead_reference: lead_reference || null,
    })

    if (error) {
      console.error('Matchningsfel:', error)

      // Ge mer info vid fel
      const { data: debugRules } = await supabase
        .from('lead_routing_rules')
        .select('owner_user_name, priority, lead_types, active')
        .eq('organization_id', organizationId)

      return new Response(
        JSON.stringify({
          error: error.message,
          debug: {
            organization_id: organizationId,
            lead_type,
            existing_rules: debugRules || [],
          }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, match: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
