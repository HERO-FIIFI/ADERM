// email-helpers.tsx - Email helper functions using Supabase send-email function

// Deno global declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Type definitions
interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface AuditRequest {
  id: string;
  title: string;
  description: string;
  due_date: string;
  department: string;
  status: string;
  previousStatus?: string;
}

interface EmailResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export const triggerNewRequestEmail = async (
  request: AuditRequest,
  auditee: User,
  creator: User,
  ccRecipients: string[]
): Promise<EmailResponse> => {
  console.log('triggerNewRequestEmail called', { request: request.id, auditee: auditee.email });
  
  const subject = `New Audit Request: ${request.title}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🛡️ ADERM Platform</h1>
        <p style="margin: 5px 0 0 0;">New Audit Request Assigned</p>
    </div>

    <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello,</p>

        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            You have been assigned a new audit request:
        </p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin: 0 0 15px 0;">Request Details</h3>
            <ul style="color: #374151; font-size: 15px; line-height: 1.6; list-style-type: none; padding: 0; margin: 0;">
                <li><strong>Title:</strong> ${request.title}</li>
                <li><strong>Description:</strong> ${request.description}</li>
                <li><strong>Due Date:</strong> ${request.due_date}</li>
                <li><strong>Department:</strong> ${request.department}</li>
            </ul>
        </div>

        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Please log in to the ADERM system to view and respond to this request.
        </p>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">This notification was sent by the ADERM platform</p>
        <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Assigned: ${new Date().toLocaleString()}</p>
    </div>
</div>

  `;
  
  return await sendEmailViaSupabase([auditee.email], subject, html);
};

export const triggerStatusChangeEmail = async (
  request: AuditRequest,
  auditee: User,
  updater: User,
  ccRecipients: string[]
): Promise<EmailResponse> => {
  console.log('triggerStatusChangeEmail called', { request: request.id, auditee: auditee.email });
  
  const subject = `Request Status Updated: ${request.title}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🛡️ ADERM Platform</h1>
        <p style="margin: 5px 0 0 0;">Request Status Updated</p>
    </div>

    <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello,</p>

        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            The status of your audit request has been updated:
        </p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin: 0 0 15px 0;">Request Details</h3>
            <ul style="color: #374151; font-size: 15px; line-height: 1.6; list-style-type: none; padding: 0; margin: 0;">
                <li><strong>Title:</strong> ${request.title}</li>
                <li><strong>Previous Status:</strong> ${request.previousStatus}</li>
                <li><strong>New Status:</strong> ${request.status}</li>
                <li><strong>Updated by:</strong> ${updater.name}</li>
            </ul>
        </div>

        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Please log in to the ADERM system to view more details and take any necessary actions.
        </p>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">This notification was sent by the ADERM platform</p>
        <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Updated: ${new Date().toLocaleString()}</p>
    </div>
</div>

  `;
  
  return await sendEmailViaSupabase([auditee.email], subject, html);
};

export const triggerWelcomeEmail = async (user: User): Promise<EmailResponse> => {
  console.log('triggerWelcomeEmail called', { user: user.email });
  
  const subject = 'Welcome to ADERM - Audit Document Exchange & Request Management';
  const html = `
   <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🛡️ ADERM Platform</h1>
        <p style="margin: 5px 0 0 0;">Welcome to ADERM!</p>
    </div>

    <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello ${user.name},</p>

        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Your account has been successfully created in the <strong>Audit Document Exchange & Request Management (ADERM)</strong> system.
        </p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin: 0 0 15px 0;">Your Account Details</h3>
            <ul style="color: #374151; font-size: 15px; line-height: 1.6; list-style-type: none; padding: 0; margin: 0;">
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Role:</strong> ${user.role}</li>
            </ul>
        </div>

        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            You can now log in to the system using your email address and the OTP verification process.
        </p>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">This account was created on the ADERM platform</p>
        <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Created: ${new Date().toLocaleString()}</p>
    </div>
</div>

  `;
  
  return await sendEmailViaSupabase([user.email], subject, html);
};

