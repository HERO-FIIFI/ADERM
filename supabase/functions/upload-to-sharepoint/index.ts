// Deno (Supabase Edge Function)
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    const body = await req.json();
    const { fileName, fileContentBase64, requestId, department, auditeeEmail } = body ?? {};

    // Basic validation
    for (const [k, v] of Object.entries({ fileName, fileContentBase64, requestId, department, auditeeEmail })) {
      if (!v || typeof v !== "string") {
        return new Response(JSON.stringify({ error: `Missing or invalid: ${k}` }), { status: 400 });
      }
    }

    // Optional shared-secret check (match your Flow if you added it)
    const clientSecret = req.headers.get("x-shared-secret");
    const required = Deno.env.get("FLOW_SECRET");
    if (required && clientSecret !== required) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Forward to Power Automate Flow
    const flowResp = await fetch(Deno.env.get("FLOW_URL")!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(required ? { "x-shared-secret": required } : {}),
      },
      body: JSON.stringify({ fileName, fileContentBase64, requestId, department, auditeeEmail }),
    });

    const text = await flowResp.text();
    // Some Flow responses are not strictly JSON when errors happen—try parse safely:
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!flowResp.ok) {
      return new Response(JSON.stringify({ error: "FLOW_ERROR", status: flowResp.status, data }), { status: 502 });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), { status: 500 });
  }
});
