import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

interface EmailRequest {
  to: string[]
  cc?: string[]
  subject: string
  html: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      } 
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { to, cc, subject, html }: EmailRequest = await req.json()

    // Validate required fields
    if (!to || !Array.isArray(to) || to.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Recipients (to) are required and must be an array' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Subject and HTML content are required' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare email payload for Resend
    const emailPayload: any = {
      from: 'ADERM Team <noreply@caya.africa>',
      to,
      subject,
      html,
    }

    // Add CC if provided
    if (cc && Array.isArray(cc) && cc.length > 0) {
      emailPayload.cc = cc
    }

    // Send email via Resend API
    const { error } = await resend.emails.send(emailPayload)

    if (error) {
      console.error('Resend API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-email function:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})