export const triggerOTPEmail = async (user: User, otp: string, type?: string): Promise<EmailResponse> => {
  console.log('triggerOTPEmail called', { user: user.email, otp, type });
  
  const isSignup = type === 'signup';
  const subject = isSignup ? 'ADERM - Email Verification Code' : 'ADERM - Login Verification Code';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🛡️ ADERM Platform</h1>
        <p style="margin: 5px 0 0 0;">${isSignup ? 'Email Verification Code' : 'Login Verification Code'}</p>
    </div>

    <div style="padding: 30px 20px; text-align: center;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello,</p>

        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Your ${isSignup ? 'email verification' : 'login'} code for ADERM is below.
        </p>

        <div style="background-color: #f3f4f6; padding: 30px 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin: 0 0 15px 0;">Your Verification Code</h3>
            <div style="font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 8px; font-family: monospace;">
                ${otp}
            </div>
            <p style="color: #6b7280; font-size: 14px; margin: 15px 0 0 0;">This code expires in 10 minutes</p>
        </div>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; text-align: left;">
            <h4 style="color: #92400e; margin: 0 0 10px 0;">⚠️ SECURITY NOTICE</h4>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                <li>Do not share this code with anyone</li>
                <li>ADERM staff will never ask for your verification code</li>
                <li>If you didn't request this code, ignore this email</li>
            </ul>
        </div>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">This verification code was sent by the ADERM platform</p>
        <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Sent: ${new Date().toLocaleString()}</p>
    </div>
</div>

  `;
  
  return await sendEmailViaSupabase([user.email], subject, html);
};

export const sendEmailViaSupabase = async (
  recipients: string[],
  subject: string,
  body: string
): Promise<EmailResponse> => {
  console.log('=== sendEmailViaSupabase DEBUG START ===');
  console.log('Recipients:', recipients);
  console.log('Subject:', subject);
  console.log('Body length:', body?.length);
  
  // Input validation
  if (!recipients || recipients.length === 0) {
    console.error('No recipients provided');
    return { success: false, error: 'No recipients provided' };
  }
  
  if (!subject || subject.trim() === '') {
    console.error('Subject is required');
    return { success: false, error: 'Subject is required' };
  }
  
  if (!body || body.trim() === '') {
    console.error('Email body is required');
    return { success: false, error: 'Email body is required' };
  }

  // Validate email addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = recipients.filter(email => !emailRegex.test(email));
  if (invalidEmails.length > 0) {
    console.error('Invalid email addresses:', invalidEmails);
    return { success: false, error: `Invalid email addresses: ${invalidEmails.join(', ')}` };
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    console.log('Environment check:', {
      hasServiceRoleKey: !!serviceRoleKey,
      hasSupabaseUrl: !!supabaseUrl,
    });
    
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
      return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY environment variable is not set' };
    }

    if (!supabaseUrl) {
      console.error('SUPABASE_URL environment variable is not set');
      return { success: false, error: 'SUPABASE_URL environment variable is not set' };
    }

    const emailPayload = {
      to: recipients,
      subject: subject.trim(),
      html: body,
    };

    console.log('Making request to Edge Function with payload:', {
      to: emailPayload.to,
      subject: emailPayload.subject,
      htmlLength: emailPayload.html?.length
    });

    const functionUrl = `${supabaseUrl}/functions/v1/send-email`;
    console.log('Edge Function URL:', functionUrl);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    console.log('Edge Function response status:', response.status);
    console.log('Edge Function response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = await response.json();
      console.log('Email sent successfully:', result);
      return { success: true, data: result };
    } else {
      const errorText = await response.text();
      console.error('Edge Function error response:', errorText);
      console.error('Response status:', response.status);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    console.error('Network or other error sending email:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
};