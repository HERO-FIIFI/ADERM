import React, { useState } from 'react';
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

interface SignupProps {
  onSignup: (email: string, password: string, name: string, role: string) => Promise<{ success: boolean; error?: string }>;
}

export function Signup({ onSignup }: SignupProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useOtpVerification, setUseOtpVerification] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !name || !role) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    // Validate @ecobank.com email domain
    const ecobankEmailRegex = /^[^\s@]+@ecobank\.com$/;
    if (!ecobankEmailRegex.test(email)) {
      setError('Please use your Ecobank email address (@ecobank.com)');
      setLoading(false);
      return;
    }

    if (useOtpVerification) {
      // OTP verification flow
      if (!otpSent) {
        // Send OTP for verification
        try {
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/send-otp`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
          });

          const data = await response.json();

          if (response.ok) {
            setOtpSent(true);
            toast.success('OTP sent to your email for verification');
          } else {
            setError(data.error || 'Failed to send OTP');
          }
        } catch (error: any) {
          console.error('Error sending OTP:', error);
          setError('Failed to send OTP. Please try again.');
        }
      } else {
        // Verify OTP and create account
        if (otp.length !== 6) {
          setError('Please enter the complete 6-digit OTP');
          setLoading(false);
          return;
        }

        // For OTP signup of managers/auditors, we'll use a different approach
        // First verify the OTP, then create the account with password
        try {
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/verify-otp-signup`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              email, 
              otp, 
              name,
              role // This will override the auditee role in the server for manager/auditor
            })
          });

          const data = await response.json();

          if (response.ok) {
            toast.success('Account created successfully! Please log in.');
            resetForm();
          } else {
            setError(data.error || 'Failed to verify OTP and create account');
          }
        } catch (error: any) {
          console.error('Error verifying OTP for signup:', error);
          setError('Failed to verify OTP. Please try again.');
        }
      }
    } else {
      // Regular password signup
      if (!password) {
        setError('Please enter a password');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        setLoading(false);
        return;
      }

      const result = await onSignup(email, password, name, role);
      
      if (result.success) {
        toast.success('Account created successfully! Please log in.');
        resetForm();
      } else {
        setError(result.error || 'Signup failed');
      }
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setRole('');
    setOtp('');
    setOtpSent(false);
    setUseOtpVerification(false);
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/send-otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('New OTP sent to your email');
        setOtp('');
      } else {
        setError(data.error || 'Failed to resend OTP');
      }
    } catch (error: any) {
      console.error('Error resending OTP:', error);
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserPlus className="h-5 w-5 mr-2" />
          Create ADERM Account
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Verification Method Selection (only show if not sent OTP yet) */}
          {!otpSent && (
            <div className="space-y-2">
              <Label>Account Verification</Label>
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <Button
                  type="button"
                  variant={!useOtpVerification ? "default" : "ghost"}
                  onClick={() => setUseOtpVerification(false)}
                  className="flex-1 text-sm"
                  size="sm"
                >
                  Password
                </Button>
                <Button
                  type="button"
                  variant={useOtpVerification ? "default" : "ghost"}
                  onClick={() => setUseOtpVerification(true)}
                  className="flex-1 text-sm"
                  size="sm"
                >
                  <Shield className="h-4 w-4 mr-1" />
                  OTP
                </Button>
              </div>
              <p className="text-xs text-gray-600">
                {useOtpVerification 
                  ? "We'll send a verification code to your email" 
                  : "Create an account with a password"
                }
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              disabled={otpSent}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@ecobank.com"
              required
              disabled={otpSent}
            />
          </div>

          {!useOtpVerification && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a strong password"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} required disabled={otpSent}>
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

          {useOtpVerification && otpSent && (
            <div className="space-y-2">
              <Label>Enter 6-digit OTP</Label>
              <div className="text-sm text-gray-600 mb-2">
                Verification code sent to: <span className="font-medium">{email}</span>
              </div>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => setOtp(value)}
                >
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
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || (useOtpVerification && otpSent && otp.length !== 6)}
          >
            {loading ? (
              useOtpVerification && !otpSent ? 'Sending OTP...' :
              useOtpVerification && otpSent ? 'Verifying & Creating Account...' : 'Creating account...'
            ) : (
              useOtpVerification && !otpSent ? (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Verification Code
                </>
              ) :
              useOtpVerification && otpSent ? 'Verify & Create Account' : 'Create Account'
            )}
          </Button>

          {useOtpVerification && otpSent && (
            <div className="space-y-2">
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
              <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                onClick={() => {
                  setOtpSent(false);
                  setOtp('');
                  setError('');
                }}
              >
                Change Email or Method
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}