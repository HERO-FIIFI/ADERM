# ADERM Automated Email Notification System

## Overview

The ADERM platform now includes a comprehensive automated email notification system that sends production-ready emails using Resend API for all status changes and overdue requests. The system runs automatically every 30 minutes to check for status changes and overdue requests.

## ✅ Implementation Complete

### Production Email Integration
- **Resend API Integration**: Full production email sending using RESEND_API_KEY
- **Professional HTML Templates**: Beautifully formatted responsive email templates
- **Error Handling**: Comprehensive error handling with retry mechanisms
- **Audit Trail**: All emails are logged with success/failure status and Resend IDs

### Automated Notification System
- **Scheduled Checks**: Runs every 30 minutes automatically
- **Overdue Detection**: Identifies and notifies overdue requests
- **Duplicate Prevention**: Prevents multiple notifications per day for same overdue request
- **Status Change Tracking**: Automatically triggered on status updates

## 📧 Email Types Implemented

### 1. NEW REQUEST Notifications
**Recipients**: Auditee (primary) + Manager (CC)
- Sent when auditor creates a new request
- Includes signup link for new auditees
- Professional branded template with request details
- CCs managers for departmental oversight

### 2. STATUS CHANGE Notifications

#### SUBMITTED Status
**Recipients**: Original requesting auditor
- Triggered when auditee uploads documents
- Notifies auditor that documents are ready for review

#### APPROVED Status  
**Recipients**: Auditee
- Triggered when auditor/manager approves request
- Confirms successful completion
- No further action required

#### REJECTED Status
**Recipients**: Auditee  
- Triggered when auditor/manager rejects request
- Includes instructions to review feedback and resubmit
- Clear next steps provided

### 3. OVERDUE Notifications
**Recipients**: Auditee (primary) + Manager (CC)
- Triggered daily for requests past due date
- Urgent styling with red color scheme
- Shows days overdue calculation
- CCs managers for escalation

## 🔧 Technical Features

### Email Service Configuration
```typescript
// Production email using Resend API
const sendEmail = async ({ to, subject, html, from }) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  // Sends via Resend API with full error handling
}
```

### Automated Checking System
```typescript
// Runs every 30 minutes
setInterval(checkAndSendNotifications, 30 * 60 * 1000);

// Checks for:
// - Overdue requests (due_date < current_time)
// - Status changes requiring notifications
// - Prevents duplicate daily notifications
```

### Status Change Integration
- **Request Creation**: Automatically sends NEW REQUEST emails
- **Document Upload**: Triggers SUBMITTED notifications to auditor
- **Status Updates**: Triggers appropriate APPROVED/REJECTED emails
- **Manual Triggers**: Managers can manually trigger notification checks

## 🛡️ Security & Compliance

### HR Department Confidentiality
- HR requests maintain existing confidentiality rules
- Auditors cannot access HR responses
- Only managers can update HR request status
- Notification system respects these restrictions

### Audit Trail
All email activities are logged with:
- Recipient email address
- Subject and content
- Sent timestamp
- Success/failure status
- Resend API transaction ID
- Request ID and user ID associations

### Access Control
- **Manual Triggers**: Only managers can manually trigger notifications
- **Email Logs**: Only auditors and managers can view email logs
- **Request-based**: Notifications respect existing request access controls

## 🎯 Key Benefits

### For Auditees
- **Immediate Awareness**: Instant notification of new requests
- **Status Updates**: Real-time updates on request status
- **Overdue Alerts**: Clear warnings before compliance issues
- **Easy Signup**: Direct links for account creation

### For Auditors  
- **Submission Alerts**: Immediate notification when documents submitted
- **Progress Tracking**: Automatic updates on request lifecycle
- **Reduced Follow-up**: System handles routine notifications

### For Managers
- **Department Oversight**: CC on all departmental requests
- **Escalation Alerts**: Immediate notification of overdue requests
- **Manual Control**: Ability to trigger notifications manually
- **HR Confidentiality**: Full access to confidential HR requests

## 🔧 API Endpoints

### Manual Notification Trigger (Managers Only)
```
POST /make-server-fcebfd37/trigger-notifications
Authorization: Bearer {access_token}
```

### Email Logs (Auditors/Managers Only)  
```
GET /make-server-fcebfd37/email-logs
Authorization: Bearer {access_token}
```

## 📊 Email Templates

### Professional Design Features
- **Responsive Layout**: Works on desktop and mobile
- **Brand Consistent**: ADERM shield logo and color scheme
- **Status-based Colors**: Different colors for different notification types
- **Clear Calls-to-Action**: Prominent buttons and links
- **Comprehensive Details**: All relevant request information included

### Template Types
1. **New Request**: Blue theme with signup CTA
2. **Status Updates**: Dynamic colors based on status
3. **Overdue Alerts**: Red urgent theme with escalation
4. **CC Notifications**: Green informational theme

## 🚀 System Startup

The notification system automatically:
1. Initializes on server startup
2. Runs first check immediately  
3. Schedules subsequent checks every 30 minutes
4. Logs all activities for monitoring

## 📈 Monitoring & Maintenance

### Logs Available
- Console logs for all email activities
- Audit trail in KV store with detailed information
- Error tracking with specific failure reasons
- Manual trigger tracking for administrative actions

### Performance Features
- **Batch Processing**: Efficiently processes multiple requests
- **Rate Limiting**: Respects email service limits
- **Error Recovery**: Continues processing if individual emails fail
- **Duplicate Prevention**: Smart tracking prevents spam

## 🎉 Production Ready

The system is fully production-ready with:
- ✅ Professional email templates
- ✅ Comprehensive error handling  
- ✅ Complete audit trail
- ✅ Security compliance
- ✅ Automated scheduling
- ✅ Manual controls for administrators
- ✅ HR confidentiality protection
- ✅ Scalable architecture

The ADERM platform now provides enterprise-grade email notifications that ensure all stakeholders stay informed throughout the audit document lifecycle while maintaining security and compliance requirements.