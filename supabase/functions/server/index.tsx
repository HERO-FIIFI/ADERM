// index.tsx
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

// Fix: Use relative imports based on your file structure
import {
  triggerNewRequestEmail,
  triggerStatusChangeEmail,
  triggerWelcomeEmail,
  triggerResetPasswordEmail,
  sendEmailViaSupabase,
}  from "./email-helpers.tsx";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "auditor" | "auditee" | "manager";
  created_at: string;
}

interface Request {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: "submitted" | "in_progress" | "rejected" | "approved";
  created_by: string;
  assigned_to: string | null;
  assigned_to_email: string;
  department: string;
  cc_emails: string[];
  pending_assignment: boolean;
  created_at: string;
  updated_at: string;
  hr_confidential?: boolean;
}

interface Document {
  id: string;
  request_id: string;
  filename: string;
  file_path: string;
  file_url?: string;
  uploaded_by: string;
  uploaded_at: string;
  comments?: string;
}

interface AuditLog {
  action: string;
  user_id: string;
  timestamp: string;
  details: Record<string, any>;
  request_id?: string;
  document_id?: string;
}

interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  body: string;
  sent_by: string;
  sent_at: string;
  status: string;
  email_type: string;
}

interface OTPRecord {
  code: string;
  created_at: string;
  expires_at: string;
}

const app = new Hono();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      email_confirm: true,
    });

    if (error) {
      console.error("Signup error:", error);
      return c.json({ error: error.message }, 400);
    }

    // Store user info in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      role,
      created_at: new Date().toISOString(),
    });

    // Check for pending requests assigned to this email and assign them
    const allRequests: Request[] = await kv.getByPrefix("request:");
    const pendingRequests = allRequests.filter(
      (req) => req.pending_assignment && req.assigned_to_email === email
    );

    for (const request of pendingRequests) {
      const updatedRequest: Request = {
        ...request,
        assigned_to: data.user.id,
        pending_assignment: false,
        updated_at: new Date().toISOString(),
      };
      await kv.set(`request:${request.id}`, updatedRequest);

      // Log automatic assignment
      await kv.set(`audit_log:${Date.now()}:${data.user.id}`, {
        action: "auto_assigned_request",
        user_id: data.user.id,
        request_id: request.id,
        timestamp: new Date().toISOString(),
        details: {
          email,
          request_title: request.title,
          created_by: request.created_by,
        },
      });
    }

    if (pendingRequests.length > 0) {
      console.log(`Auto-assigned ${pendingRequests.length} pending requests to user ${email}`);
    }

    // Log user creation
    await kv.set(`audit_log:${Date.now()}:${data.user.id}`, {
      action: "user_created",
      user_id: data.user.id,
      timestamp: new Date().toISOString(),
      details: { email, name, role },
    });

    return c.json({ user: data.user, success: true });
  } catch (error) {
    console.error("Signup error:", error);
    return c.json({ error: "Internal server error during signup" }, 500);
  }
});

// Get user profile
app.get("/make-server-fcebfd37/profile", async (c) => {
  try {
    const { user, error } = await authenticateUser(c.req.header("Authorization"));
    
    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    return c.json({ user: userProfile });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return c.json(
      { error: "Internal server error while fetching profile" },
      500
    );
  }
});

