import { z } from 'zod';

export const createSenderSchema = z.object({
  name: z.string().trim().min(1).max(255),
  // This is a dashboard alias. Every request still provisions a fresh
  // Ethereal mailbox; aliases deliberately are not deduplicated.
  aliasEmail: z.string().trim().email().max(255).optional(),
});

export const updateSenderHourlyLimitSchema = z.object({
  hourlyLimit: z.number().int().min(1).max(1_000),
});
