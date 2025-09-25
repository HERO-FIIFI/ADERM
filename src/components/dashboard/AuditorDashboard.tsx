import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Plus, FileText, Clock, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { CreateRequestDialog } from '../requests/CreateRequestDialog';
import { RequestList } from '../requests/RequestList';
import { AuditLogs } from '../audit/AuditLogs';
import { DepartmentalAnalysis } from '../reports/DepartmentalAnalysis';
// import { EmailTestPanel } from '../debug/EmailTestPanel';
import { projectId } from '../../utils/supabase/info';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Request {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  created_by: string;
  assigned_to: string;
  assigned_to_email: string;
  department?: string;
  cc_emails?: string[];
  hr_confidential?: boolean;
  created_at: string;
  updated_at: string;
}

interface AuditorDashboardProps {
  user: User;
  accessToken: string;
}

export function AuditorDashboard({ user, accessToken }: AuditorDashboardProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchRequests();
  }, [refreshTrigger]);

  const fetchRequests = async () => {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/requests`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests);
      } else {
        console.error('Failed to fetch requests');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Request fetch timed out');
      } else {
        console.error('Error fetching requests:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setShowCreateDialog(false);
  };

  const getStatusCounts = () => {
    const counts = {
      submitted: requests.filter(r => r.status === 'submitted').length,
      in_progress: requests.filter(r => r.status === 'in_progress').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      approved: requests.filter(r => r.status === 'approved').length,
    };
    return counts;
  };

  const getOverdueRequests = () => {
    const now = new Date();
    return requests.filter(r => {
      const dueDate = new Date(r.due_date);
      return dueDate < now && r.status !== 'approved';
    });
  };

  const statusCounts = getStatusCounts();
  const overdueRequests = getOverdueRequests();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Auditor Dashboard</h2>
          <p className="text-gray-600 mt-1">Manage audit requests and track progress</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Create Request
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.submitted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.in_progress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueRequests.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Alerts */}
      {overdueRequests.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Overdue Requests ({overdueRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueRequests.slice(0, 3).map(request => (
                <div key={request.id} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{request.title}</span>
                  <Badge variant="destructive">
                    Due: {new Date(request.due_date).toLocaleDateString()}
                  </Badge>
                </div>
              ))}
              {overdueRequests.length > 3 && (
                <p className="text-sm text-gray-600">
                  ...and {overdueRequests.length - 3} more overdue requests
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">All Requests</TabsTrigger>
          <TabsTrigger value="analysis">Departmental Analysis</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <RequestList 
            requests={requests} 
            accessToken={accessToken} 
            userRole="auditor"
            onRequestUpdate={() => setRefreshTrigger(prev => prev + 1)}
          />
        </TabsContent>

        <TabsContent value="analysis">
          <DepartmentalAnalysis 
            requests={requests} 
            accessToken={accessToken} 
            userRole="auditor"
          />
        </TabsContent>

        <TabsContent value="audit-logs">
          <AuditLogs accessToken={accessToken} />
        </TabsContent>
      </Tabs>

      <CreateRequestDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        accessToken={accessToken}
        onRequestCreated={handleRequestCreated}
      />
    </div>
  );
}