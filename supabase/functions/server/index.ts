import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "auditor" | "auditee" | "manager";
  created_at: string;
  email_verified: boolean;
}

interface OTPRecord {
  code: string;
  email: string;
  user_id?: string;
  created_at: string;
  expires_at: string;
  verified: boolean;
}

interface SessionToken {
  user_id: string;
  email: string;
  created_at: string;
  expires_at: string;
  login_method: string;
}

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// Helper function to send email via Supabase function
const sendEmailViaSupabase = async (
  to: string[],
  subject: string,
  html: string,
  cc?: string[]
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to,
        cc,
        subject,
        html,
      },
    });

    if (error) {
      console.error("Email sending error:", error);
      return false;
    }

    console.log("Email sent successfully:", data);
    return true;
  } catch (error) {
    console.error("Error sending email via Supabase function:", error);
    return false;
  }
};

// Helper function to send OTP email
const sendOTPEmail = async (email: string, otpCode: string, type: 'login' | 'signup' = 'login'): Promise<boolean> => {
  const subject = type === 'signup' ? 'Your ADERM Verification Code' : 'Your ADERM Login Code';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .otp-code { background: white; padding: 20px; text-align: center; margin: 20px 0; border: 2px dashed #2563eb; }
        .otp-number { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px; }
        .warning { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verification Code</h1>
        </div>
        <div class="content">
          <p>Please use the following verification code to complete your ${type}:</p>
          
          <div class="otp-code">
            <p>Your verification code is:</p>
            <div class="otp-number">${otpCode}</div>
          </div>
          
          <div class="warning">
            <p><strong>Important:</strong></p>
            <ul>
              <li>This code will expire in 10 minutes</li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this code, please ignore this email</li>
            </ul>
          </div>
          
          <p>Best regards,<br>ADERM Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmailViaSupabase([email], subject, html);
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  try {
    // Send OTP for login
    if (path.endsWith('/send-otp') && req.method === 'POST') {
      const { email } = await req.json();
      
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const okDomain = /^[^\s@]+@ecobank\.com$/i;
      if (!okDomain.test(email)) {
        return new Response(
          JSON.stringify({ error: "Please use your Ecobank email address (@ecobank.com)" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user exists
      const allUsers: UserProfile[] = await kv.getByPrefix("user:");
      const existingUser = allUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      
      if (!existingUser) {
        return new Response(
          JSON.stringify({ error: "Account not found. Please sign up first." }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate & store login OTP (10 mins)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpKey = `login_otp:${email.toLowerCase()}`;

      await kv.set(otpKey, {
        code: otp,
        email,
        user_id: existingUser.id,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        verified: false,
      } satisfies OTPRecord);

      // Send OTP email
      const emailSent = await sendOTPEmail(email, otp, 'login');
      
      if (!emailSent) {
        return new Response(
          JSON.stringify({ error: "Failed to send login OTP email" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Login OTP sent successfully" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP for signup
    if (path.endsWith('/send-signup-otp') && req.method === 'POST') {
      const { email } = await req.json();
      
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const okDomain = /^[^\s@]+@ecobank\.com$/i;
      if (!okDomain.test(email)) {
        return new Response(
          JSON.stringify({ error: "Please use your Ecobank email address (@ecobank.com)" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user already exists
      const allUsers: UserProfile[] = await kv.getByPrefix("user:");
      const existingUser = allUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      
      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "An account with this email already exists. Please log in instead." }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate & store signup OTP (10 mins)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpKey = `signup_otp:${email.toLowerCase()}`;

      await kv.set(otpKey, {
        code: otp,
        email,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        verified: false,
      } satisfies OTPRecord);

      // Send OTP email
      const emailSent = await sendOTPEmail(email, otp, 'signup');
      
      if (!emailSent) {
        return new Response(
          JSON.stringify({ error: "Failed to send signup OTP email" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Signup OTP sent successfully" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default response for other paths
    return new Response(
      JSON.stringify({ message: "ADERM Server Function", available_endpoints: ["/send-otp", "/send-signup-otp"] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in server function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
