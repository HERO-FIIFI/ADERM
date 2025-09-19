import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // safe on server
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, html } = body;

    const { data, error } = await supabaseAdmin.functions.invoke("send-email", {
      body: { to, subject, html },
    });

    if (error) {
      console.error("Supabase email error:", error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Send email route error:", err);
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }
}
