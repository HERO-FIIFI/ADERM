import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { UserPlus, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

type Step = 'form' | 'otp';

interface SignupProps {
  // kept for backward-compat; not used in OTP flow
  onSignup?: (email: string, password: string, name: string, role: string) => Promise<{ success: boolean; error?: string }>;
}

export function Signup(_props: SignupProps) {
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0); // seconds

  const baseUrl = useMemo(
    () => `https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37`,
    []
  );
  const ecobankRegex = /^[^\s@]+@ecobank\.com$/i;

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setInterval(() => setResendCountdown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendCountdown]);

  async function sendSignupOtp() {
    setErr(null);
    setInfo(null);

    const emailTrim = email.trim();
    const nameTrim = name.trim();

    if (!emailTrim || !nameTrim || !role) {
      setErr('Please fill in email, full name, and role.');
      return;
    }
    if (!ecobankRegex.test(emailTrim)) {
      setErr('Please use your Ecobank email address (@ecobank.com).');
      return;
    }

    try {
      setLoading(true);
      // send OTP for signup
      const resp = await fetch(`${baseUrl}/send-signup-otp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          origin: window.location.origin,
        },
        // backend only needs email to send OTP
        body: JSON.stringify({ email: emailTrim.toLowerCase() }),
      });

      const data = await safeJson(resp);

      if (!resp.ok) {
        setErr(data?.error || 'Failed to send verification code.');
        return;
      }

      setOtpSent(true);
      setStep('otp');
      setInfo(`We sent a 6-digit code to ${emailTrim}.`);
      setResendCountdown(60);
      toast.success('OTP sent to your email.');
    } catch (e: any) {
      console.error('send-signup-otp error:', e);
      setErr('Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndCreate() {
    setErr(null);
    setInfo(null);

    const emailTrim = email.trim().toLowerCase();
    const nameTrim = name.trim();
    const code = otp.trim();

    if (!emailTrim || !nameTrim || !role) {
      setErr('Please fill in email, full name, and role.');
      return;
    }
    if (!ecobankRegex.test(emailTrim)) {
      setErr('Please use your Ecobank email address (@ecobank.com).');
      return;
    }
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setErr('Code must be 6 digits.');
      return;
    }

    try {
      setLoading(true);
      const resp = await fetch(`${baseUrl}/verify-otp-signup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          origin: window.location.origin,
        },
        body: JSON.stringify({
          email: emailTrim,
          otp: code,
          name: nameTrim,
          role, // 'auditor' | 'auditee' | 'manager'
        }),
      });

      const data = await safeJson(resp);

      if (!resp.ok) {
        setErr(data?.error || 'Failed to verify OTP and create account.');
        return;
      }

      toast.success('Account created successfully! You can log in now.');
      // You can route by role if desired:
      // if (role === 'auditee') window.location.href = '/auditee';
      // else window.location.href = '/login';
      window.location.href = '/login';
    } catch (e: any) {
      console.error('verify-otp-signup error:', e);
      setErr('Failed to verify code.');
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (resendCountdown > 0 || loading) return;
    // just call sendSignupOtp again; keep name/role as-is
    await sendSignupOtp();
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserPlus className="h-5 w-5 mr-2" />
          Create ADERM Account
        </CardTitle>
      </CardHeader>
      <CardContent>
        {err && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
        {info && (
          <Alert className="mb-4">
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@ecobank.com"
                autoComplete="email"
                disabled={loading || otpSent}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                disabled={loading || otpSent}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole} disabled={loading || otpSent} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auditor">Internal Auditor</SelectItem>
                  <SelectItem value="auditee">Auditee (Client Department)</SelectItem>
                  <SelectItem value="manager">Manager/Head</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={sendSignupOtp} disabled={loading} className="w-full">
              <Mail className="h-4 w-4 mr-2" />
              {loading ? 'Sending…' : 'Send verification code'}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              We’ll email a 6-digit code to verify your address.
            </p>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Verification code sent to: <span className="font-medium">{email}</span>
            </div>

            <div className="space-y-2">
              <Label>Enter 6-digit code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={(v: string) => setOtp(v)}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-xs text-gray-500 text-center">Code expires in 10 minutes.</p>
            </div>

            <Button
              onClick={verifyAndCreate}
              disabled={loading || otp.length !== 6 || !name.trim() || !role}
              className="w-full"
            >
              <Shield className="h-4 w-4 mr-2" />
              {loading ? 'Verifying…' : 'Verify & Create Account'}
            </Button>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <button
                type="button"
                className="underline disabled:no-underline disabled:text-gray-400"
                onClick={resendOtp}
                disabled={resendCountdown > 0 || loading}
              >
                Resend code
              </button>
              {resendCountdown > 0 && <span>Resend available in {resendCountdown}s</span>}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setStep('form');
                setOtp('');
                setOtpSent(false);
                setInfo(null);
                setErr(null);
              }}
            >
              Change details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Safely parse JSON response */
async function safeJson(resp: Response) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}
