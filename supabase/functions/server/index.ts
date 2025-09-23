// index.ts - Full functionality with fixed imports
import { Hono, Context } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
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
  is_replacement?: boolean;
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

// Initialize Hono app
const app = new Hono();

// Enable CORS for production - restricted origins for security
app.use(
  "/*",
  cors({
    origin: [
      // Allow Supabase domains for function-to-function communication
      /^https:\/\/.*\.supabase\.co$/,
      // Add your production domain here
      "https://your-production-domain.com"
    ],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// Initialize storage bucket on startup
const bucketName = "make-fcebfd37-audit-documents";
const initializeStorage = async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === bucketName);
    if (!bucketExists) {
      await supabase.storage.createBucket(bucketName, {
        public: false,
      });
    }
  } catch (error) {
    // Storage initialization failed - continue without logging
  }
};

initializeStorage();

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
      return false;
    }

    return true;
  } catch (error) {
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

// Helper function to get user from session token or auth token
const getUserFromToken = async (authHeader: string | undefined) => {
  if (!authHeader) {
    console.log("getUserFromToken - No auth header provided");
    return null;
  }

  const token = authHeader.split(" ")[1];
  console.log("getUserFromToken - Token:", token.substring(0, 20) + "...");

  // Check if it's an OTP session token
  if (token.startsWith("otp_session_")) {
    console.log("getUserFromToken - OTP session token detected");
    try {
      const sessionData: SessionToken | null = await kv.get(token);
      console.log("getUserFromToken - Session data:", sessionData);

      if (sessionData) {
        // Check if session is expired
        const expiresAt = new Date(sessionData.expires_at);
        const now = new Date();
        console.log(
          "getUserFromToken - Session expires:",
          expiresAt,
          "Current time:",
          now
        );

        if (now > expiresAt) {
          console.log("getUserFromToken - Session expired, deleting");
          await kv.del(token);
          return null;
        }
        console.log(
          "getUserFromToken - Returning user ID:",
          sessionData.user_id
        );
        return { id: sessionData.user_id };
      }
      console.log("getUserFromToken - No session data found");
      return null;
    } catch (error) {
      console.error("Error getting session from KV store:", error);
      return null;
    }
  }

  // Otherwise, try to get user from Supabase auth token
  console.log("getUserFromToken - Using Supabase auth token");
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error) {
      console.error("getUserFromToken - Supabase auth error:", error);
    }
    return user;
  } catch (error) {
    console.error("Error getting user from auth token:", error);
    return null;
  }
};

// Helper function for authentication
const authenticateUser = async (authHeader: string | undefined) => {
  const user = await getUserFromToken(authHeader);
  return { user, error: !user?.id ? "Unauthorized" : null };
};

