import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    
    // Validate required fields
    const { email, phone, address, interest, opener_email, organization_ids, date_sent } = body

    if (!email || !interest || !opener_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, interest, opener_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate interest type
    if (!['sun', 'battery', 'sun_battery'].includes(interest)) {
      return new Response(
        JSON.stringify({ error: 'Invalid interest type. Must be: sun, battery, or sun_battery' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find opener by email
    const { data: opener, error: openerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', opener_email)
      .single()

    if (openerError || !opener) {
      return new Response(
        JSON.stringify({ error: `Opener not found with email: ${opener_email}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        email,
        phone: phone || null,
        address: address || null,
        interest,
        opener_id: opener.id,
        date_sent: date_sent || new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (contactError) {
      return new Response(
        JSON.stringify({ error: contactError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Link to organizations if provided
    if (organization_ids && Array.isArray(organization_ids) && organization_ids.length > 0) {
      const orgLinks = organization_ids.map((orgId: string) => ({
        contact_id: contact.id,
        organization_id: orgId,
      }))

      const { error: linkError } = await supabase
        .from('contact_organizations')
        .insert(orgLinks)

      if (linkError) {
        console.error('Error linking organizations:', linkError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, contact }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
