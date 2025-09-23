// email-helpers.tsx - FIXED VERSION
import {
  sendNewRequestEmail,
  sendStatusChangeEmail,
  sendWelcomeEmail,
  sendOTPEmail,
  sendEmailViaSupabase,
  type RequestEmailData,
  type StatusChangeEmailData,
  type AuthEmailData,
} from "./email.tsx";

interface RequestData {
  id: string;
  title: string;
  assigned_to: string;
  created_by: string;
  assigned_to_email: string;
  due_date: string;
  status: string;
  department?: string;
  previousStatus?: string; // Add this line
}

interface UserData {
  id: string | null;
  email: string;
  name?: string;
  role?: string;
}

interface EmailResponse {
  success: boolean;
  error?: string;
}

// Helper to get environment variables - browser safe
const getEnv = (key: string, defaultValue: string = ""): string => {
  // Check if we're in a Deno environment (server-side)
  if (typeof globalThis !== 'undefined' && 'Deno' in globalThis) {
    const deno = (globalThis as any).Deno;
    return deno.env?.get(key) || defaultValue;
  }
  // Browser environment - use import.meta.env (Vite)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || defaultValue;
  }
  // Fallback for other environments
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
};

const APP_URL = getEnv("NEXT_PUBLIC_APP_URL", typeof window !== 'undefined' ? window.location.origin : "");

// Standardized error logging
const logError = (context: string, error: unknown): void => {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  console.error(`[Email] Error in ${context}:`, errorMessage);
};

// Updated sendEmailViaSupabase wrapper to return correct format
const sendEmailWrapper = async (
  to: string[],
  subject: string,
  html: string,
  cc?: string[]
): Promise<EmailResponse> => {
  try {
    console.log(
      `[DEBUG] sendEmailWrapper called with: to=${to}, subject=${subject}`
    );
    const success = await sendEmailViaSupabase(to, subject, html, cc);
    console.log(`[DEBUG] sendEmailViaSupabase returned: ${success}`);

    if (success) {
      return { success: true };
    } else {
      return { success: false, error: "Email sending failed" };
    }
  } catch (error) {
    logError("sendEmailWrapper", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const triggerNewRequestEmail = async (
  request: RequestData,
  auditee: UserData,
  auditor: UserData,
  manager?: UserData | null
): Promise<EmailResponse> => {
  try {
    const emailData: RequestEmailData = {
      requestId: request.id,
      requestTitle: request.title,
      auditeeName: auditee.name || auditee.email.split("@")[0],
      auditeeEmail: auditee.email,
      managerName: manager?.name,
      managerEmail: manager?.email,
      auditorName: auditor.name || auditor.email.split("@")[0],
      auditorEmail: auditor.email,
      dueDate: new Date(request.due_date).toLocaleDateString(),
      requestUrl: `${APP_URL}/requests/${request.id}`,
    };

    const success = await sendNewRequestEmail(emailData);
    return { success };
  } catch (error) {
    logError("triggerNewRequestEmail", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const triggerStatusChangeEmail = async (
  request: RequestData,
  auditee: UserData,
  auditor: UserData,
  manager?: UserData | null
): Promise<EmailResponse> => {
  try {
    // In triggerStatusChangeEmail function, update to:
    const emailData: StatusChangeEmailData = {
      requestId: request.id,
      requestTitle: request.title,
      auditeeName: auditee.name || auditee.email.split("@")[0],
      auditeeEmail: auditee.email,
      managerName: manager?.name,
      managerEmail: manager?.email,
      auditorName: auditor.name || auditor.email.split("@")[0],
      auditorEmail: auditor.email,
      dueDate: new Date(request.due_date).toLocaleDateString(),
      requestUrl: `${APP_URL}/requests/${request.id}`,
      previousStatus: request.previousStatus || request.status,
      newStatus: request.status,
    };
    const success = await sendStatusChangeEmail(emailData);
    return { success };
  } catch (error) {
    logError("triggerStatusChangeEmail", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const triggerWelcomeEmail = async (
  user: UserData
): Promise<EmailResponse> => {
  try {
    const emailData: AuthEmailData = {
      userName: user.name || user.email.split("@")[0],
      userEmail: user.email,
    };

    const success = await sendWelcomeEmail(emailData);
    return { success };
  } catch (error) {
    logError("triggerWelcomeEmail", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const triggerOTPEmail = async (
  user: UserData,
  otpCode: string
): Promise<EmailResponse> => {
  try {
    const emailData: AuthEmailData = {
      userName: user.name || user.email.split("@")[0],
      userEmail: user.email,
      otpCode,
    };

    const success = await sendOTPEmail(emailData);
    return { success };
  } catch (error) {
    logError("triggerOTPEmail", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
