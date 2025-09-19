import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { 
  CalendarIcon, 
  Filter, 
  Mail, 
  Download, 
  Building, 
  Clock, 
  FileBarChart, 
  CheckCircle, 
  AlertTriangle, 
  XCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '../../utils/supabase/info';

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

interface FilteredReportingProps {
  requests: Request[];
  accessToken: string;
  userRole: 'auditor' | 'manager';
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface RecipientFormData {
  to: string;
  cc: string;
  subject: string;
  message: string;
}

export function FilteredReporting({ requests, accessToken, userRole }: FilteredReportingProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [recipientDialog, setRecipientDialog] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientForm, setRecipientForm] = useState<RecipientFormData>({
    to: '',
    cc: '',
    subject: '',
    message: ''
  });

  // Get unique departments from requests
  const departments = useMemo(() => {
    const depts = [...new Set(requests.map(r => r.department).filter(Boolean))];
    return depts.sort();
  }, [requests]);

  // Filter requests based on selected criteria
  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Filter by department
    if (selectedDepartment && selectedDepartment !== 'all') {
      filtered = filtered.filter(r => r.department === selectedDepartment);
    }

    // Filter by date range
    if (dateRange.from && dateRange.to) {
      filtered = filtered.filter(r => {
        const requestDate = new Date(r.created_at);
        return requestDate >= dateRange.from! && requestDate <= dateRange.to!;
      });
    }

    return filtered;
  }, [requests, selectedDepartment, dateRange]);

  // Calculate analytics for filtered data
  const analytics = useMemo(() => {
    const now = new Date();
    const total = filteredRequests.length;
    const submitted = filteredRequests.filter(r => r.status === 'submitted').length;
    const inProgress = filteredRequests.filter(r => r.status === 'in_progress').length;
    const approved = filteredRequests.filter(r => r.status === 'approved').length;
    const rejected = filteredRequests.filter(r => r.status === 'rejected').length;
    const overdue = filteredRequests.filter(r => {
      const dueDate = new Date(r.due_date);
      return dueDate < now && r.status !== 'approved';
    }).length;

    const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    // Calculate average response time for completed requests
    const completedRequests = filteredRequests.filter(r => r.status === 'approved');
    const avgResponseTime = completedRequests.length > 0 
      ? completedRequests.reduce((sum, req) => {
          const created = new Date(req.created_at);
          const updated = new Date(req.updated_at);
          return sum + (updated.getTime() - created.getTime());
        }, 0) / completedRequests.length / (1000 * 60 * 60 * 24) // Convert to days
      : 0;

    return {
      total,
      submitted,
      inProgress,
      approved,
      rejected,
      overdue,
      completionRate,
      avgResponseTime: Math.round(avgResponseTime * 10) / 10
    };
  }, [filteredRequests]);

  const generateFilteredReport = () => {
    const now = new Date();
    const reportDate = now.toLocaleDateString();
    
    let report = `ADERM FILTERED DEPARTMENTAL REPORT\n`;
    report += `=====================================\n\n`;
    report += `Generated on: ${reportDate}\n`;
    report += `Report prepared by: ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}\n\n`;
    
    // Filter criteria
    report += `FILTER CRITERIA\n`;
    report += `===============\n`;
    if (selectedDepartment && selectedDepartment !== 'all') {
      report += `Department: ${selectedDepartment}\n`;
    } else {
      report += `Department: All Departments\n`;
    }
    
    if (dateRange.from && dateRange.to) {
      report += `Date Range: ${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}\n`;
    } else {
      report += `Date Range: All Time\n`;
    }
    report += `\n`;
    
    // Summary
    report += `EXECUTIVE SUMMARY\n`;
    report += `================\n`;
    report += `Total Requests: ${analytics.total}\n`;
    report += `Completion Rate: ${analytics.completionRate}%\n`;
    report += `Average Response Time: ${analytics.avgResponseTime} days\n\n`;
    
    // Status breakdown
    report += `STATUS BREAKDOWN\n`;
    report += `===============\n`;
    report += `Submitted: ${analytics.submitted}\n`;
    report += `In Progress: ${analytics.inProgress}\n`;
    report += `Approved: ${analytics.approved}\n`;
    report += `Rejected: ${analytics.rejected}\n`;
    report += `Overdue: ${analytics.overdue}\n\n`;
    
    // Detailed request list
    if (filteredRequests.length > 0) {
      report += `DETAILED REQUEST LIST\n`;
      report += `====================\n`;
      
      filteredRequests.forEach((request, index) => {
        report += `${index + 1}. ${request.title}\n`;
        report += `   ID: ${request.id}\n`;
        report += `   Department: ${request.department || 'Unassigned'}\n`;
        report += `   Status: ${request.status.toUpperCase()}\n`;
        report += `   Created: ${new Date(request.created_at).toLocaleDateString()}\n`;
        report += `   Due Date: ${new Date(request.due_date).toLocaleDateString()}\n`;
        report += `   Assigned To: ${request.assigned_to_email}\n`;
        report += `   Description: ${request.description}\n\n`;
      });
    }
    
    // Performance insights
    report += `PERFORMANCE INSIGHTS\n`;
    report += `===================\n`;
    
    if (analytics.completionRate >= 80) {
      report += `✓ High Performance: ${analytics.completionRate}% completion rate indicates excellent performance\n`;
    } else if (analytics.completionRate >= 50) {
      report += `⚠ Moderate Performance: ${analytics.completionRate}% completion rate - room for improvement\n`;
    } else {
      report += `✗ Low Performance: ${analytics.completionRate}% completion rate - requires immediate attention\n`;
    }
    
    if (analytics.overdue > 0) {
      report += `⚠ Attention Required: ${analytics.overdue} requests are currently overdue\n`;
    } else {
      report += `✓ No Overdue Items: All requests are on track\n`;
    }
    
    if (analytics.avgResponseTime > 0) {
      report += `📊 Average Response Time: ${analytics.avgResponseTime} days\n`;
    }
    
    return report;
  };

  const handleSendReport = async () => {
    if (!recipientForm.to.trim()) {
      toast.error('Please enter recipient email address');
      return;
    }

    setSending(true);
    try {
      const reportContent = generateFilteredReport();
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/send-filtered-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: recipientForm.to,
          cc: recipientForm.cc || undefined,
          subject: recipientForm.subject || `ADERM Filtered Report - ${(selectedDepartment && selectedDepartment !== 'all') ? selectedDepartment : 'All Departments'}`,
          message: recipientForm.message,
          reportContent: reportContent,
          filterCriteria: {
            department: (selectedDepartment && selectedDepartment !== 'all') ? selectedDepartment : 'All Departments',
            dateRange: dateRange.from && dateRange.to ? {
              from: dateRange.from.toISOString().split('T')[0],
              to: dateRange.to.toISOString().split('T')[0]
            } : 'All Time'
          }
        })
      });

      if (response.ok) {
        toast.success('Filtered report sent successfully');
        setRecipientDialog(false);
        setRecipientForm({ to: '', cc: '', subject: '', message: '' });
      } else {
        const error = await response.text();
        toast.error(`Failed to send report: ${error}`);
      }
    } catch (error) {
      console.error('Error sending filtered report:', error);
      toast.error('Failed to send report');
    } finally {
      setSending(false);
    }
  };

  const downloadFilteredReport = () => {
    const reportContent = generateFilteredReport();
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const departmentSuffix = (selectedDepartment && selectedDepartment !== 'all') ? `-${selectedDepartment.replace(/\s+/g, '-')}` : '';
    const dateSuffix = dateRange.from && dateRange.to ? 
      `-${dateRange.from.toISOString().split('T')[0]}-to-${dateRange.to.toISOString().split('T')[0]}` : '';
    
    a.download = `ADERM-Filtered-Report${departmentSuffix}${dateSuffix}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Filtered report downloaded successfully');
  };

  const clearFilters = () => {
    setSelectedDepartment('all');
    setDateRange({ from: undefined, to: undefined });
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
            <Filter className="h-5 w-5" />
            Targeted Department Report
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Generate focused reports by department and date range
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Department Filter */}
            <div className="space-y-2">
              <Label htmlFor="department-select">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {dateRange.from.toLocaleDateString()} -{" "}
                          {dateRange.to.toLocaleDateString()}
                        </>
                      ) : (
                        dateRange.from.toLocaleDateString()
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={clearFilters} className="flex-1">
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {((selectedDepartment && selectedDepartment !== 'all') || (dateRange.from && dateRange.to)) && (
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-sm font-medium">Active Filters:</span>
              {selectedDepartment && selectedDepartment !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {selectedDepartment}
                </Badge>
              )}
              {dateRange.from && dateRange.to && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold">{analytics.total}</p>
              </div>
              <FileBarChart className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-green-600">{analytics.completionRate}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue Items</p>
                <p className="text-2xl font-bold text-red-600">{analytics.overdue}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold">{analytics.avgResponseTime}d</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <Button variant="outline" onClick={downloadFilteredReport} disabled={analytics.total === 0}>
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
        
        <Dialog open={recipientDialog} onOpenChange={setRecipientDialog}>
          <DialogTrigger asChild>
            <Button disabled={analytics.total === 0}>
              <Mail className="h-4 w-4 mr-2" />
              Send Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Send Filtered Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="recipient-to">To *</Label>
                <Input
                  id="recipient-to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipientForm.to}
                  onChange={(e) => setRecipientForm(prev => ({ ...prev, to: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="recipient-cc">CC</Label>
                <Input
                  id="recipient-cc"
                  type="email"
                  placeholder="cc@example.com (optional)"
                  value={recipientForm.cc}
                  onChange={(e) => setRecipientForm(prev => ({ ...prev, cc: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="recipient-subject">Subject</Label>
                <Input
                  id="recipient-subject"
                  placeholder={`ADERM Filtered Report - ${(selectedDepartment && selectedDepartment !== 'all') ? selectedDepartment : 'All Departments'}`}
                  value={recipientForm.subject}
                  onChange={(e) => setRecipientForm(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="recipient-message">Message</Label>
                <Textarea
                  id="recipient-message"
                  placeholder="Add a personal message (optional)"
                  value={recipientForm.message}
                  onChange={(e) => setRecipientForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded">
                <strong>Report Summary:</strong><br />
                Department: {(selectedDepartment && selectedDepartment !== 'all') ? selectedDepartment : 'All Departments'}<br />
                Date Range: {dateRange.from && dateRange.to ? 
                  `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}` : 
                  'All Time'}<br />
                Total Requests: {analytics.total}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRecipientDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendReport} disabled={sending}>
                  {sending ? 'Sending...' : 'Send Report'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtered Results Table */}
      {analytics.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filtered Results ({analytics.total} requests)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Assigned To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.slice(0, 10).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.title}</TableCell>
                    <TableCell>{request.department || 'Unassigned'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(request.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>{request.assigned_to_email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredRequests.length > 10 && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                Showing first 10 of {filteredRequests.length} results
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {analytics.total === 0 && ((selectedDepartment && selectedDepartment !== 'all') || (dateRange.from && dateRange.to)) && (
        <Card>
          <CardContent className="text-center py-8">
            <FileBarChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-500">
              No requests match your current filter criteria. Try adjusting your filters or clearing them to see all requests.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}