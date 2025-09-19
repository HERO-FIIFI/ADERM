import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Calendar, User, FileText, Download, Clock, Upload, Building } from 'lucide-react';
import { UploadDialog } from './UploadDialog';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../utils/supabase/info';

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
  pending_assignment?: boolean;
  created_at: string;
  updated_at: string;
}

interface Document {
  id: string;
  request_id: string;
  filename: string;
  file_path: string;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
  comments: string;
}

interface RequestDetailsProps {
  request: Request;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  userRole: 'auditor' | 'auditee' | 'manager';
  onRequestUpdate: () => void;
}

export function RequestDetails({ 
  request, 
  open, 
  onOpenChange, 
  accessToken, 
  userRole, 
  onRequestUpdate 
}: RequestDetailsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  useEffect(() => {
    if (open) {
      fetchDocuments();
    }
  }, [open, request.id]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/requests/${request.id}/documents`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      } else if (response.status === 403) {
        const data = await response.json();
        if (data.confidential) {
          // Handle HR confidential access restriction
          setDocuments([]);
        } else {
          console.error('Failed to fetch documents');
          toast.error('Failed to load documents');
        }
      } else {
        console.error('Failed to fetch documents');
        toast.error('Failed to load documents');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Request timed out');
        toast.error('Request timed out. Please try again.');
      } else {
        console.error('Error fetching documents:', error);
        toast.error('Error loading documents');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/requests/${request.id}/status`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        toast.success('Status updated successfully');
        onRequestUpdate();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Status update request timed out');
        toast.error('Request timed out. Please try again.');
      } else {
        console.error('Error updating status:', error);
        toast.error('Failed to update status');
      }
    } finally {
      setStatusLoading(false);
    }
  };

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

  const isOverdue = () => {
    if (request.status === 'approved') return false;
    return new Date(request.due_date) < new Date();
  };

  const canUpdateStatus = () => {
    if (request.department === 'Human Resources' && userRole === 'auditor') {
      return false; // Auditors cannot update HR request status
    }
    return userRole === 'auditor' || userRole === 'manager';
  };

  const canUpload = () => {
    return userRole === 'auditee' && (request.status === 'submitted' || request.status === 'in_progress' || request.status === 'rejected');
  };

  const isHRConfidential = () => {
    return request.department === 'Human Resources' && userRole === 'auditor';
  };

  const handleDownload = (document: Document) => {
    if (document.file_url) {
      window.open(document.file_url, '_blank');
    } else {
      toast.error('Download link has expired. Please refresh to get a new link.');
      fetchDocuments();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{request.title}</DialogTitle>
            <DialogDescription>
              View detailed information about this audit document request, including status, documents, and submission history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Request Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Request Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(request.status)}>
                      {request.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {isOverdue() && (
                      <Badge variant="destructive">OVERDUE</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    Due: {new Date(request.due_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <User className="h-4 w-4" />
                    Assigned to: {request.assigned_to_email}
                    {request.pending_assignment && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Awaiting Account Creation
                      </Badge>
                    )}
                  </div>
                  {request.department && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <Building className="h-4 w-4" />
                      Department: {request.department}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="h-4 w-4" />
                    Created: {new Date(request.created_at).toLocaleDateString()}
                  </div>
                </div>

                {request.cc_emails && request.cc_emails.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700 mb-1">CC Recipients:</div>
                    <div className="flex flex-wrap gap-2">
                      {request.cc_emails.map((email, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Description & Instructions</h4>
                  <p className="text-gray-600 whitespace-pre-wrap">{request.description}</p>
                </div>

                {canUpdateStatus() && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Update Status:</label>
                    <Select 
                      value={request.status} 
                      onValueChange={updateStatus}
                      disabled={statusLoading}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents Section */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Submitted Documents</CardTitle>
                  {canUpload() && (
                    <Button
                      onClick={() => setShowUploadDialog(true)}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Document
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isHRConfidential() ? (
                  <div className="text-center py-8">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                      <div className="flex items-center justify-center mb-4">
                        <div className="bg-amber-100 rounded-full p-3">
                          <FileText className="h-8 w-8 text-amber-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-medium text-amber-900 mb-2">
                        Confidential HR Request
                      </h3>
                      <p className="text-amber-700 mb-4">
                        This is a Human Resources department request. Document submissions and responses 
                        are confidential and can only be viewed by managers.
                      </p>
                      <p className="text-sm text-amber-600">
                        Contact your manager if you need access to the submitted documents for this request.
                      </p>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No documents have been uploaded yet.</p>
                    {canUpload() && (
                      <Button
                        variant="outline"
                        onClick={() => setShowUploadDialog(true)}
                        className="mt-2"
                      >
                        Upload First Document
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documents.map((document) => (
                      <div
                        key={document.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <span className="font-medium">{document.filename}</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Uploaded {new Date(document.uploaded_at).toLocaleString()}
                          </div>
                          {document.comments && (
                            <div className="text-sm text-gray-700 mt-2 p-2 bg-gray-100 rounded">
                              <strong>Comments:</strong> {document.comments}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(document)}
                          className="flex items-center gap-1"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        requestId={request.id}
        requestStatus={request.status}
        accessToken={accessToken}
        onUploadComplete={() => {
          setShowUploadDialog(false);
          fetchDocuments();
          onRequestUpdate();
        }}
      />
    </>
  );
}