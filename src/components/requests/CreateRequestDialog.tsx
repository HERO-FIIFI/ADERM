import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CalendarIcon } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../utils/supabase/info';

interface CreateRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  onRequestCreated: () => void;
}

export function CreateRequestDialog({ open, onOpenChange, accessToken, onRequestCreated }: CreateRequestDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedToEmail, setAssignedToEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Predefined department options
  const departments = [
    'CCIB & FinTech',
'Compliance',
'Consumer & Commercial',
'CX & Service Management',
'Cyber Security',
'Ecobank Business Services (EBS)',
'Finance',
'Human Resources (HR)',
'Internal Audit',
'Internal Control',
'Legal',
'MDs Office',
'PMO',
'Strategy and Execution',
'Technology Infrastructure Engineering',
'Technology Operations & Products',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!title || !description || !dueDate || !assignedToEmail || !department || (department === 'Other' && !customDepartment)) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    // Validate assigned email is @ecobank.com
    const ecobankEmailRegex = /^[^\s@]+@ecobank\.com$/;
    if (!ecobankEmailRegex.test(assignedToEmail)) {
      setError('Assigned email must be an Ecobank email address (@ecobank.com)');
      setLoading(false);
      return;
    }

    // Validate CC emails format and domain if provided
    if (ccEmails.trim()) {
      const ccEmailList = ccEmails.split(',').map(email => email.trim());
      const invalidEmails = ccEmailList.filter(email => email && !ecobankEmailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        setError('All CC email addresses must be Ecobank email addresses (@ecobank.com)');
        setLoading(false);
        return;
      }
    }

    // Validate due date is in the future
    const selectedDate = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate <= today) {
      setError('Due date must be in the future');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fcebfd37/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          description,
          due_date: dueDate,
          assigned_to_email: assignedToEmail,
          department: department === 'Other' ? customDepartment : department,
          cc_emails: ccEmails.trim() ? ccEmails.split(',').map(email => email.trim()).filter(email => email) : []
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.request?.pending_assignment) {
          toast.success('Request created successfully! The auditee will receive access when they create their account.');
        } else {
          toast.success('Request created successfully!');
        }
        setTitle('');
        setDescription('');
        setDueDate('');
        setAssignedToEmail('');
        setDepartment('');
        setCustomDepartment('');
        setCcEmails('');
        onRequestCreated();
      } else {
        setError(data.error || 'Failed to create request');
      }
    } catch (error: any) {
      console.error('Error creating request:', error);
      setError('Failed to create request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setAssignedToEmail('');
    setDepartment('');
    setCustomDepartment('');
    setCcEmails('');
    setError('');
    onOpenChange(false);
  };

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Document Request</DialogTitle>
          <DialogDescription>
            Fill out the form below to create a new document request for an auditee.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Request Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Financial Records Q3 2024"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description & Instructions</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed instructions for what documents are needed, format requirements, and any specific guidelines..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select value={department} onValueChange={setDepartment} required>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {department === 'Other' && (
              <Input
                value={customDepartment}
                onChange={(e) => setCustomDepartment(e.target.value)}
                placeholder="Enter custom department name"
                required
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assign to (Email)</Label>
            <Input
              id="assignedTo"
              type="email"
              value={assignedToEmail}
              onChange={(e) => setAssignedToEmail(e.target.value)}
              placeholder="auditee@ecobank.com"
              required
            />
            <p className="text-sm text-gray-500">
              You can assign requests to any Ecobank email. If the user hasn't created an account yet, the request will be automatically assigned when they sign up.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ccEmails">CC (Optional)</Label>
            <Textarea
              id="ccEmails"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="Enter additional email addresses separated by commas (e.g., manager@ecobank.com, supervisor@ecobank.com)"
              rows={2}
            />
            <p className="text-sm text-gray-500">
              Add additional email addresses to be notified about this request
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <div className="relative">
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={getMinDate()}
                required
              />
              <CalendarIcon className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}