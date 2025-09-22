import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { Mail, Shield, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface AuditeeOtpSignupProps {
  onSignupComplete: (user: any) => void;
  onBack: () => void;
  prefilledEmail?: string;
}

export function AuditeeOtpSignup({ onSignupComplete, onBack, prefilledEmail }: AuditeeOtpSignupProps) {
  const [step, setStep] = useState<'email' | 'otp' | 'profile'>('email');
  const [email, setEmail] = useState(prefilledEmail || '');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    if (prefilledEmail) setEmail(prefilledEmail);
  }, [prefilledEmail]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }
    const ecobankEmailRegex = /^[^\s@]+@ecobank\.com$/i;
    if (!ecobankEmailRegex.test(email)) {
      setError('Please use your Ecobank email address (@ecobank.com)');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/send-signup-otp`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
            origin: window.location.origin,
          },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setOtpSent(true);
        setStep('otp');
        toast.success('OTP sent to your email. Please check your inbox.');
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    setStep('profile');
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/verify-otp-signup`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
            origin: window.location.origin,
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            otp: otp.trim(),
            name: name.trim(),
            role: 'auditee', // explicit; backend also defaults to auditee
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setPendingRequestsCount(data.pending_requests_assigned || 0);
        toast.success('Account created successfully! Welcome to ADERM.');

        const userProfile = {
          id: data.user.id,
          email: email.trim().toLowerCase(),
          name: name.trim(),
          role: 'auditee',
        };

        onSignupComplete(userProfile);
      } else {
        setError(data.error || 'Failed to verify OTP and create account');
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/send-signup-otp`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
            origin: window.location.origin,
          },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        toast.success('New OTP sent to your email');
        setOtp('');
      } else {
        setError(data.error || 'Failed to resend OTP');
      }
    } catch (err) {
      console.error('Error resending OTP:', err);
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-600" />
            <CardTitle>Auditee Registration</CardTitle>
          </div>
          {step === 'email' && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
        </div>
        <CardDescription>
          {step === 'email' && 'Enter your Ecobank email to get started'}
          {step === 'otp' && 'Enter the verification code sent to your email'}
          {step === 'profile' && 'Complete your profile to finish registration'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@ecobank.com"
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Mail className="h-4 w-4 mr-2 animate-pulse" />
                  Sending OTP...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send OTP
                </>
              )}
            </Button>

            <div className="text-sm text-gray-600 text-center">
              You'll receive a 6-digit verification code at your email address
            </div>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-center">
              <div className="text-sm text-gray-600 mb-4">
                Verification code sent to:
                <div className="font-medium text-gray-900">{email}</div>
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
              </div>
            </div>

            <div className="space-y-2">
              <Button type="submit" className="w-full" disabled={otp.length !== 6}>
                Verify Code
              </Button>
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-sm"
                >
                  Didn't receive the code? Resend
                </Button>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setStep('email')}
            >
              Change Email Address
            </Button>
          </form>
        )}

        {/* Step 3: Profile */}
        {step === 'profile' && (
          <form onSubmit={handleCompleteSignup} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-center text-sm text-green-600 mb-4">✓ Email verified successfully</div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
                disabled={loading}
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <div className="font-medium text-blue-900 mb-1">Account Details:</div>
              <div className="text-blue-700">
                Email: {email}
                <br />
                Role: Auditee (Document Submitter)
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </Button>

            {pendingRequestsCount > 0 && (
              <Alert className="mt-4">
                <AlertDescription>
                  Great! You have {pendingRequestsCount} pending document request(s) waiting for you.
                  You'll be able to access them once you complete the registration.
                </AlertDescription>
              </Alert>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
