export interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledTime: string;
  sentAt?: string;
  status: 'scheduled' | 'sent' | 'failed';
  jobId?: string;
  senderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface ScheduleRequest {
  recipient: string;
  subject: string;
  body: string;
  scheduledTime: string;
  senderId: string;
  delayBetweenEmailsMs?: number;
  maxEmailsPerHour?: number;
}

export interface BulkScheduleRequest {
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmailsMs: number;
  maxEmailsPerHour: number;
  senderId: string;
}

export interface SlackStatus {
  connected: boolean;
  webhookUrl?: string;
}

export interface SearchResult {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledTime: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
