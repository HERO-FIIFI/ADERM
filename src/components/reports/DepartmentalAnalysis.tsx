import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Mail, FileBarChart, Download, Building, AlertTriangle, CheckCircle, Clock, XCircle, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '../../utils/supabase/info';
import { FilteredReporting } from './FilteredReporting';

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
  created_at: string;
  updated_at: string;
}

interface DepartmentalAnalysisProps {
  requests: Request[];
  accessToken: string;
  userRole: 'auditor' | 'manager';
}

interface DepartmentStats {
  department: string;
  total: number;
  submitted: number;
  inProgress: number;
  approved: number;
  rejected: number;
  overdue: number;
  completionRate: number;
  avgResponseTime: number;
}

export function DepartmentalAnalysis({ requests, accessToken, userRole }: DepartmentalAnalysisProps) {
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('ADERM Departmental Analysis Report');
  const [emailMessage, setEmailMessage] = useState('');
  const [sending, setSending] = useState(false);

  const departmentStats = useMemo(() => {
    const now = new Date();
    const stats: { [key: string]: DepartmentStats } = {};

    // Group requests by department
    const departmentGroups = requests.reduce((acc, request) => {
      const dept = request.department || 'Unassigned';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(request);
      return acc;
    }, {} as { [key: string]: Request[] });

    // Calculate stats for each department
    Object.entries(departmentGroups).forEach(([department, deptRequests]) => {
      const total = deptRequests.length;
      const submitted = deptRequests.filter(r => r.status === 'submitted').length;
      const inProgress = deptRequests.filter(r => r.status === 'in_progress').length;
      const approved = deptRequests.filter(r => r.status === 'approved').length;
      const rejected = deptRequests.filter(r => r.status === 'rejected').length;
      const overdue = deptRequests.filter(r => {
        const dueDate = new Date(r.due_date);
        return dueDate < now && r.status !== 'approved';
      }).length;

      const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

      // Calculate average response time for completed requests
      const completedRequests = deptRequests.filter(r => r.status === 'approved');
      const avgResponseTime = completedRequests.length > 0 
        ? completedRequests.reduce((sum, req) => {
            const created = new Date(req.created_at);
            const updated = new Date(req.updated_at);
            return sum + (updated.getTime() - created.getTime());
          }, 0) / completedRequests.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      stats[department] = {
        department,
        total,
        submitted,
        inProgress,
        approved,
        rejected,
        overdue,
        completionRate,
        avgResponseTime: Math.round(avgResponseTime * 10) / 10
      };
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [requests]);

  const generateReportText = () => {
    const now = new Date();
    const reportDate = now.toLocaleDateString();
    
    let report = `ADERM DEPARTMENTAL ANALYSIS REPORT\n`;
    report += `Generated on: ${reportDate}\n`;
    report += `Report prepared by: ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}\n\n`;
    
    report += `EXECUTIVE SUMMARY\n`;
    report += `================\n`;
    report += `Total Requests: ${requests.length}\n`;
    report += `Total Departments: ${departmentStats.length}\n`;
    report += `Overall Completion Rate: ${requests.length > 0 ? Math.round((requests.filter(r => r.status === 'approved').length / requests.length) * 100) : 0}%\n\n`;
    
    report += `DEPARTMENTAL BREAKDOWN\n`;
    report += `=====================\n\n`;
    
    departmentStats.forEach((dept, index) => {
      report += `${index + 1}. ${dept.department}\n`;
      report += `   Total Requests: ${dept.total}\n`;
      report += `   Status Distribution:\n`;
      report += `     - Submitted: ${dept.submitted}\n`;
      report += `     - In Progress: ${dept.inProgress}\n`;
      report += `     - Approved: ${dept.approved}\n`;
      report += `     - Rejected: ${dept.rejected}\n`;
      report += `   Overdue Requests: ${dept.overdue}\n`;
      report += `   Completion Rate: ${dept.completionRate}%\n`;
      report += `   Average Response Time: ${dept.avgResponseTime} days\n\n`;
    });
    
    // Performance insights
    const highPerformers = departmentStats.filter(d => d.completionRate >= 80 && d.total >= 3);
    const lowPerformers = departmentStats.filter(d => d.completionRate < 50 && d.total >= 3);
    const mostOverdue = departmentStats.filter(d => d.overdue > 0).sort((a, b) => b.overdue - a.overdue);
    
    report += `PERFORMANCE INSIGHTS\n`;
    report += `===================\n`;
    
    if (highPerformers.length > 0) {
      report += `High Performing Departments (≥80% completion):\n`;
      highPerformers.forEach(dept => {
        report += `  - ${dept.department}: ${dept.completionRate}% completion rate\n`;
      });
      report += `\n`;
    }
    
    if (lowPerformers.length > 0) {
      report += `Departments Needing Attention (<50% completion):\n`;
      lowPerformers.forEach(dept => {
        report += `  - ${dept.department}: ${dept.completionRate}% completion rate, ${dept.overdue} overdue\n`;
      });
      report += `\n`;
    }
    
    if (mostOverdue.length > 0) {
      report += `Departments with Most Overdue Items:\n`;
      mostOverdue.slice(0, 5).forEach(dept => {
        report += `  - ${dept.department}: ${dept.overdue} overdue requests\n`;
      });
    }
    
    return report;
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      toast.error('Please enter recipient email address');
      return;
    }

    setSending(true);
    try {
      const reportContent = generateReportText();
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/send-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject,
          message: emailMessage,
          reportContent: reportContent
        })
      });

      if (response.ok) {
        toast.success('Report sent successfully');
        setEmailDialog(false);
        setEmailTo('');
        setEmailMessage('');
      } else {
        const error = await response.text();
        toast.error(`Failed to send report: ${error}`);
      }
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error('Failed to send report');
    } finally {
      setSending(false);
    }
  };

  const downloadReport = () => {
    const reportContent = generateReportText();
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ADERM-Departmental-Report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Report downloaded successfully');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileBarChart className="h-5 w-5" />
            Departmental Analysis & Reporting
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Comprehensive analytics and targeted reporting capabilities
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview Report</TabsTrigger>
          <TabsTrigger value="filtered">Targeted Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Complete Departmental Overview</h4>
              <p className="text-sm text-gray-600 mt-1">
                Performance statistics across all departments and time periods
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadReport}>
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
              <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Email Departmental Report</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email-to">To</Label>
                      <Input
                        id="email-to"
                        type="email"
                        placeholder="recipient@example.com"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email-subject">Subject</Label>
                      <Input
                        id="email-subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email-message">Message</Label>
                      <Textarea
                        id="email-message"
                        placeholder="Add a personal message (optional)"
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEmailDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSendEmail} disabled={sending}>
                        {sending ? 'Sending...' : 'Send Report'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Departments</p>
                <p className="text-2xl font-bold">{departmentStats.length}</p>
              </div>
              <Building className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Performers</p>
                <p className="text-2xl font-bold text-green-600">
                  {departmentStats.filter(d => d.completionRate >= 80 && d.total >= 3).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Need Attention</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {departmentStats.filter(d => d.completionRate < 50 && d.total >= 3).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Overdue</p>
                <p className="text-2xl font-bold text-red-600">
                  {departmentStats.reduce((sum, dept) => sum + dept.overdue, 0)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Departmental Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Submitted</TableHead>
                <TableHead className="text-center">In Progress</TableHead>
                <TableHead className="text-center">Approved</TableHead>
                <TableHead className="text-center">Rejected</TableHead>
                <TableHead className="text-center">Overdue</TableHead>
                <TableHead className="text-center">Completion Rate</TableHead>
                <TableHead className="text-center">Avg Response Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departmentStats.map((dept) => (
                <TableRow key={dept.department}>
                  <TableCell className="font-medium">{dept.department}</TableCell>
                  <TableCell className="text-center">{dept.total}</TableCell>
                  <TableCell className="text-center">
                    {dept.submitted > 0 && (
                      <Badge className="bg-blue-100 text-blue-800">{dept.submitted}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {dept.inProgress > 0 && (
                      <Badge className="bg-yellow-100 text-yellow-800">{dept.inProgress}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {dept.approved > 0 && (
                      <Badge className="bg-green-100 text-green-800">{dept.approved}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {dept.rejected > 0 && (
                      <Badge className="bg-red-100 text-red-800">{dept.rejected}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {dept.overdue > 0 ? (
                      <Badge variant="destructive">{dept.overdue}</Badge>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      className={`${
                        dept.completionRate >= 80 
                          ? 'bg-green-100 text-green-800' 
                          : dept.completionRate >= 50 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {dept.completionRate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {dept.avgResponseTime > 0 ? `${dept.avgResponseTime} days` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="filtered">
          <FilteredReporting 
            requests={requests} 
            accessToken={accessToken} 
            userRole={userRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}