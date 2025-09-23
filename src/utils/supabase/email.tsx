import { createClient } from "npm:@supabase/supabase-js";

// Types for email data
export interface RequestEmailData {
  requestId: string;
  requestTitle: string;
  auditeeName: string;
  auditeeEmail: string;
  managerName?: string;
  managerEmail?: string;
  auditorName: string;
  auditorEmail: string;
  dueDate: string;
  requestUrl: string;
}

export interface StatusChangeEmailData extends RequestEmailData {
  previousStatus: string;
  newStatus: string;
  comments?: string;
}

export interface AuthEmailData {
  userName: string;
  userEmail: string;
  resetLink?: string;
  otpCode?: string;
}

// Create Supabase admin client for sending emails
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
export { supabaseAdmin };

// Helper function to send email via Supabase Edge Function
export const sendEmailViaSupabase = async (
  to: string[],
  subject: string,
  htmlContent: string,
  cc?: string[]
): Promise<boolean> => {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke("send-email", {
      body: {
        to,
        cc,
        subject,
        html: htmlContent,
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

// NEW REQUEST EMAIL
export const sendNewRequestEmail = async (
  data: RequestEmailData
): Promise<boolean> => {
  const htmlContent = `
  <!DOCTYPE html>
<html>
   <head>
      <meta charset="utf-8">
      <title>New Audit Request</title>
      <style>
         body {
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
         line-height: 1.6;
         color: #333333;
         background-color: #f4f4f7;
         margin: 0;
         padding: 0;
         }
         .container {
         max-width: 600px;
         margin: 20px auto;
         padding: 0;
         background-color: #ffffff;
         border-radius: 8px;
         overflow: hidden;
         box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
         }
         .header {
         background: #2563eb;
         color: white;
         padding: 30px 20px;
         text-align: center;
         }
         .header h1 {
         margin: 0;
         font-size: 24px;
         font-weight: bold;
         }
         .content {
         padding: 20px 30px;
         }
         .button {
         display: inline-block;
         padding: 12px 24px;
         background: #2563eb;
         color: white;
         text-decoration: none;
         border-radius: 8px;
         margin: 20px 0;
         font-weight: bold;
         }
         .info-box {
         background: #eef2ff;
         padding: 20px;
         border-left: 4px solid #2563eb;
         border-radius: 4px;
         margin: 20px 0;
         }
         .info-box h3 {
         margin-top: 0;
         color: #1e40af;
         }
         p {
         margin: 0 0 15px;
         }
         .footer {
         text-align: center;
         padding: 20px 30px;
         font-size: 12px;
         color: #999999;
         border-top: 1px solid #e5e7eb;
         margin-top: 20px;
         }
         .disclaimer {
         font-size: 10px;
         color: #cccccc;
         margin-top: 10px;
         text-align: center;
         }
      </style>
   </head>
   <body>
      <div class="container">
         <div class="header">
            <h1>New Audit Request</h1>
         </div>
         <div class="content">
            <p>Hello, ${data.auditeeName},</p>
            <p>You have been assigned a new document request in the ADERM (Audit Document Exchange & Request Management) platform that requires your attention.</p>
            <div class="info-box">
               <h3>Request Details:</h3>
               <p><strong>Request ID:</strong> ${data.requestId}</p>
               <p><strong>Title:</strong> ${data.requestTitle}</p>
               <p><strong>Requested by:</strong> ${data.auditorName}</p>
               <p><strong>Due Date:</strong> ${data.dueDate}</p>
            </div>
            <p>Please review the request and provide the necessary documentation by the due date.</p>
            <p>To access this request and submit the required documents, please create your ADERM account:</p>
            <p>Your email has been pre-filled for convenience.</p>
            <a href="${Deno.env.get("NEXT_PUBLIC_APP_URL")}/signup?mode=auditee-signup&email=${encodeURIComponent(data.auditeeEmail)}" class="button">Create My Account</a>
            <p><strong>IMPORTANT:</strong></p>
            <ul>
               <li>Please review the request carefully and submit documents before the due date.</li>
               <li>If you have questions, contact the requesting auditor at ${data.auditorEmail}.</li>
               <li>All submissions are securely tracked and logged for audit compliance.</li>
            </ul>
         </div>
         <div class="footer">
            <p>This notification was sent by the ADERM platform.</p>
         </div>
      </div>
      <div class="disclaimer">
         <p>Request ID: ${data.requestId}</p>
         <p>Sent: ${new Date().toLocaleString()}</p>
      </div>
   </body>
</html>
  `;

  return await sendEmailViaSupabase(
    [data.auditeeEmail],
    `New Audit Request: ${data.requestTitle}`,
    htmlContent,
    data.managerEmail ? [data.managerEmail] : undefined
  );
};

// STATUS CHANGE EMAILS
export const sendStatusChangeEmail = async (
  data: StatusChangeEmailData
): Promise<boolean> => {
  let recipients: string[] = [];
  let ccRecipients: string[] = [];
  let subject = "";
  let statusMessage = "";
  let actionMessage = "";

  switch (data.newStatus.toLowerCase()) {
    case "submitted":
      recipients = [data.auditorEmail];
      subject = `Request Submitted: ${data.requestTitle}`;
      statusMessage = `The audit request "${data.requestTitle}" has been submitted by ${data.auditeeName}.`;
      actionMessage =
        "Please review the submitted documentation and take appropriate action.";
      break;

    case "approved":
      recipients = [data.auditeeEmail];
      subject = `Request Approved: ${data.requestTitle}`;
      statusMessage = `Your audit request "${data.requestTitle}" has been approved.`;
      actionMessage = "No further action is required from your side.";
      break;

    case "rejected":
      recipients = [data.auditeeEmail];
      subject = `Request Rejected: ${data.requestTitle}`;
      statusMessage = `Your audit request "${data.requestTitle}" has been rejected.`;
      actionMessage = "Please review the comments and resubmit if necessary.";
      break;

    case "overdue":
      recipients = [data.auditeeEmail];
      ccRecipients = data.managerEmail ? [data.managerEmail] : [];
      subject = `OVERDUE: ${data.requestTitle}`;
      statusMessage = `The audit request "${data.requestTitle}" is now overdue.`;
      actionMessage = "Please submit the required documentation immediately.";
      break;

    default:
      recipients = [data.auditeeEmail];
      subject = `Status Update: ${data.requestTitle}`;
      statusMessage = `The status of your audit request "${data.requestTitle}" has been updated to ${data.newStatus}.`;
      actionMessage = "Please check the request for more details.";
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .info-box { background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0; }
        .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; text-transform: uppercase; }
        .status-submitted { background: #fef3c7; color: #92400e; }
        .status-approved { background: #d1fae5; color: #065f46; }
        .status-rejected { background: #fee2e2; color: #991b1b; }
        .status-overdue { background: #fee2e2; color: #991b1b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Request Status Update</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          
          <p>${statusMessage}</p>
          
          <div class="info-box">
            <h3>Request Details:</h3>
            <p><strong>Request ID:</strong> ${data.requestId}</p>
            <p><strong>Title:</strong> ${data.requestTitle}</p>
            <p><strong>Previous Status:</strong> ${data.previousStatus}</p>
            <p><strong>New Status:</strong> <span class="status-badge status-${data.newStatus.toLowerCase()}">${
    data.newStatus
  }</span></p>
            <p><strong>Due Date:</strong> ${data.dueDate}</p>
            ${
              data.comments
                ? `<p><strong>Comments:</strong> ${data.comments}</p>`
                : ""
            }
          </div>
          
          <p>${actionMessage}</p>
          
          <a href="${data.requestUrl}" class="button">View Request Details</a>
          
          <p>Best regards,<br>ADERM Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmailViaSupabase(
    recipients,
    subject,
    htmlContent,
    ccRecipients.length > 0 ? ccRecipients : undefined
  );
};

// WELCOME EMAIL
export const sendWelcomeEmail = async (
  data: AuthEmailData
): Promise<boolean> => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to ADERM!</h1>
        </div>
        <div class="content">
          <p>Dear ${data.userName},</p>
          
          <p>Welcome to the Audit Document Exchange Request Management (ADERM) platform! Your account has been successfully created.</p>
          
          <div class="feature">
            <h3>What you can do with ADERM:</h3>
            <ul>
              <li>Submit and manage audit requests</li>
              <li>Track document exchange status</li>
              <li>Collaborate with auditors and managers</li>
              <li>Access your audit history</li>
            </ul>
          </div>
          
          <p>To get started, log in to your account and explore the dashboard:</p>
          
          <a href="${Deno.env.get("NEXT_PUBLIC_APP_URL")}/dashboard" class="button">Access Dashboard</a>
          
          <div class="feature">
            <h3>Need Help?</h3>
            <p>Our support team is here to help you get the most out of ADERM. If you have any questions or need assistance, don't hesitate to reach out.</p>
          </div>
          
          <p>Thank you for choosing ADERM for your audit document management needs.</p>
          
          <p>Best regards,<br>ADERM Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmailViaSupabase(
    [data.userEmail],
    "Welcome to ADERM - Your Account is Ready!",
    htmlContent
  );
};

// OTP EMAIL
export const sendOTPEmail = async (data: AuthEmailData): Promise<boolean> => {
  if (!data.otpCode) {
    throw new Error("OTP code is required for OTP email");
  }

  const htmlContent = `
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
          <p>Dear ${data.userName},</p>
          
          <p>Please use the following verification code to complete your authentication:</p>
          
          <div class="otp-code">
            <p>Your verification code is:</p>
            <div class="otp-number">${data.otpCode}</div>
          </div>
          
          <div class="warning">
            <p><strong>Important:</strong></p>
            <ul>
              <li>This code will expire in 10 minutes</li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this code, please ignore this email</li>
            </ul>
          </div>
          
          <p>If you're having trouble, please contact our support team.</p>
          
          <p>Best regards,<br>ADERM Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmailViaSupabase(
    [data.userEmail],
    "Your ADERM Verification Code",
    htmlContent
  );
};

