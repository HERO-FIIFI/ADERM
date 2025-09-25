// supabase/functions/sharepoint-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shared-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Your Power Automate Flow URL
const POWER_AUTOMATE_URL = "https://default6400df671817484e84aeed3b97ca16.20.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/8a176c047b724c649d1ac50c6b8a7805/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=xoKEfsrSIlMCYIQnrB5V4pcoaTIwnLE9txoshxUecMw";

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

    console.log('SharePoint proxy called');

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
    const requiredFields = { fileName, fileContentBase64, requestId, department, auditeeEmail };
    for (const [k, v] of Object.entries(requiredFields)) {
      if (!v || typeof v !== "string") {
        console.error(`Validation failed for field: ${k}`);
        return new Response(
          JSON.stringify({ error: `Missing or invalid: ${k}` }), 
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Optional shared-secret check (you can set FLOW_SECRET env var for extra security)
    const clientSecret = req.headers.get("x-shared-secret");
    const required = Deno.env.get("FLOW_SECRET");
    if (required && clientSecret !== required) {
      console.error('Invalid shared secret provided');
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid shared secret" }), 
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Forwarding to Power Automate Flow:', POWER_AUTOMATE_URL.substring(0, 100) + '...');

    // Prepare payload for Power Automate
    const payload = {
      fileName,
      fileContentBase64,
      requestId,
      department,
      auditeeEmail,
      uploadedAt: new Date().toISOString()
    };

    // Forward to Power Automate Flow
    const flowResp = await fetch(POWER_AUTOMATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(required ? { "x-shared-secret": required } : {}),
      },
      body: JSON.stringify(payload),
    });

    console.log('Power Automate response status:', flowResp.status);

    const text = await flowResp.text();
    console.log('Power Automate response preview:', text.substring(0, 200) + '...');
    
    // Some Flow responses are not strictly JSON when errors happen—try parse safely:
    let data: any;
    try { 
      data = JSON.parse(text); 
    } catch { 
      data = { raw: text, message: "Non-JSON response from Power Automate" }; 
    }

    if (!flowResp.ok) {
      console.error('Power Automate Flow error:', { 
        status: flowResp.status, 
        statusText: flowResp.statusText,
        data 
      });
      return new Response(
        JSON.stringify({ 
          error: "POWER_AUTOMATE_ERROR", 
          status: flowResp.status,
          statusText: flowResp.statusText,
          data 
        }), 
        { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Successfully processed SharePoint upload via Power Automate');
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Document uploaded to SharePoint successfully",
        data,
        uploadDetails: {
          fileName,
          requestId,
          department,
          uploadedAt: new Date().toISOString()
        }
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err: any) {
    console.error('SharePoint proxy error:', err);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: err?.message ?? "Unknown error occurred",
        details: err?.stack
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});