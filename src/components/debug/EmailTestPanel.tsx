import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Mail, CheckCircle, Clock, User } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface EmailTestPanelProps {
  accessToken: string;
}

export function EmailTestPanel({ accessToken }: EmailTestPanelProps) {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const fetchEmails = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/emails`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails || []);
      } else {
        setError('Failed to fetch emails');
      }
    } catch (error: any) {
      console.error('Error fetching emails:', error);
      setError('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  };

  const testOtpSend = async () => {
    if (!testEmail || !testEmail.includes('@ecobank.com')) {
      setError('Please enter a valid @ecobank.com email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/send-otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: testEmail })
      });

      const data = await response.json();

      if (response.ok) {
        setError('');
        // Refresh emails to show the new OTP email
        await fetchEmails();
        alert('✅ OTP sent successfully!\n\n🔍 Check the server console logs for the 6-digit OTP code.\n📧 The email has been logged and stored in the system.');
      } else {
        setError(`Failed to send OTP: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Error sending test OTP:', error);
      setError('Failed to send test OTP');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEmails();
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mail className="h-5 w-5 mr-2" />
          Email System Test Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Test OTP Sending */}
        <div className="space-y-4">
          <h3 className="font-medium">Test OTP Email Sending</h3>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="test@ecobank.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={testOtpSend} disabled={loading}>
              {loading ? 'Sending...' : 'Send Test OTP'}
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            This will trigger an OTP email. Check the server console for the OTP code since we're in demo mode.
          </p>
        </div>

        {/* Email Log Display */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Email Log (Last 10 emails)</h3>
            <Button variant="outline" size="sm" onClick={fetchEmails} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {emails.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No emails found in the system yet.</p>
              <p className="text-sm">Create a document request to trigger email notifications.</p>
            </div>
          )}

          <div className="space-y-3">
            {emails.slice(0, 10).map((email) => (
              <div key={email.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{email.to}</span>
                    <Badge variant="outline" className="text-xs">
                      {email.email_type || 'general'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{email.status}</span>
                    <Clock className="h-4 w-4" />
                    <span>{new Date(email.sent_at).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="font-medium text-sm">{email.subject}</div>
                  <div className="text-sm text-gray-600 bg-white p-2 rounded border max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-xs">{email.body}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            <strong>Demo Mode:</strong> Emails are logged to the console and stored in the database for testing. 
            In production, these would be sent via an email service like SendGrid, AWS SES, or similar.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}