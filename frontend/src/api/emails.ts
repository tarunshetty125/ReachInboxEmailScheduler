import { api } from './client';
import type { EmailBatchListResponse, EmailListResponse, EmailRecord, EmailStats } from '../types';

export interface SchedulePayload {
  senderId: string;
  recipients: string[];
  subject: string;
  bodyHtml: string;
  scheduledAt: string;
  delayBetweenMs: number;
  hourlyLimit?: number;
  attachmentIds?: string[];
}

export const emailsApi = {
  list: (params: URLSearchParams) => api<EmailListResponse>(`/api/emails?${params.toString()}`),
  batches: (params: URLSearchParams) => api<EmailBatchListResponse>(`/api/emails/batches?${params.toString()}`),
  stats: () => api<EmailStats>('/api/emails/stats'),
  detail: (id: string) => api<EmailRecord>(`/api/emails/${id}`),
  setStarred: (id: string, isStarred: boolean) => api<EmailRecord>(`/api/emails/${id}/star`, { method: 'PATCH', body: JSON.stringify({ isStarred }) }),
  schedule: (payload: SchedulePayload) =>
    api<{ batchId: string; emailCount: number; firstScheduledAt: string; lastScheduledAt: string }>('/api/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
