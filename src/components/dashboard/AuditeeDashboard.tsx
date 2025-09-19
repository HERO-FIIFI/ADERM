import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Clock, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { RequestList } from '../requests/RequestList';
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
  created_at: string;
  updated_at: string;
}

interface AuditeeDashboardProps {
  user: User;
  accessToken: string;
}

export function AuditeeDashboard({ user, accessToken }: AuditeeDashboardProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
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

  const getStatusCounts = () => {
    const counts = {
      pending: requests.filter(r => r.status === 'submitted' || r.status === 'in_progress').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      approved: requests.filter(r => r.status === 'approved').length,
    };
    return counts;
  };

  const getUpcomingDeadlines = () => {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    return requests.filter(r => {
      const dueDate = new Date(r.due_date);
      return dueDate <= threeDaysFromNow && dueDate >= now && r.status !== 'approved';
    }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  };

  const getOverdueRequests = () => {
    const now = new Date();
    return requests.filter(r => {
      const dueDate = new Date(r.due_date);
      return dueDate < now && r.status !== 'approved';
    });
  };

  const statusCounts = getStatusCounts();
  const upcomingDeadlines = getUpcomingDeadlines();
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
      <div>
        <h2 className="text-3xl font-bold text-gray-900">My Audit Requests</h2>
        <p className="text-gray-600 mt-1">Review and respond to document requests</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Action</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.pending}</div>
            <p className="text-xs text-gray-600 mt-1">Requests awaiting your response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <FileText className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.rejected}</div>
            <p className="text-xs text-gray-600 mt-1">Requests that need revision</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.approved}</div>
            <p className="text-xs text-gray-600 mt-1">Requests approved by auditor</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
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

      {upcomingDeadlines.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Upcoming Deadlines ({upcomingDeadlines.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingDeadlines.slice(0, 3).map(request => (
                <div key={request.id} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{request.title}</span>
                  <Badge variant="secondary">
                    Due: {new Date(request.due_date).toLocaleDateString()}
                  </Badge>
                </div>
              ))}
              {upcomingDeadlines.length > 3 && (
                <p className="text-sm text-gray-600">
                  ...and {upcomingDeadlines.length - 3} more upcoming deadlines
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestList 
            requests={requests} 
            accessToken={accessToken} 
            userRole="auditee"
            onRequestUpdate={() => setRefreshTrigger(prev => prev + 1)}
          />
        </CardContent>
      </Card>
    </div>
  );
}