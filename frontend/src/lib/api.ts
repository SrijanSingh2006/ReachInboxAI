import axios from 'axios';
import type {
  ScheduledEmail,
  EmailStats,
  ScheduleRequest,
  BulkScheduleRequest,
  SlackStatus,
  SearchResult,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const emailApi = {
  getScheduled: (): Promise<ScheduledEmail[]> =>
    api.get('/emails/scheduled').then((r) => r.data),

  getSent: (): Promise<ScheduledEmail[]> =>
    api.get('/emails/sent').then((r) => r.data),

  getAll: (): Promise<ScheduledEmail[]> =>
    api.get('/emails/all').then((r) => r.data),

  getStats: (): Promise<EmailStats> =>
    api.get('/stats').then((r) => r.data),

  search: (query: string): Promise<SearchResult[]> =>
    api.get(`/emails/search?q=${encodeURIComponent(query)}`).then((r) => r.data),

  schedule: (data: ScheduleRequest): Promise<{ message: string; email: ScheduledEmail }> =>
    api.post('/schedule', data).then((r) => r.data),

  bulkSchedule: (data: BulkScheduleRequest): Promise<{ scheduled: number; emailIds: string[] }> =>
    api.post('/schedule/bulk', data).then((r) => r.data),
};

export const slackApi = {
  getStatus: (senderId: string): Promise<SlackStatus> =>
    api.get(`/slack/status/${senderId}`).then((r) => r.data),

  connect: (senderId: string, webhookUrl: string): Promise<{ message: string }> =>
    api.post('/slack/connect', { senderId, webhookUrl }).then((r) => r.data),

  disconnect: (senderId: string): Promise<{ message: string }> =>
    api.delete(`/slack/disconnect/${senderId}`).then((r) => r.data),
};

export default api;
