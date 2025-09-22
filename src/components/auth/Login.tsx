import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Mail, KeyRound, Shield } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

type Step = 'email' | 'otp';

export default function Login() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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

  const sendCode = async () => {
    setErr(null);
    setInfo(null);

    const emailTrim = email.trim();
    if (!emailTrim) return setErr('Enter your email address.');
    if (!ecobankRegex.test(emailTrim)) return setErr('Use your @ecobank.com address.');

    try {
      setLoading(true);
      const resp = await fetch(`${baseUrl}/send-otp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          origin: window.location.origin,
        },
        body: JSON.stringify({ email: emailTrim }),
      });

      const data = await safeJson(resp);

      if (!resp.ok) {
        if (resp.status === 404) {
          setErr('Account not found. Please sign up first.');
        } else {
          setErr(data?.error || 'Failed to send login code.');
        }
        return;
      }

      setStep('otp');
      setInfo(`We sent a 6-digit code to ${emailTrim}.`);
      setResendCountdown(60); // throttle per minute
    } catch (e: any) {
      console.error('send-otp error:', e);
      setErr('Failed to send login code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setErr(null);
    setInfo(null);

    const emailTrim = email.trim();
    const code = otp.trim();

    if (!emailTrim || !code) return setErr('Enter the code we emailed to you.');
    if (code.length !== 6 || !/^\d{6}$/.test(code)) return setErr('Code must be 6 digits.');

    try {
      setLoading(true);
      const resp = await fetch(`${baseUrl}/verify-login-otp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          origin: window.location.origin,
        },
        body: JSON.stringify({ email: emailTrim, otp: code }),
      });

      const data = await safeJson(resp);

      if (!resp.ok) {
        setErr(data?.error || 'Invalid or expired code.');
        return;
      }

      // Expecting: { success: true, user: { id, email, name, role }, session_token }
      const { user, session_token } = data || {};
      if (!user?.id || !session_token) {
        setErr('Unexpected server response.');
        return;
      }

      // Store your custom session (KV-backed) – adjust as needed
      localStorage.setItem(
        'aderm_session',
        JSON.stringify({
          token: session_token,
          user,
          issued_at: Date.now(),
        })
      );

      // Role-based navigation
      const role = String(user.role || '').toLowerCase();
      if (role === 'auditee') {
        window.location.href = '/auditee';
      } else if (role === 'manager') {
        window.location.href = '/manager';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (e: any) {
      console.error('verify-login-otp error:', e);
      setErr('Failed to verify code.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (resendCountdown > 0 || loading) return;
    await sendCode();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Shield className="h-10 w-10 text-blue-600 mr-2" />
            <h1 className="text-3xl font-bold text-gray-900">ADERM</h1>
          </div>
          <CardTitle className="text-lg text-gray-600">
            {step === 'email' ? 'Sign in with your work email' : 'Enter the 6-digit code'}
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

          {step === 'email' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.name@ecobank.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <Button onClick={sendCode} disabled={loading} className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                {loading ? 'Sending…' : 'Send login code'}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Only @ecobank.com emails are allowed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">6-digit code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(v);
                  }}
                />
              </div>

              <Button onClick={verifyCode} disabled={loading || otp.length !== 6} className="w-full">
                <KeyRound className="h-4 w-4 mr-2" />
                {loading ? 'Verifying…' : 'Verify & Continue'}
              </Button>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <button
                  type="button"
                  className="underline disabled:no-underline disabled:text-gray-400"
                  onClick={resendCode}
                  disabled={resendCountdown > 0 || loading}
                >
                  Resend code
                </button>
                {resendCountdown > 0 && (
                  <span>Resend available in {resendCountdown}s</span>
                )}
              </div>

              <p className="text-xs text-gray-500 text-center">
                Code expires in 10 minutes. Don’t share it with anyone.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
