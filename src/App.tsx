import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabase/client';
import { projectId, publicAnonKey } from './utils/supabase/info';
import  Login from './components/auth/Login';
import { Signup } from './components/auth/Signup';
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
  }, []);

  const checkUser = async () => {
    try {
      // Check for custom OTP session first
      const storedSession = localStorage.getItem('aderm_session');
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        const { token, user: storedUser, issued_at } = sessionData;
        
        // Check if session is still valid (e.g., 1 hour expiry)
        const sessionAge = Date.now() - issued_at;
        const SESSION_DURATION = 60 * 60 * 1000; // 1 hour
        
        if (sessionAge < SESSION_DURATION) {
          // Try to fetch fresh profile with stored token
          const success = await fetchUserProfile(token);
          if (success) {
            return; // Successfully loaded user from custom session
          }
        } else {
          // Session expired, remove it
          localStorage.removeItem('aderm_session');
        }
      }

      // Fallback to Supabase auth (for backward compatibility)
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetchUserProfile(session.access_token);
      }
    } catch (error) {
      console.error('Error checking user session:', error);
      localStorage.removeItem('aderm_session'); // Clean up on error
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (token: string): Promise<boolean> => {
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
        return true;
      } else {
        console.error('Failed to fetch user profile');
        setUser(null);
        setAccessToken(null);
        // Clean up invalid session
        localStorage.removeItem('aderm_session');
        return false;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('aderm_session');
      return false;
    }
  };

  const handleAuditeeSignupComplete = async (userProfile: User) => {
    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // For OTP signup, the user should already be logged in via the OTP session
    // Just check if we have a valid session
    const storedSession = localStorage.getItem('aderm_session');
    if (storedSession) {
      const sessionData = JSON.parse(storedSession);
      setUser(userProfile);
      setAccessToken(sessionData.token);
    } else {
      console.error('No session after OTP signup');
      setAuthMode('login');
    }
  };

  const handleLogout = async () => {
    // Clear custom session
    localStorage.removeItem('aderm_session');
    
    // Also clear Supabase auth (if any)
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
                  <Login />
                </TabsContent>
                <TabsContent value="signup">
                  <Signup />
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