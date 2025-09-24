// supabase/functions/send-email/index.ts
// If using Deno, ensure you run with `deno run --allow-net --allow-env <file>` and the import below works.
// If using Node.js, replace with an appropriate HTTP server (e.g., Express).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// For Deno, you can use Deno.env.get directly, but ensure you run with --allow-env flag.
// If you are running in Supabase Edge Functions, use Deno.env.get as below:
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

interface EmailRequest {
  to: string[]
  cc?: string[]
  subject: string
  html: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, cc, subject, html }: EmailRequest = await req.json()

    // Validate required fields
    if (!to || !Array.isArray(to) || to.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Recipients (to) are required and must be an array' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Subject and HTML content are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare email payload for Resend
    const emailPayload: any = {
      from: 'ADERM Team <noreply-adermteam@caya.africa>',
      to,
      subject,
      html,
    }

    // Add CC if provided
    if (cc && Array.isArray(cc) && cc.length > 0) {
      emailPayload.cc = cc
    }

    // Send email via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    })

    if (res.ok) {
      const data = await res.json()
      return new Response(
        JSON.stringify({ success: true, data }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      const error = await res.text()
      console.error('Resend API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Error in send-email function:', error)
    const errorMessage = typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message: string }).message
      : String(error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