// OTP generation and sending for login (existing users)
app.post("/send-otp", async (c: Context) => {
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ error: "Email is required" }, 400);

    const okDomain = /^[^\s@]+@ecobank\.com$/i;
    if (!okDomain.test(email)) {
      return c.json(
        { error: "Please use your Ecobank email address (@ecobank.com)" },
        400
      );
    }

    // Check if user exists (login is for existing accounts)
    const allUsers: UserProfile[] = await kv.getByPrefix("user:");
    const existingUser = allUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!existingUser) {
      return c.json(
        {
          error: "Account not found. Please sign up first.",
        },
        404
      );
    }

    // Generate & store login OTP (10 mins)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `login_otp:${email.toLowerCase()}`;

    await kv.set(otpKey, {
      code: otp,
      email,
      user_id: existingUser.id, // Store user ID for login
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verified: false,
    } satisfies OTPRecord);

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, 'login');
    
    if (!emailSent) {
      return c.json({ error: "Failed to send login OTP email" }, 500);
    }

    return c.json({
      success: true,
      message: "Login OTP sent successfully",
    });
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// OTP generation and sending for signup
app.post("/send-signup-otp", async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ error: "Email is required" }, 400);

    const okDomain = /^[^\s@]+@ecobank\.com$/i;
    if (!okDomain.test(email)) {
      return c.json(
        { error: "Please use your Ecobank email address (@ecobank.com)" },
        400
      );
    }

    // Check if user already exists (signup is for new accounts)
    const allUsers: UserProfile[] = await kv.getByPrefix("user:");
    const existingUser = allUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (existingUser) {
      return c.json(
        {
          error:
            "An account with this email already exists. Please log in instead.",
        },
        400
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
      return c.json({ error: "Failed to send verification email" }, 500);
    }

    return c.json({
      success: true,
      message: "SignUp OTP sent successfully",
    });
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Verify OTP and complete login
app.post("/verify-login-otp", async (c: Context) => {
  try {
    const { email, otp } = await c.req.json();

    if (!email || !otp) {
      return c.json({ error: "Email and OTP are required" }, 400);
    }

    const otpKey = `login_otp:${email.toLowerCase()}`;
    const rec: OTPRecord | null = await kv.get(otpKey);

    if (!rec) {
      return c.json({ error: "Invalid or expired login code" }, 400);
    }

    if (new Date() > new Date(rec.expires_at)) {
      await kv.del(otpKey);
      return c.json(
        { error: "Login code has expired. Please request a new one." },
        400
      );
    }

    if (rec.verified) {
      return c.json({ error: "Login code has already been used" }, 400);
    }

    if (rec.code !== otp) {
      return c.json({ error: "Invalid login code" }, 400);
    }

    let userProfile: UserProfile | null = null;
    if (rec.user_id) userProfile = await kv.get(`user:${rec.user_id}`);
    if (!userProfile) {
      const allUsers: UserProfile[] = await kv.getByPrefix("user:");
      userProfile =
        allUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) ||
        null;
    }
    if (!userProfile) return c.json({ error: "User profile not found" }, 404);

    // Create OTP session (1 hour)
    const sessionToken = `otp_session_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 16)}`;
    await kv.set(sessionToken, {
      user_id: userProfile.id,
      email,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      login_method: "otp",
    } satisfies SessionToken);

    await kv.del(otpKey); // one-time use

    await kv.set(`audit_log:${Date.now()}:${userProfile.id}`, {
      action: "user_login_otp",
      user_id: userProfile.id,
      timestamp: new Date().toISOString(),
      details: { email, login_method: "otp" },
    });

    return c.json({
      success: true,
      user: userProfile,
      session_token: sessionToken,
    });
  } catch (e) {
    console.error("Error verifying login OTP:", e);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Verify OTP and complete signup
app.post("/verify-otp-signup", async (c) => {
  try {
    const { email, otp, name, role } = await c.req.json();

    if (!email || !otp || !name) {
      return c.json({ error: "Email, OTP, and name are required" }, 400);
    }
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
    const existingUser = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return c.json(
        {
          error:
            "An account with this email already exists. Please log in instead.",
        },
        400
      );
    }

    // Retrieve stored OTP
    const otpKey = `signup_otp:${email.toLowerCase()}`;
    const storedOtpData: OTPRecord | null = await kv.get(otpKey);

    if (!storedOtpData) {
      return c.json({ error: "Invalid or expired OTP" }, 400);
    }

    // Check if OTP is expired
    const expiresAt = new Date(storedOtpData.expires_at);
    if (new Date() > expiresAt) {
      await kv.del(otpKey);
      return c.json(
        { error: "OTP has expired. Please request a new one." },
        400
      );
    }

    // Verify OTP
    if (storedOtpData.code !== otp) {
      return c.json({ error: "Invalid OTP" }, 400);
    }

    // Check if OTP was already used
    if (storedOtpData.verified) {
      return c.json({ error: "OTP has already been used" }, 400);
    }

    // Create user account
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true, // Auto-confirm since we verified via OTP
        user_metadata: {
          name: name.trim(),
          role: userRole,
        },
      });

    if (authError) {
      return c.json({ error: "Failed to create user account" }, 500);
    }

    // Store user profile in KV store
    const userId = authUser.user.id;
    await kv.set(`user:${userId}`, {
      id: userId,
      email: email,
      name: name.trim(),
      role: userRole,
      created_at: new Date().toISOString(),
      email_verified: true,
    });

    // Mark OTP as verified and delete it
    await kv.del(otpKey);

    // Check for pending requests assigned to this email (only for auditees)
    let pendingRequestsCount = 0;
    if (userRole === "auditee") {
      const allRequests: Request[] = await kv.getByPrefix("request:");
      const pendingRequests = allRequests.filter(
        (req) =>
          req.assigned_to_email === email && req.pending_assignment === true
      );

      // Update pending requests to assign them to the new user
      for (const request of pendingRequests) {
        const updatedRequest: Request = {
          ...request,
          assigned_to: userId,
          pending_assignment: false,
          updated_at: new Date().toISOString(),
        };
        await kv.set(`request:${request.id}`, updatedRequest);

        // Log automatic assignment
        await kv.set(`audit_log:${Date.now()}:${userId}`, {
          action: "auto_assigned_request",
          user_id: userId,
          request_id: request.id,
          timestamp: new Date().toISOString(),
          details: {
            email,
            request_title: request.title,
            created_by: request.created_by,
          },
        });
      }

      pendingRequestsCount = pendingRequests.length;
    }

    // Log user creation
    await kv.set(`audit_log:${Date.now()}:${userId}`, {
      action: "user_created",
      user_id: userId,
      timestamp: new Date().toISOString(),
      details: { email, name: name.trim(), role: userRole },
    });


    return c.json({
      success: true,
      user: {
        id: userId,
        email: email,
        name: name.trim(),
        role: userRole,
      },
      pending_requests_assigned: pendingRequestsCount,
    });
  } catch (error) {
    console.error("Error verifying OTP and creating user:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get user profile
app.get("/make-server-fcebfd37/profile", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const user = await getUserFromToken(authHeader);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);

    if (!userProfile) {
      return c.json({ error: "User profile not found" }, 404);
    }

    return c.json({ user: userProfile });
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Create document request
app.post("/make-server-fcebfd37/requests", async (c) => {
  try {
    const { user, error } = await authenticateUser(
      c.req.header("Authorization")
    );

    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    if (
      !userProfile ||
      (userProfile.role !== "auditor" && userProfile.role !== "manager")
    ) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    const {
      title,
      description,
      due_date,
      assigned_to_email,
      department,
      cc_emails,
      hr_confidential,
    } = await c.req.json();

    if (
      !title ||
      !description ||
      !due_date ||
      !assigned_to_email ||
      !department
    ) {
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
      .slice(2, 11)}`;
    const request: Request = {
      id: requestId,
      title,
      description,
      due_date,
      status: "in_progress",
      created_by: user.id,
      assigned_to: assignedUserId,
      assigned_to_email,
      department,
      cc_emails: cc_emails || [],
      hr_confidential: hr_confidential || false,
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

    return c.json({ request, success: true });
  } catch (error) {
    return c.json(
      { error: "Internal server error while creating request" },
      500
    );
  }
});

// Get requests (filtered by user role)
app.get("/make-server-fcebfd37/requests", async (c) => {
  try {
    const { user, error } = await authenticateUser(
      c.req.header("Authorization")
    );

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
          (req.pending_assignment &&
            req.assigned_to_email === userProfile.email)
      );
    }

    return c.json({ requests: filteredRequests });
  } catch (error) {
    return c.json(
      { error: "Internal server error while fetching requests" },
      500
    );
  }
});

// Upload document for a request
app.post("/make-server-fcebfd37/upload", async (c: Context) => {
  try {
    const { user, error } = await authenticateUser(
      c.req.header("Authorization")
    );

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
      (request.pending_assignment &&
        request.assigned_to_email === userProfile?.email) ||
      userProfile?.role === "auditor";

    if (!hasAccess) {
      return c.json({ error: "Access denied to this request" }, 403);
    }

    // If this is a pending assignment, resolve it now
    if (
      request.pending_assignment &&
      request.assigned_to_email === userProfile?.email
    ) {
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
      return c.json({ error: "Failed to upload file" }, 500);
    }

    // Create signed URL for the file
    const { data: signedUrlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    // Store document metadata
    const documentId: string = `doc_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 11)}`;
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
    return c.json({ error: "Internal server error during upload" }, 500);
  }
});

// Get documents for a request
app.get("/make-server-fcebfd37/requests/:requestId/documents", async (c) => {
  try {
    const { user, error } = await authenticateUser(
      c.req.header("Authorization")
    );

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
      (request.pending_assignment &&
        request.assigned_to_email === userProfile?.email) ||
      userProfile?.role === "auditor" ||
      userProfile?.role === "manager";

    if (!hasAccess) {
      return c.json({ error: "Access denied to this request" }, 403);
    }

    // Special handling for HR department requests - auditors cannot access documents
    if (
      request.department === "Human Resources" &&
      userProfile?.role === "auditor"
    ) {
      return c.json(
        {
          error:
            "Access denied to confidential HR department documents. Contact your manager for access.",
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
    return c.json(
      { error: "Internal server error while fetching documents" },
      500
    );
  }
});

// Update request status
app.put("/make-server-fcebfd37/requests/:requestId/status", async (c) => {
  try {
    const { user, error } = await authenticateUser(
      c.req.header("Authorization")
    );

    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const requestId = c.req.param("requestId");
    const { status } = await c.req.json();

    if (!status) {
      return c.json({ error: "Status is required" }, 400);
    }

    const request: Request | null = await kv.get(`request:${requestId}`);
    if (!request) {
      return c.json({ error: "Request not found" }, 404);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    if (
      !userProfile ||
      (userProfile.role !== "auditor" && userProfile.role !== "manager")
    ) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    // Special handling for HR department requests
    if (
      request.department === "Human Resources" &&
      userProfile?.role === "auditor"
    ) {
      return c.json(
        {
          error:
            "Access denied. Only managers can update status for confidential HR department requests.",
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

    return c.json({ request: updatedRequest, success: true });
  } catch (error) {
    return c.json(
      { error: "Internal server error while updating status" },
      500
    );
  }
});

// Get audit logs
app.get("/make-server-fcebfd37/audit-logs", async (c) => {
  try {
    const { user, error } = await authenticateUser(
      c.req.header("Authorization")
    );

    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== "auditor" && userProfile?.role !== "manager") {
      return c.json({ error: "Access denied to audit logs" }, 403);
    }

    const auditLogs: AuditLog[] = await kv.getByPrefix("audit_log:");
    const sortedLogs = auditLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return c.json({ logs: sortedLogs });
  } catch (error) {
    return c.json(
      { error: "Internal server error while fetching audit logs" },
      500
    );
  }
});

// Send departmental analysis report via email
app.post("/make-server-fcebfd37/send-report", async (c) => {
  try {
    const { user, error } = await authenticateUser(
      c.req.header("Authorization")
    );

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
      const success = await sendEmailViaSupabase([to], subject, emailBody);
      if (!success) {
        return c.json({ error: "Failed to send report email" }, 500);
      }
    } catch (err) {
      return c.json({ error: "Error while sending report email" }, 500);
    }

    // Store metadata in KV (audit trail)
    const emailId = `email_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 11)}`;
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
    return c.json({ error: "Internal server error while sending email" }, 500);
  }
});

// Get emails for debugging (managers/auditors only)
app.get("/make-server-fcebfd37/emails", async (c) => {
  try {
    const { user, error } = await authenticateUser(
      c.req.header("Authorization")
    );

    if (!user?.id || error) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userProfile: UserProfile | null = await kv.get(`user:${user.id}`);
    if (userProfile?.role !== "auditor" && userProfile?.role !== "manager") {
      return c.json({ error: "Access denied to email logs" }, 403);
    }

    const emails: EmailRecord[] = await kv.getByPrefix("email:");
    const sortedEmails = emails
      .sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      )
      .slice(0, 50); // limit to 50 most recent

    return c.json({ emails: sortedEmails });
  } catch (error) {
    return c.json(
      { error: "Internal server error while fetching emails" },
      500
    );
  }
});


// Start the server
Deno.serve(app.fetch);