// Create document request
app.post("/make-server-fcebfd37/requests", async (c) => {
  try {
    const { user, error } = await authenticateUser(c.req.header("Authorization"));
    
    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    if (!userProfile || userProfile.role !== "auditor") {
      return c.json({ error: "Only auditors can create requests" }, 403);
    }

    const {
      title,
      description,
      due_date,
      assigned_to_email,
      department,
      cc_emails,
    } = await c.req.json();

    if (!title || !description || !due_date || !assigned_to_email || !department) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Find assigned user by email
    const users: UserProfile[] = await kv.getByPrefix("user:");
    const assignedUser = users.find((u) => u.email === assigned_to_email);

    // Allow creating requests for users who haven't signed up yet
    let assignedUserId: string | null = null;
    if (assignedUser) {
      assignedUserId = assignedUser.id;
    }

    const requestId = `req_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const request: Request = {
      id: requestId,
      title,
      description,
      due_date,
      status: "submitted",
      created_by: user.id,
      assigned_to: assignedUserId,
      assigned_to_email,
      department,
      cc_emails: cc_emails || [],
      pending_assignment: !assignedUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await kv.set(`request:${requestId}`, request);

    // Log request creation
    await kv.set(`audit_log:${Date.now()}:${user.id}`, {
      action: "request_created",
      user_id: user.id,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      details: { title, assigned_to_email, department, cc_emails },
    });

    // Send email notification to auditee and CC recipients
    try {
      const result = await triggerNewRequestEmail(
        request,
        {
          id: request.assigned_to,
          email: request.assigned_to_email,
          name: request.assigned_to_email,
          role: "auditee",
        },
        userProfile,
        null
      );

      if (!result.success) {
        console.error("Failed to send new request email:", result.error);
      }
    } catch (emailError) {
      console.error("Error sending new request email:", emailError);
    }

    return c.json({ request, success: true });
  } catch (error) {
    console.error("Request creation error:", error);
    return c.json(
      { error: "Internal server error while creating request" },
      500
    );
  }
});

// Get requests (filtered by user role)
app.get("/make-server-fcebfd37/requests", async (c) => {
  try {
    const { user, error } = await authenticateUser(c.req.header("Authorization"));
    
    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    if (!userProfile) {
      return c.json({ error: "User profile not found" }, 404);
    }

    const allRequests: Request[] = await kv.getByPrefix("request:");
    let filteredRequests: Request[];

    if (userProfile.role === "auditor") {
      // Auditors see all requests, but HR department responses are restricted
      filteredRequests = allRequests.map((req) => {
        if (req.department === "Human Resources") {
          return {
            ...req,
            hr_confidential: true,
          };
        }
        return req;
      });
    } else if (userProfile.role === "manager") {
      // Managers see all requests with full details
      filteredRequests = allRequests;
    } else {
      // Auditees only see requests assigned to them
      filteredRequests = allRequests.filter(
        (req) =>
          req.assigned_to === user.id ||
          (req.pending_assignment && req.assigned_to_email === userProfile.email)
      );
    }

    return c.json({ requests: filteredRequests });
  } catch (error) {
    console.error("Requests fetch error:", error);
    return c.json(
      { error: "Internal server error while fetching requests" },
      500
    );
  }
});

// Upload document for a request
app.post("/make-server-fcebfd37/upload", async (c) => {
  try {
    const { user, error } = await authenticateUser(c.req.header("Authorization"));
    
    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const formData: FormData = await c.req.formData();
    const file: File = formData.get("file") as File;
    const requestId: string = formData.get("request_id") as string;
    const comments: string = (formData.get("comments") as string) || "";

    if (!file || !requestId) {
      return c.json({ error: "Missing file or request ID" }, 400);
    }

    // Verify request exists and user has access
    const request: Request | null = await kv.get(`request:${requestId}`);
    if (!request) {
      return c.json({ error: "Request not found" }, 404);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);

    // Check if user has access to this request
    const hasAccess: boolean =
      request.assigned_to === user.id ||
      (request.pending_assignment && request.assigned_to_email === userProfile?.email) ||
      userProfile?.role === "auditor";

    if (!hasAccess) {
      return c.json({ error: "Access denied to this request" }, 403);
    }

    // If this is a pending assignment, resolve it now
    if (request.pending_assignment && request.assigned_to_email === userProfile?.email) {
      const updatedRequest: Request = {
        ...request,
        assigned_to: user.id,
        pending_assignment: false,
        updated_at: new Date().toISOString(),
      };
      await kv.set(`request:${requestId}`, updatedRequest);

      // Log automatic assignment during upload
      await kv.set(`audit_log:${Date.now()}:${user.id}`, {
        action: "auto_assigned_on_upload",
        user_id: user.id,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        details: {
          email: userProfile.email,
          request_title: request.title,
        },
      });
    }

    // Upload file to Supabase Storage
    const fileName: string = `${requestId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file);

    if (uploadError) {
      console.error("File upload error:", uploadError);
      return c.json({ error: "Failed to upload file" }, 500);
    }

    // Create signed URL for the file
    const { data: signedUrlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    // Store document metadata
    const documentId: string = `doc_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const document: Document = {
      id: documentId,
      request_id: requestId,
      filename: file.name,
      file_path: fileName,
      file_url: signedUrlData?.signedUrl,
      uploaded_by: user.id,
      uploaded_at: new Date().toISOString(),
      comments,
    };

    await kv.set(`document:${documentId}`, document);

    // Update request status
    const updatedRequest: Request = {
      ...request,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    };
    await kv.set(`request:${requestId}`, updatedRequest);

    // Log document upload
    await kv.set(`audit_log:${Date.now()}:${user.id}`, {
      action: "document_uploaded",
      user_id: user.id,
      request_id: requestId,
      document_id: documentId,
      timestamp: new Date().toISOString(),
      details: { filename: file.name, comments },
    });

    return c.json({ document, success: true });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Internal server error during upload" }, 500);
  }
});

// Get documents for a request
app.get("/make-server-fcebfd37/requests/:requestId/documents", async (c) => {
  try {
    const { user, error } = await authenticateUser(c.req.header("Authorization"));
    
    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const requestId = c.req.param("requestId");
    const request: Request | null = await kv.get(`request:${requestId}`);

    if (!request) {
      return c.json({ error: "Request not found" }, 404);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);

    // Check if user has access to view documents for this request
    const hasAccess: boolean =
      request.assigned_to === user.id ||
      (request.pending_assignment && request.assigned_to_email === userProfile?.email) ||
      userProfile?.role === "auditor" ||
      userProfile?.role === "manager";

    if (!hasAccess) {
      return c.json({ error: "Access denied to this request" }, 403);
    }

    // Special handling for HR department requests - auditors cannot access documents
    if (request.department === "Human Resources" && userProfile?.role === "auditor") {
      return c.json(
        {
          error: "Access denied to confidential HR department documents. Contact your manager for access.",
          confidential: true,
        },
        403
      );
    }

    const allDocuments: Document[] = await kv.getByPrefix("document:");
    const requestDocuments = allDocuments.filter(
      (doc) => doc.request_id === requestId
    );

    // Refresh signed URLs for each document
    for (const doc of requestDocuments) {
      const { data: signedUrlData } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(doc.file_path, 3600);
      doc.file_url = signedUrlData?.signedUrl;
    }

    return c.json({ documents: requestDocuments });
  } catch (error) {
    console.error("Documents fetch error:", error);
    return c.json(
      { error: "Internal server error while fetching documents" },
      500
    );
  }
});

// Update request status
app.put("/make-server-fcebfd37/requests/:requestId/status", async (c) => {
  try {
  // Get the actual auditee user data
  let auditeeUser;
  if (updatedRequest.assigned_to) {
    auditeeUser = await kv.get(`user:${updatedRequest.assigned_to}`);
  }
  
  // Fallback if user not found
  if (!auditeeUser) {
    auditeeUser = {
      id: updatedRequest.assigned_to,
      email: updatedRequest.assigned_to_email,
      name: updatedRequest.assigned_to_email.split('@')[0],
      role: "auditee" as const,
    };
  }

  const result = await triggerStatusChangeEmail(
    updatedRequest,
    auditeeUser,
    userProfile,
    null
  );

  if (!result.success) {
    console.error("Failed to send status change email:", result.error);
  }
} catch (emailError) {
  console.error("Error sending status change email:", emailError);
}


    // Special handling for HR department requests
    if (request.department === "Human Resources" && userProfile?.role === "auditor") {
      return c.json(
        {
          error: "Access denied. Only managers can update status for confidential HR department requests.",
        },
        403
      );
    }

    // Update request in KV
    const updatedRequest: Request = {
      ...request,
      status,
      updated_at: new Date().toISOString(),
    };
    await kv.set(`request:${requestId}`, updatedRequest);

    // Log status update
    await kv.set(`audit_log:${Date.now()}:${user.id}`, {
      action: "status_updated",
      user_id: user.id,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      details: {
        old_status: request.status,
        new_status: status,
        hr_confidential: request.department === "Human Resources",
      },
    });

    // Trigger status change email
    try {
      const result = await triggerStatusChangeEmail(
        updatedRequest,
        {
          id: updatedRequest.assigned_to,
          email: updatedRequest.assigned_to_email,
          name: updatedRequest.assigned_to_email,
          role: "auditee",
        },
        userProfile,
        null
      );

      if (!result.success) {
        console.error("Failed to send status change email:", result.error);
      }
    } catch (emailError) {
      console.error("Error sending status change email:", emailError);
    }

    return c.json({ request: updatedRequest, success: true });
  } catch (error) {
    console.error("Status update error:", error);
    return c.json(
      { error: "Internal server error while updating status" },
      500
    );
  }
});

// Check if user exists for password reset
app.post("/make-server-fcebfd37/check-user-exists", async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    // Check if user exists in our KV store
    const users: UserProfile[] = await kv.getByPrefix("user:");
    const userExists = users.some((user) => user.email === email);

    return c.json({ exists: userExists });
  } catch (error) {
    console.error("User check error:", error);
    return c.json({ error: "Internal server error while checking user" }, 500);
  }
});

// Request password reset
app.post("/make-server-fcebfd37/request-password-reset", async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    // Check if user exists in KV
    const users: UserProfile[] = await kv.getByPrefix("user:");
    const user = users.find((u) => u.email === email);

    if (!user) {
      return c.json(
        {
          error: "No account found with this email address. Please check your email or sign up for a new account.",
          user_not_found: true,
        },
        404
      );
    }

    // Generate password reset link manually
    const { data, error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${c.req.header("origin") || "http://localhost:3000"}/reset-password`,
      },
    });

    if (resetError || !data) {
      console.error("Password reset link error:", resetError);
      return c.json(
        { error: "Failed to generate password reset link. Please try again." },
        500
      );
    }

    // Send password reset email via Resend
    try {
      const result = await triggerResetPasswordEmail(email, data.action_link);
      if (!result.success) {
        console.error("Failed to send reset password email:", result.error);
        return c.json({ error: "Failed to send reset password email" }, 500);
      }
    } catch (emailError) {
      console.error("Error sending reset password email:", emailError);
      return c.json({ error: "Error while sending reset password email" }, 500);
    }

    // Log reset request
    await kv.set(`audit_log:${Date.now()}:${user.id}`, {
      action: "password_reset_requested",
      user_id: user.id,
      timestamp: new Date().toISOString(),
      details: { email },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("Password reset error:", error);
    return c.json(
      { error: "Internal server error while processing password reset" },
      500
    );
  }
});

