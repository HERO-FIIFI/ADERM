// supabase/functions/send-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

console.log('RESEND_API_KEY available:', !!RESEND_API_KEY)

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
  console.log('Email function called with method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()
    console.log('Email request received:', { 
      to: requestBody.to, 
      subject: requestBody.subject,
      hasHtml: !!requestBody.html 
    })

    const { to, cc, subject, html }: EmailRequest = requestBody

    // Validate required fields
    if (!to || !Array.isArray(to) || to.length === 0) {
      console.error('Invalid recipients:', to)
      return new Response(
        JSON.stringify({ error: 'Recipients (to) are required and must be an array' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!subject || !html) {
      console.error('Missing subject or html:', { subject: !!subject, html: !!html })
      return new Response(
        JSON.stringify({ error: 'Subject and HTML content are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not found in environment variables')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { 
          status: 500, 
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

    console.log('Sending email via Resend API:', {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject
    })

    // Send email via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    })

    console.log('Resend API response status:', res.status)

    if (res.ok) {
      const data = await res.json()
      console.log('Email sent successfully:', data)
      return new Response(
        JSON.stringify({ success: true, data }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      const error = await res.text()
      console.error('Resend API error response:', error)
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