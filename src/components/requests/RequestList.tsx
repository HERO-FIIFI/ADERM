import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Calendar, FileText, Clock, User, Filter, Upload, Building, Shield } from 'lucide-react';
import { RequestDetails } from './RequestDetails';
import { UploadDialog } from './UploadDialog';

interface Request {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  created_by: string;
  assigned_to: string | null;
  assigned_to_email: string;
  department?: string;
  cc_emails?: string[];
  hr_confidential?: boolean;
  pending_assignment?: boolean;
  created_at: string;
  updated_at: string;
}

interface RequestListProps {
  requests: Request[];
  accessToken: string;
  userRole: 'auditor' | 'auditee' | 'manager';
  onRequestUpdate: () => void;
}

export function RequestList({ requests, accessToken, userRole, onRequestUpdate }: RequestListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadRequestId, setUploadRequestId] = useState<string>('');
  const [uploadRequestStatus, setUploadRequestStatus] = useState<string>('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'in_progress':
        return 'In Progress';
      case 'rejected':
        return 'Rejected';
      case 'approved':
        return 'Approved';
      default:
        return status;
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'approved') return false;
    return new Date(dueDate) < new Date();
  };

  const wasOverdueWhenApproved = (dueDate: string, status: string) => {
    if (status !== 'approved') return false;
    return new Date(dueDate) < new Date();
  };

  const filteredRequests = requests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesSearch = request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.assigned_to_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (request.department && request.department.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const sortedRequests = filteredRequests.sort((a, b) => {
    // Sort by: overdue first (excluding approved), then by due date (ascending), then by created date (descending)
    const aOverdue = isOverdue(a.due_date, a.status);
    const bOverdue = isOverdue(b.due_date, b.status);
    
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    const aDueDate = new Date(a.due_date).getTime();
    const bDueDate = new Date(b.due_date).getTime();
    
    if (aDueDate !== bDueDate) return aDueDate - bDueDate;
    
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleUpload = (requestId: string, requestStatus: string) => {
    setUploadRequestId(requestId);
    setUploadRequestStatus(requestStatus);
    setShowUploadDialog(true);
  };

  const canUpload = (request: Request) => {
    return userRole === 'auditee' && (request.status === 'submitted' || request.status === 'in_progress' || request.status === 'rejected');
  };

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No requests found</h3>
          <p className="text-gray-500 text-center">
            {userRole === 'auditor' 
              ? "You haven't created any requests yet. Click 'Create Request' to get started."
              : "You don't have any document requests assigned to you at the moment."
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Request List */}
        <div className="space-y-4">
          {sortedRequests.map((request) => (
            <Card key={request.id} className={`transition-colors hover:bg-gray-50 ${isOverdue(request.due_date, request.status) ? 'border-red-200 bg-red-50' : ''} ${wasOverdueWhenApproved(request.due_date, request.status) ? 'border-amber-200 bg-amber-50' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {request.title}
                      <Badge className={getStatusColor(request.status)}>
                        {getStatusLabel(request.status)}
                      </Badge>
                      {isOverdue(request.due_date, request.status) && (
                        <Badge variant="destructive">Overdue</Badge>
                      )}
                      {wasOverdueWhenApproved(request.due_date, request.status) && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          <Clock className="h-3 w-3 mr-1" />
                          Overdue but Approved
                        </Badge>
                      )}
                      {request.department === 'Human Resources' && userRole === 'auditor' && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Shield className="h-3 w-3 mr-1" />
                          HR Confidential
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Due: {new Date(request.due_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {request.assigned_to_email}
                        {request.pending_assignment && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            Pending Account
                          </Badge>
                        )}
                      </div>
                      {request.department && (
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          {request.department}
                        </div>
                      )}
                      {request.cc_emails && request.cc_emails.length > 0 && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          CC: {request.cc_emails.slice(0, 2).join(', ')}
                          {request.cc_emails.length > 2 && ` +${request.cc_emails.length - 2} more`}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Created: {new Date(request.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canUpload(request) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpload(request.id, request.status)}
                        className="flex items-center gap-1"
                      >
                        <Upload className="h-4 w-4" />
                        Upload
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRequest(request)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-gray-600 text-sm line-clamp-2">
                  {request.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredRequests.length === 0 && requests.length > 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FileText className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-gray-500">No requests match your current filters.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedRequest && (
        <RequestDetails
          request={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={() => setSelectedRequest(null)}
          accessToken={accessToken}
          userRole={userRole}
          onRequestUpdate={onRequestUpdate}
        />
      )}

      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        requestId={uploadRequestId}
        requestStatus={uploadRequestStatus}
        accessToken={accessToken}
        onUploadComplete={() => {
          setShowUploadDialog(false);
          onRequestUpdate();
        }}
      />
    </>
  );
}