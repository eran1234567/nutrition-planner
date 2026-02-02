import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Dev-only: create a user using the service role key, bypassing interactive password policy.
// SECURITY: This endpoint is strictly for local/dev testing. It requires the DEV_BYPASS_SECRET
// environment variable to be set and the caller must include the same value in the
// `x-dev-bypass` request header.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-dev-bypass',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = Deno.env.get('DEV_BYPASS_SECRET');
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Dev bypass not enabled' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const header = req.headers.get('x-dev-bypass') || '';
  if (header !== secret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Supabase env not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { email, password, confirmPassword, email_confirm = true } = body || {};
  if (!email || typeof email !== 'string') {
    return new Response(JSON.stringify({ error: 'email is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!password || typeof password !== 'string') {
    return new Response(JSON.stringify({ error: 'password is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Use the Admin REST endpoint to create a user ignoring client password constraints
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
      body: JSON.stringify({ email, password, email_confirm }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data?.message || data || 'Failed to create user', details: data }), { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Service role succeeded. Return created user object (safe for dev only)
    return new Response(JSON.stringify({ success: true, user: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});