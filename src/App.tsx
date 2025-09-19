import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabase/client';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { Login } from './components/auth/Login';
import { Signup } from './components/auth/Signup';
import { PasswordReset } from './components/auth/PasswordReset';
import { AuditeeOtpSignup } from './components/auth/AuditeeOtpSignup';
import { AuditorDashboard } from './components/dashboard/AuditorDashboard';
import { AuditeeDashboard } from './components/dashboard/AuditeeDashboard';
import { ManagerDashboard } from './components/dashboard/ManagerDashboard';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Shield, FileText, Users } from 'lucide-react';
import { Toaster } from './components/ui/sonner';



interface User {
  id: string;
  email: string;
  name: string;
  role: 'auditor' | 'auditee' | 'manager';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'auditee-signup'>('login');
  
  // Check if this is a password reset flow
  const isPasswordReset = window.location.pathname === '/reset-password' || 
                          window.location.hash.includes('type=recovery');

  // Check URL parameters for auditee signup
  const urlParams = new URLSearchParams(window.location.search);
  const urlMode = urlParams.get('mode');
  const prefilledEmail = urlParams.get('email') || '';

  // Set initial auth mode based on URL
  useEffect(() => {
    if (urlMode === 'auditee-signup') {
      setAuthMode('auditee-signup');
    }
  }, [urlMode]);

  useEffect(() => {
    checkUser();
    
    // Listen for auth state changes (including password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.access_token) {
          await fetchUserProfile(session.access_token);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setAccessToken(null);
        } else if (event === 'PASSWORD_RECOVERY') {
          // User clicked on password reset email link
          console.log('Password recovery event detected');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetchUserProfile(session.access_token);
      }
    } catch (error) {
      console.error('Error checking user session:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setAccessToken(token);
      } else {
        console.error('Failed to fetch user profile');
        setUser(null);
        setAccessToken(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
      setAccessToken(null);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session?.access_token) {
        await fetchUserProfile(data.session.access_token);
        return { success: true };
      }
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };



  const handleAuditeeSignupComplete = async (userProfile: User) => {
    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // For auditee OTP signup, we need to get a session
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session?.access_token) {
        setUser(userProfile);
        setAccessToken(session.access_token);
      } else {
        console.error('No session after OTP signup');
        // Redirect to login
        setAuthMode('login');
      }
    } catch (error) {
      console.error('Error getting session after OTP signup:', error);
      setAuthMode('login');
    }
  };

  const handleSignup = async (email: string, password: string, name: string, role: string) => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/signup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name, role })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle password reset flow
  if (isPasswordReset) {
    return <PasswordReset />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-12 w-12 text-blue-600 mr-2" />
              <h1 className="text-4xl font-bold text-gray-900">ADERM</h1>
            </div>
            <p className="text-xl text-gray-600 mb-2">Audit Document Exchange & Request Management Platform</p>
            <p className="text-gray-500">Secure, compliant, and efficient audit document management</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-blue-600" />
                  For Auditors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Create and manage document requests</li>
                  <li>• Track submission progress</li>
                  <li>• Secure file storage and access</li>
                  <li>• Complete audit trail</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-green-600" />
                  For Auditees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• View assigned requests</li>
                  <li>• Upload documents securely</li>
                  <li>• Add comments and context</li>
                  <li>• Track submission status</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="max-w-md mx-auto">
            {authMode === 'auditee-signup' ? (
              <AuditeeOtpSignup 
                onSignupComplete={handleAuditeeSignupComplete}
                onBack={() => setAuthMode('login')}
                prefilledEmail={prefilledEmail}
              />
            ) : (
              <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as 'login' | 'signup')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <Login onLogin={handleLogin} />
                </TabsContent>
                <TabsContent value="signup">
                  <Signup onSignup={handleSignup} />
                </TabsContent>
              </Tabs>
            )}
            
            {authMode !== 'auditee-signup' && (
              <div className="text-center mt-4">
                <Button 
                  variant="link" 
                  onClick={() => setAuthMode('auditee-signup')}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  New auditee? Register with email verification →
                </Button>
              </div>
            )}
          </div>
        </div>
        <Toaster />
      </div>
    );
  }

  const renderDashboard = () => {
    switch (user.role) {
      case 'auditor':
        return <AuditorDashboard user={user} accessToken={accessToken!} />;
      case 'auditee':
        return <AuditeeDashboard user={user} accessToken={accessToken!} />;
      case 'manager':
        return <ManagerDashboard user={user} accessToken={accessToken!} />;
      default:
        return <div>Invalid user role</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">ADERM</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="text-gray-500">Welcome,</span>
                <span className="font-medium text-gray-900 ml-1">{user.name}</span>
                <span className="text-gray-400 ml-1">({user.role})</span>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderDashboard()}
      </main>
      <Toaster />
    </div>
  );
}