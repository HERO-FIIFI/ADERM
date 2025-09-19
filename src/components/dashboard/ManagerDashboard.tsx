import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { TrendingUp, AlertTriangle, Users, FileText, Clock, Shield } from 'lucide-react';
import { RequestList } from '../requests/RequestList';
import { AuditLogs } from '../audit/AuditLogs';
import { DepartmentalAnalysis } from '../reports/DepartmentalAnalysis';
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

interface ManagerDashboardProps {
  user: User;
  accessToken: string;
}

export function ManagerDashboard({ user, accessToken }: ManagerDashboardProps) {
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

  const getAnalytics = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const totalRequests = requests.length;
    const completedRequests = requests.filter(r => r.status === 'approved').length;
    const overdueRequests = requests.filter(r => {
      const dueDate = new Date(r.due_date);
      return dueDate < now && r.status !== 'approved';
    });
    const recentRequests = requests.filter(r => new Date(r.created_at) >= sevenDaysAgo);
    const hrRequests = requests.filter(r => r.department === 'Human Resources');
    
    // New overdue analytics
    const overdueButApproved = requests.filter(r => {
      const dueDate = new Date(r.due_date);
      return dueDate < now && r.status === 'approved';
    });
    
    // Recently became overdue (last 24 hours)
    const recentlyOverdue = overdueRequests.filter(r => {
      const dueDate = new Date(r.due_date);
      return dueDate >= oneDayAgo && dueDate < now;
    });
    
    const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;
    
    return {
      totalRequests,
      completedRequests,
      overdueRequests,
      recentRequests: recentRequests.length,
      completionRate,
      overdueCount: overdueRequests.length,
      hrRequestsCount: hrRequests.length,
      overdueButApprovedCount: overdueButApproved.length,
      recentlyOverdueCount: recentlyOverdue.length
    };
  };

  const getCriticalRequests = () => {
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    
    return requests.filter(r => {
      const dueDate = new Date(r.due_date);
      // Exclude approved requests from critical alerts, even if they were overdue when approved
      if (r.status === 'approved') return false;
      return (dueDate <= twoDaysFromNow) || dueDate < now;
    }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  };

  const analytics = getAnalytics();
  const criticalRequests = getCriticalRequests();

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
        <h2 className="text-3xl font-bold text-gray-900">Manager Dashboard</h2>
        <p className="text-gray-600 mt-1">Oversight and management of audit processes</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalRequests}</div>
            <p className="text-xs text-gray-600 mt-1">
              {analytics.recentRequests} created this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.completionRate}%</div>
            <p className="text-xs text-gray-600 mt-1">
              {analytics.completedRequests} of {analytics.totalRequests} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{analytics.overdueCount}</div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-600">Active overdue</span>
              {analytics.recentlyOverdueCount > 0 && (
                <span className="text-red-500 font-medium">+{analytics.recentlyOverdueCount} new</span>
              )}
            </div>
            {analytics.overdueButApprovedCount > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {analytics.overdueButApprovedCount} resolved late
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Audits</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {requests.filter(r => r.status !== 'approved').length}
            </div>
            <p className="text-xs text-gray-600 mt-1">In progress or pending</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">HR Confidential</CardTitle>
            <Shield className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">{analytics.hrRequestsCount}</div>
            <p className="text-xs text-amber-700 mt-1">Requires manager oversight</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Requests Alert */}
      {criticalRequests.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Critical Requests Requiring Attention ({criticalRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criticalRequests.slice(0, 5).map(request => {
                const dueDate = new Date(request.due_date);
                const isOverdue = dueDate < new Date();
                
                return (
                  <div key={request.id} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium">{request.title}</p>
                      <p className="text-sm text-gray-600">Assigned to: {request.assigned_to_email}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={isOverdue ? "destructive" : "secondary"}>
                        {isOverdue ? 'Overdue' : 'Due Soon'}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {dueDate.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              {criticalRequests.length > 5 && (
                <p className="text-sm text-gray-600 text-center pt-2">
                  ...and {criticalRequests.length - 5} more critical requests
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">All Requests</TabsTrigger>
          <TabsTrigger value="analysis">Departmental Analysis</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Request Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { status: 'submitted', label: 'Submitted', color: 'bg-blue-500' },
                    { status: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
                    { status: 'rejected', label: 'Rejected', color: 'bg-red-500' },
                    { status: 'approved', label: 'Approved', color: 'bg-green-500' }
                  ].map(({ status, label, color }) => {
                    const count = requests.filter(r => r.status === status).length;
                    const percentage = analytics.totalRequests > 0 ? Math.round((count / analytics.totalRequests) * 100) : 0;
                    
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full ${color} mr-2`}></div>
                          <span className="text-sm">{label}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm font-medium mr-2">{count}</span>
                          <span className="text-xs text-gray-500">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {requests
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                    .slice(0, 5)
                    .map(request => (
                      <div key={request.id} className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">{request.title}</p>
                          <p className="text-xs text-gray-500">
                            Updated {new Date(request.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline">{request.status}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requests">
          <RequestList 
            requests={requests} 
            accessToken={accessToken} 
            userRole="manager"
            onRequestUpdate={() => setRefreshTrigger(prev => prev + 1)}
          />
        </TabsContent>

        <TabsContent value="analysis">
          <DepartmentalAnalysis 
            requests={requests} 
            accessToken={accessToken} 
            userRole="manager"
          />
        </TabsContent>

        <TabsContent value="audit-logs">
          <AuditLogs accessToken={accessToken} />
        </TabsContent>
      </Tabs>
    </div>
  );
}