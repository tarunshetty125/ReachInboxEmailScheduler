import { EmailStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config/index.js';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { enqueueEmailBatch } from '../services/emailQueue.js';
import { calculateScheduledTimes } from '../services/scheduler.js';
import { listEmailsQuerySchema, scheduleEmailSchema, updateEmailStarSchema } from '../validators/email.validator.js';

export const emailRouter = Router();

const publicSenderSelect = { id: true, email: true, aliasEmail: true, name: true, hourlyLimit: true } as const;
const emailWithSender = {
  id: true,
  batchId: true,
  recipientEmail: true,
  subject: true,
  bodyHtml: true,
  status: true,
  scheduledAt: true,
  sentAt: true,
  etherealUrl: true,
  errorMessage: true,
  retryCount: true,
  isStarred: true,
  delayBetweenMs: true,
  hourlyLimit: true,
  createdAt: true,
  sender: { select: publicSenderSelect },
  attachments: { select: { attachment: { select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true } } } },
} as const;

function toEmailResponse<T extends { attachments: Array<{ attachment: unknown }> }>(email: T): Omit<T, 'attachments'> & { attachments: unknown[] } {
  const { attachments, ...rest } = email;
  return { ...rest, attachments: attachments.map(({ attachment }) => attachment) };
}

emailRouter.post('/schedule', requireAuth, async (req, res, next) => {
  const parsed = scheduleEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const recipients = [...new Set(parsed.data.recipients.map((email) => email.toLowerCase()))];
  const startTime = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(startTime.getTime())) {
    res.status(400).json({ error: 'scheduledAt must be a valid ISO datetime' });
    return;
  }

  try {
    const sender = await prisma.sender.findFirst({
      where: { id: parsed.data.senderId, userId: req.user!.id },
      select: { id: true, hourlyLimit: true },
    });
    if (!sender) {
      res.status(404).json({ error: 'Sender not found' });
      return;
    }
    if (parsed.data.hourlyLimit !== undefined && parsed.data.hourlyLimit !== sender.hourlyLimit) {
      res.status(409).json({ error: 'Sender hourly limit changed. Refresh the sender setting before scheduling.' });
      return;
    }
    const attachmentIds = [...new Set(parsed.data.attachmentIds)];
    if (attachmentIds.length > 0) {
      const attachmentCount = await prisma.attachment.count({
        where: { id: { in: attachmentIds }, userId: req.user!.id },
      });
      if (attachmentCount !== attachmentIds.length) {
        res.status(400).json({ error: 'One or more attachments are unavailable.' });
        return;
      }
    }

    const scheduledTimes = calculateScheduledTimes({
      recipientCount: recipients.length,
      startTime,
      delayBetweenMs: parsed.data.delayBetweenMs,
      hourlyLimit: sender.hourlyLimit,
    });
    const batchId = randomUUID();
    const rows = recipients.map((recipientEmail, index) => {
      const id = randomUUID();
      return {
        id,
        userId: req.user!.id,
        senderId: sender.id,
        batchId,
        recipientEmail,
        subject: parsed.data.subject,
        bodyHtml: parsed.data.bodyHtml,
        scheduledAt: scheduledTimes[index],
        delayBetweenMs: parsed.data.delayBetweenMs,
        hourlyLimit: sender.hourlyLimit,
        idempotencyKey: `email-${id}`,
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.email.createMany({ data: rows });
      if (attachmentIds.length > 0) {
        await tx.emailAttachment.createMany({
          data: rows.flatMap((email) => attachmentIds.map((attachmentId) => ({ emailId: email.id, attachmentId }))),
        });
      }
    });

    // PostgreSQL and Redis cannot share one transaction. Pending records are
    // reconciled at API start-up if a queue write is interrupted.
    await enqueueEmailBatch(rows.map(({ id, senderId, scheduledAt }) => ({ id, senderId, scheduledAt })));
    await prisma.email.updateMany({
      where: { batchId, status: EmailStatus.pending },
      data: { status: EmailStatus.queued },
    });

    res.status(201).json({
      batchId,
      emailCount: rows.length,
      firstScheduledAt: scheduledTimes[0],
      lastScheduledAt: scheduledTimes.at(-1),
    });
  } catch (error) {
    next(error);
  }
});

emailRouter.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const [scheduledCount, sentCount] = await Promise.all([
      prisma.email.count({
        where: {
          userId: req.user!.id,
          status: { in: [EmailStatus.pending, EmailStatus.queued, EmailStatus.sending, EmailStatus.rate_limited] },
        },
      }),
      prisma.email.count({ where: { userId: req.user!.id, status: EmailStatus.sent } }),
    ]);
    res.json({ scheduledCount, sentCount });
  } catch (error) {
    next(error);
  }
});

