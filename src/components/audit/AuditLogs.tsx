import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Filter, Search, Activity, User, FileText, Settings, Shield } from 'lucide-react';
import { projectId } from '../../utils/supabase/info';

interface AuditLog {
  action: string;
  user_id: string;
  request_id?: string;
  document_id?: string;
  timestamp: string;
  details: any;
}

interface AuditLogsProps {
  accessToken: string;
}

export function AuditLogs({ accessToken }: AuditLogsProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/audit-logs`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
      } else {
        console.error('Failed to fetch audit logs');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Audit logs fetch timed out');
      } else {
        console.error('Error fetching audit logs:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'user_created':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'request_created':
        return <FileText className="h-4 w-4 text-green-600" />;
      case 'document_uploaded':
        return <Activity className="h-4 w-4 text-purple-600" />;
      case 'status_updated':
        return <Settings className="h-4 w-4 text-orange-600" />;
      default:
        return <Shield className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'user_created':
        return 'User Created';
      case 'request_created':
        return 'Request Created';
      case 'document_uploaded':
        return 'Document Uploaded';
      case 'status_updated':
        return 'Status Updated';
      default:
        return action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'user_created':
        return 'bg-blue-100 text-blue-800';
      case 'request_created':
        return 'bg-green-100 text-green-800';
      case 'document_uploaded':
        return 'bg-purple-100 text-purple-800';
      case 'status_updated':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLogDetails = (log: AuditLog) => {
    switch (log.action) {
      case 'user_created':
        return `New ${log.details.role} account created for ${log.details.email}`;
      case 'request_created':
        return `Request "${log.details.title}" assigned to ${log.details.assigned_to_email}`;
      case 'document_uploaded':
        return `Document "${log.details.filename}" uploaded${log.details.comments ? ` with comments: "${log.details.comments}"` : ''}`;
      case 'status_updated':
        return `Status changed from "${log.details.old_status}" to "${log.details.new_status}"`;
      default:
        return JSON.stringify(log.details);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesSearch = searchQuery === '' ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatLogDetails(log).toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesAction && matchesSearch;
  });

  const uniqueActions = [...new Set(logs.map(log => log.action))];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Audit Trail
        </CardTitle>
        <p className="text-sm text-gray-600">
          Complete log of all system activities for compliance and security monitoring
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search audit logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>
                    {getActionLabel(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logs List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {logs.length === 0 ? 'No audit logs available' : 'No logs match your current filters'}
              </p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getActionColor(log.action)}>
                      {getActionLabel(log.action)}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-1">
                    {formatLogDetails(log)}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>User ID: {log.user_id.substring(0, 8)}...</span>
                    {log.request_id && (
                      <span>Request ID: {log.request_id}</span>
                    )}
                    {log.document_id && (
                      <span>Document ID: {log.document_id}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>
              Showing {filteredLogs.length} of {logs.length} audit entries
            </span>
            <span>
              Last updated: {logs.length > 0 ? new Date(logs[0].timestamp).toLocaleString() : 'N/A'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}