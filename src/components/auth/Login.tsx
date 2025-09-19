import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { LogIn } from 'lucide-react';
import { ForgotPassword } from './ForgotPassword';
import { toast } from 'sonner@2.0.3';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate @ecobank.com email domain
    const ecobankEmailRegex = /^[^\s@]+@ecobank\.com$/;
    if (!ecobankEmailRegex.test(email)) {
      setError('Please use your Ecobank email address (@ecobank.com)');
      setLoading(false);
      return;
    }

    // Regular password login
    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    const result = await onLogin(email, password);
    
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
    
    setLoading(false);
  };



  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <LogIn className="h-5 w-5 mr-2" />
          Login to ADERM
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <div className="text-center">
            <Button 
              type="button" 
              variant="link" 
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Forgot your password?
            </Button>
          </div>
        </form>

        <ForgotPassword 
          open={showForgotPassword} 
          onOpenChange={setShowForgotPassword} 
        />
      </CardContent>
    </Card>
  );
}