import { z } from 'zod';
import { config } from '../config/index.js';

export const scheduleEmailSchema = z.object({
  senderId: z.string().uuid(),
  recipients: z.array(z.string().trim().email()).min(1).max(10_000),
  subject: z.string().trim().min(1).max(1_000),
  bodyHtml: z.string().trim().min(1),
  scheduledAt: z.string().datetime({ offset: true }),
  delayBetweenMs: z.number().int().min(0).max(3_600_000).default(config.minDelayMs),
  // Backwards-compatible request guard. The sender-level setting is the
  // authoritative limit; a mismatched legacy value is rejected by the route.
  hourlyLimit: z.number().int().min(1).max(1_000).optional(),
  attachmentIds: z.array(z.string().uuid()).max(5).default([]),
});

export const listEmailsQuerySchema = z.object({
  status: z.string().optional(),
  batchId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
});

export const updateEmailStarSchema = z.object({
  isStarred: z.boolean(),
});
