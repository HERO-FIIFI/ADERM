// Deno (Supabase Edge Function)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shared-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: any) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }), 
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if Flow URL is configured
    const flowUrl = Deno.env.get("FLOW_URL");
    if (!flowUrl) {
      return new Response(
        JSON.stringify({ error: "Flow URL not configured" }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await req.json();
    const { fileName, fileContentBase64, requestId, department, auditeeEmail } = body ?? {};

    console.log('Received SharePoint proxy request:', {
      fileName,
      requestId,
      department,
      auditeeEmail,
      hasFileContent: !!fileContentBase64,
      fileContentLength: fileContentBase64?.length
    });

    // Basic validation
    for (const [k, v] of Object.entries({ fileName, fileContentBase64, requestId, department, auditeeEmail })) {
      if (!v || typeof v !== "string") {
        return new Response(
          JSON.stringify({ error: `Missing or invalid: ${k}` }), 
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Optional shared-secret check (match your Flow if you added it)
    const clientSecret = req.headers.get("x-shared-secret");
    const required = Deno.env.get("FLOW_SECRET");
    if (required && clientSecret !== required) {
      console.error('Invalid shared secret provided');
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Forwarding to Power Automate Flow:', flowUrl);

    // Forward to Power Automate Flow
    const flowResp = await fetch(flowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(required ? { "x-shared-secret": required } : {}),
      },
      body: JSON.stringify({ fileName, fileContentBase64, requestId, department, auditeeEmail }),
    });

    console.log('Power Automate response status:', flowResp.status);

    const text = await flowResp.text();
    console.log('Power Automate response:', text.substring(0, 500) + '...');
    
    // Some Flow responses are not strictly JSON when errors happen—try parse safely:
    let data: any;
    try { 
      data = JSON.parse(text); 
    } catch { 
      data = { raw: text }; 
    }

    if (!flowResp.ok) {
      console.error('Power Automate Flow error:', { status: flowResp.status, data });
      return new Response(
        JSON.stringify({ error: "FLOW_ERROR", status: flowResp.status, data }), 
        { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Successfully processed SharePoint upload');
    return new Response(
      JSON.stringify(data), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err: any) {
    console.error('SharePoint proxy error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});