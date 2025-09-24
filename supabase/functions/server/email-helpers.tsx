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
    <h2>New Audit Request Assigned</h2>
    <p>Hello,</p>
    <p>You have been assigned a new audit request:</p>
    <ul>
      <li><strong>Title:</strong> ${request.title}</li>
      <li><strong>Description:</strong> ${request.description}</li>
      <li><strong>Due Date:</strong> ${request.due_date}</li>
      <li><strong>Department:</strong> ${request.department}</li>
    </ul>
    <p>Please log in to the ADERM system to view and respond to this request.</p>
    <p>Best regards,<br>ADERM Team</p>
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
    <h2>Request Status Updated</h2>
    <p>Hello,</p>
    <p>The status of your audit request has been updated:</p>
    <ul>
      <li><strong>Title:</strong> ${request.title}</li>
      <li><strong>Previous Status:</strong> ${request.previousStatus}</li>
      <li><strong>New Status:</strong> ${request.status}</li>
      <li><strong>Updated by:</strong> ${updater.name}</li>
    </ul>
    <p>Please log in to the ADERM system to view the details.</p>
    <p>Best regards,<br>ADERM Team</p>
  `;
  
  return await sendEmailViaSupabase([auditee.email], subject, html);
};

export const triggerWelcomeEmail = async (user: User): Promise<EmailResponse> => {
  console.log('triggerWelcomeEmail called', { user: user.email });
  
  const subject = 'Welcome to ADERM - Audit Document Exchange & Request Management';
  const html = `
    <h2>Welcome to ADERM!</h2>
    <p>Hello ${user.name},</p>
    <p>Your account has been successfully created in the Audit Document Exchange & Request Management system.</p>
    <ul>
      <li><strong>Email:</strong> ${user.email}</li>
      <li><strong>Role:</strong> ${user.role}</li>
    </ul>
    <p>You can now log in to the system using your email address and the OTP verification process.</p>
    <p>Best regards,<br>ADERM Team</p>
  `;
  
  return await sendEmailViaSupabase([user.email], subject, html);
};

export const triggerOTPEmail = async (user: User, otp: string, type?: string): Promise<EmailResponse> => {
  console.log('triggerOTPEmail called', { user: user.email, otp, type });
  
  const isSignup = type === 'signup';
  const subject = isSignup ? 'ADERM - Email Verification Code' : 'ADERM - Login Verification Code';
  const html = `
    <h2>${isSignup ? 'Email Verification' : 'Login Verification'}</h2>
    <p>Hello,</p>
    <p>Your ${isSignup ? 'email verification' : 'login'} code for ADERM is:</p>
    <div style="font-size: 24px; font-weight: bold; color: #007bff; text-align: center; padding: 20px; border: 2px solid #007bff; margin: 20px 0;">
      ${otp}
    </div>
    <p>This code will expire in 10 minutes. Please do not share this code with anyone.</p>
    <p>If you did not request this code, please ignore this email.</p>
    <p>Best regards,<br>ADERM Team</p>
  `;
  
  return await sendEmailViaSupabase([user.email], subject, html);
};

export const sendEmailViaSupabase = async (
  recipients: string[],
  subject: string,
  body: string
): Promise<EmailResponse> => {
  console.log('sendEmailViaSupabase called', { recipients, subject });
  
  // Input validation
  if (!recipients || recipients.length === 0) {
    return { success: false, error: 'No recipients provided' };
  }
  
  if (!subject || subject.trim() === '') {
    return { success: false, error: 'Subject is required' };
  }
  
  if (!body || body.trim() === '') {
    return { success: false, error: 'Email body is required' };
  }

  // Validate email addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = recipients.filter(email => !emailRegex.test(email));
  if (invalidEmails.length > 0) {
    return { success: false, error: `Invalid email addresses: ${invalidEmails.join(', ')}` };
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    }

    const response = await fetch('https://zuwibzghvggscfqhfhnz.supabase.co/functions/v1/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: recipients,
        subject: subject.trim(),
        html: body,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Email sent successfully:', result);
      return { success: true, data: result };
    } else {
      const errorText = await response.text();
      console.error('Failed to send email:', errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    console.error('Error sending email:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
};