// Get audit logs
app.get("/make-server-fcebfd37/audit-logs", async (c) => {
  try {
    const { user, error } = await authenticateUser(c.req.header("Authorization"));
    
    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== "auditor" && userProfile?.role !== "manager") {
      return c.json({ error: "Access denied to audit logs" }, 403);
    }

    const auditLogs: AuditLog[] = await kv.getByPrefix("audit_log:");
    const sortedLogs = auditLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return c.json({ logs: sortedLogs });
  } catch (error) {
    console.error("Audit logs fetch error:", error);
    return c.json(
      { error: "Internal server error while fetching audit logs" },
      500
    );
  }
});

// Send departmental analysis report via email
app.post("/make-server-fcebfd37/send-report", async (c) => {
  try {
    const { user, error } = await authenticateUser(c.req.header("Authorization"));
    
    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== "auditor" && userProfile?.role !== "manager") {
      return c.json({ error: "Access denied to send reports" }, 403);
    }

    const { to, subject, message, reportContent } = await c.req.json();

    if (!to || !subject || !reportContent) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Create HTML email content
    const emailBody = `
      <p>${message || ""}</p>
      <h3>ADERM Departmental Analysis Report</h3>
      <pre>${reportContent}</pre>
      <hr>
      <p>Sender: ${userProfile.name} (${userProfile.email})</p>
      <p>Generated on: ${new Date().toLocaleString()}</p>
    `;

    // Send via Supabase → Resend
    try {
      const result = await sendEmailViaSupabase([to], subject, emailBody);
      if (!result.success) {
        console.error("Failed to send report email:", result.error);
        return c.json({ error: "Failed to send report email" }, 500);
      }
    } catch (err) {
      console.error("Error sending report email:", err);
      return c.json({ error: "Error while sending report email" }, 500);
    }

    // Store metadata in KV (audit trail)
    const emailId = `email_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    await kv.set(`email:${emailId}`, {
      id: emailId,
      to,
      subject,
      body: emailBody,
      sent_by: user.id,
      sent_at: new Date().toISOString(),
      status: "sent",
      email_type: "departmental_report",
    });

    // Log audit
    await kv.set(`audit_log:${Date.now()}:${user.id}`, {
      action: "report_emailed",
      user_id: user.id,
      timestamp: new Date().toISOString(),
      details: {
        recipient: to,
        subject,
        report_type: "departmental_analysis",
      },
    });

    return c.json({ success: true, message: "Report sent successfully" });
  } catch (error) {
    console.error("Email send error:", error);
    return c.json({ error: "Internal server error while sending email" }, 500);
  }
});

// Send OTP for auditee signup
app.post("/make-server-fcebfd37/send-otp", async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    // Validate @ecobank.com domain
    const ecobankEmailRegex = /^[^\s@]+@ecobank\.com$/;
    if (!ecobankEmailRegex.test(email)) {
      return c.json(
        { error: "Please use your Ecobank email address (@ecobank.com)" },
        400
      );
    }

    // Check if user already exists
    const users: UserProfile[] = await kv.getByPrefix("user:");
    const existingUser = users.find((user) => user.email === email);
    if (existingUser) {
      return c.json(
        {
          error: "An account with this email already exists. Please log in instead.",
        },
        400
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Email subject + HTML body
    const emailSubject = "ADERM - Your verification code";
    const emailBody = `
      <p>Hello,</p>
      <p>Your verification code for the ADERM platform is:</p>
      <h2>${otpCode}</h2>
      <p>This code will expire in 10 minutes. Please enter this code to complete your registration.</p>
      <p>If you didn't request this code, please ignore this email.</p>
      <hr>
      <p>Generated: ${new Date().toLocaleString()}</p>
    `;

    // Send email via Supabase → Resend
    try {
      const result = await sendEmailViaSupabase([email], emailSubject, emailBody);
      if (!result.success) {
        console.error("Failed to send OTP email:", result.error);
        return c.json({ error: "Failed to send OTP email" }, 500);
      }
    } catch (err) {
      console.error("Error sending OTP email:", err);
      return c.json({ error: "Error while sending OTP email" }, 500);
    }

    // Store OTP temporarily
    await kv.set(`otp:${email}`, {
      code: otpCode,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
    });

    // Store email metadata in KV (audit trail)
    const emailId = `email_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    await kv.set(`email:${emailId}`, {
      id: emailId,
      to: email,
      subject: emailSubject,
      body: emailBody,
      sent_by: "system",
      sent_at: new Date().toISOString(),
      status: "sent",
      email_type: "otp_verification",
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("OTP send error:", error);
    return c.json({ error: "Internal server error while sending OTP" }, 500);
  }
});

// Verify OTP and complete signup
app.post("/make-server-fcebfd37/verify-otp-signup", async (c) => {
  try {
    const { email, otp, name, role } = await c.req.json();

    if (!email || !otp || !name) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Default role to auditee if not specified
    const userRole = role || "auditee";

    // Validate role
    if (!["auditor", "auditee", "manager"].includes(userRole)) {
      return c.json({ error: "Invalid role" }, 400);
    }

    // Validate @ecobank.com email domain
    const ecobankEmailRegex = /^[^\s@]+@ecobank\.com$/;
    if (!ecobankEmailRegex.test(email)) {
      return c.json(
        { error: "Please use your Ecobank email address (@ecobank.com)" },
        400
      );
    }

    // Check if user already exists
    const users: UserProfile[] = await kv.getByPrefix("user:");
    const existingUser = users.find((user) => user.email === email);
    if (existingUser) {
      return c.json(
        { error: "An account with this email already exists. Please log in instead." },
        400
      );
    }

    // Verify OTP
    const storedOTP: OTPRecord | null = await kv.get(`otp:${email}`);
    if (!storedOTP) {
      return c.json({ error: "OTP not found or expired. Please request a new one." }, 400);
    }

    // Check if OTP expired
    if (new Date() > new Date(storedOTP.expires_at)) {
      await kv.del(`otp:${email}`);
      return c.json({ error: "OTP has expired. Please request a new one." }, 400);
    }

    // Check OTP match
    if (storedOTP.code !== otp) {
      return c.json({ error: "Invalid OTP. Please check and try again." }, 400);
    }

    // OTP is valid → create user in Supabase
    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: `temp_${Date.now()}_${Math.random().toString(36)}`,
      user_metadata: { name, role: userRole },
      email_confirm: true,
    });

    if (createError || !data?.user) {
      console.error("User creation error:", createError);
      return c.json({ error: "Failed to create account. Please try again." }, 500);
    }

    // Store user info in KV
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      role: userRole,
      created_at: new Date().toISOString(),
    });

    // Assign pending requests (if any)
    const allRequests: Request[] = await kv.getByPrefix("request:");
    const pendingRequests = allRequests.filter(
      (req) => req.pending_assignment && req.assigned_to_email === email
    );

    for (const request of pendingRequests) {
      const updatedRequest: Request = {
        ...request,
        assigned_to: data.user.id,
        pending_assignment: false,
        updated_at: new Date().toISOString(),
      };
      await kv.set(`request:${request.id}`, updatedRequest);

      // Log assignment
      await kv.set(`audit_log:${Date.now()}:${data.user.id}`, {
        action: "auto_assigned_request",
        user_id: data.user.id,
        request_id: request.id,
        timestamp: new Date().toISOString(),
        details: {
          email,
          request_title: request.title,
          created_by: request.created_by,
        },
      });
    }

    // Clean up OTP
    await kv.del(`otp:${email}`);

    // Send welcome email
    try {
      const result = await triggerWelcomeEmail({
        id: data.user.id,
        email,
        name,
        role: userRole,
      });

      if (!result.success) {
        console.error("Failed to send welcome email:", result.error);
      }
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
    }

    return c.json({
      success: true,
      user: { id: data.user.id, email, name, role: userRole },
    });
  } catch (error) {
    console.error("OTP verification/signup error:", error);
    return c.json({ error: "Internal server error while verifying OTP/signup" }, 500);
  }
});

// Get emails for debugging (managers/auditors only)
app.get("/make-server-fcebfd37/emails", async (c) => {
  try {
    const { user, error } = await authenticateUser(c.req.header("Authorization"));
    
    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== "auditor" && userProfile?.role !== "manager") {
      return c.json({ error: "Access denied to email logs" }, 403);
    }

    const emails: EmailRecord[] = await kv.getByPrefix("email:");
    const sortedEmails = emails
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      .slice(0, 50); // limit to 50 most recent

    return c.json({ emails: sortedEmails });
  } catch (error) {
    console.error("Email fetch error:", error);
    return c.json({ error: "Internal server error while fetching emails" }, 500);
  }
});

// Start the server
Deno.serve(app.fetch);