emailRouter.get('/batches', requireAuth, async (req, res, next) => {
  const parsed = listEmailsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }

  const values = parsed.data.status?.split(',').filter(Boolean) ?? [];
  const invalidStatus = values.find((value) => !Object.values(EmailStatus).includes(value as EmailStatus));
  if (invalidStatus) {
    res.status(400).json({ error: `Unknown email status: ${invalidStatus}` });
    return;
  }

  try {
    const baseWhere: Prisma.EmailWhereInput = {
      userId: req.user!.id,
      ...(parsed.data.search
        ? {
            OR: [
              { recipientEmail: { contains: parsed.data.search, mode: 'insensitive' } },
              { subject: { contains: parsed.data.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const matchingGroups = await prisma.email.groupBy({
      by: ['batchId', 'status'],
      where: baseWhere,
      _count: { _all: true },
      _min: { scheduledAt: true },
    });
    const batchIds = [...new Set(
      matchingGroups
        .filter((group) => values.length === 0 || values.includes(group.status))
        .map((group) => group.batchId),
    )];
    const grouped = batchIds.length === 0 ? [] : await prisma.email.groupBy({
      by: ['batchId', 'status'],
      where: { ...baseWhere, batchId: { in: batchIds } },
      _count: { _all: true },
      _min: { scheduledAt: true },
    });
    const summaries = new Map<string, { emailCount: number; statusCounts: Record<string, number>; nextScheduledAt: Date | null }>();
    for (const group of grouped) {
      const current = summaries.get(group.batchId) ?? { emailCount: 0, statusCounts: {}, nextScheduledAt: null };
      current.emailCount += group._count._all;
      current.statusCounts[group.status] = group._count._all;
      const canStillSend = group.status !== EmailStatus.sent && group.status !== EmailStatus.failed;
      if (canStillSend && group._min.scheduledAt && (!current.nextScheduledAt || group._min.scheduledAt < current.nextScheduledAt)) {
        current.nextScheduledAt = group._min.scheduledAt;
      }
      summaries.set(group.batchId, current);
    }
    const examples = batchIds.length === 0 ? [] : await prisma.email.findMany({
      where: { ...baseWhere, batchId: { in: batchIds } },
      distinct: ['batchId'],
      select: {
        batchId: true,
        subject: true,
        bodyHtml: true,
        delayBetweenMs: true,
        sender: { select: publicSenderSelect },
      },
    });
    const exampleByBatch = new Map(examples.map((example) => [example.batchId, example]));
    const batches = batchIds
      .map((batchId) => {
        const example = exampleByBatch.get(batchId);
        const summary = summaries.get(batchId)!;
        if (!example) return null;
        return {
          batchId,
          emailCount: summary.emailCount,
          statusCounts: summary.statusCounts,
          nextScheduledAt: summary.nextScheduledAt,
          subject: example.subject,
          bodyHtml: example.bodyHtml,
          effectiveDelayBetweenMs: Math.max(config.minDelayMs, example.delayBetweenMs),
          hourlyLimit: example.sender.hourlyLimit,
          sender: example.sender,
        };
      })
      .filter((batch): batch is NonNullable<typeof batch> => batch !== null)
      .sort((a, b) => (a.nextScheduledAt?.getTime() ?? 0) - (b.nextScheduledAt?.getTime() ?? 0));
    res.json({ batches, total: batches.length });
  } catch (error) {
    next(error);
  }
});

emailRouter.get('/', requireAuth, async (req, res, next) => {
  const parsed = listEmailsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }

  const values = parsed.data.status?.split(',').filter(Boolean) ?? [];
  const invalidStatus = values.find((value) => !Object.values(EmailStatus).includes(value as EmailStatus));
  if (invalidStatus) {
    res.status(400).json({ error: `Unknown email status: ${invalidStatus}` });
    return;
  }

  try {
    const where: Prisma.EmailWhereInput = {
      userId: req.user!.id,
      ...(values.length > 0 ? { status: { in: values as EmailStatus[] } } : {}),
      ...(parsed.data.batchId ? { batchId: parsed.data.batchId } : {}),
      ...(parsed.data.search
        ? {
            OR: [
              { recipientEmail: { contains: parsed.data.search, mode: 'insensitive' } },
              { subject: { contains: parsed.data.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (parsed.data.page - 1) * parsed.data.limit;
    const [emails, total] = await prisma.$transaction([
      prisma.email.findMany({
        where,
        select: emailWithSender,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: parsed.data.limit,
      }),
      prisma.email.count({ where }),
    ]);
    res.json({ emails: emails.map(toEmailResponse), total, page: parsed.data.page, limit: parsed.data.limit });
  } catch (error) {
    next(error);
  }
});

emailRouter.patch('/:id/star', requireAuth, async (req, res, next) => {
  const parsed = updateEmailStarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await prisma.email.updateMany({
      where: { id, userId: req.user!.id },
      data: { isStarred: parsed.data.isStarred },
    });
    if (updated.count === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    const email = await prisma.email.findFirst({ where: { id, userId: req.user!.id }, select: emailWithSender });
    res.json(toEmailResponse(email!));
  } catch (error) {
    next(error);
  }
});

emailRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const email = await prisma.email.findFirst({
      where: { id, userId: req.user!.id },
      select: emailWithSender,
    });
    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json(toEmailResponse(email));
  } catch (error) {
    next(error);
  }
});
