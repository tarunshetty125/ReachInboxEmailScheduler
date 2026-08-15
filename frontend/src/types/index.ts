export type EmailStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'failed' | 'rate_limited';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Sender {
  id: string;
  email: string;
  aliasEmail: string | null;
  name: string;
  isDefault: boolean;
  hourlyLimit: number;
  createdAt: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface EmailRecord {
  id: string;
  batchId: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  etherealUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
  isStarred: boolean;
  delayBetweenMs: number;
  hourlyLimit: number;
  createdAt: string;
  sender: Pick<Sender, 'id' | 'email' | 'name'>;
  attachments: Attachment[];
}

export interface EmailListResponse {
  emails: EmailRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface EmailBatchSummary {
  batchId: string;
  emailCount: number;
  statusCounts: Partial<Record<EmailStatus, number>>;
  nextScheduledAt: string | null;
  subject: string;
  bodyHtml: string;
  effectiveDelayBetweenMs: number;
  hourlyLimit: number;
  sender: Pick<Sender, 'id' | 'email' | 'aliasEmail' | 'name' | 'hourlyLimit'>;
}

export interface EmailBatchListResponse {
  batches: EmailBatchSummary[];
  total: number;
}

export interface EmailStats {
  scheduledCount: number;
  sentCount: number;
}
