import { DelayedError, type Job } from 'bullmq';
import { EmailStatus } from '@prisma/client';
import { config } from '../config/index.js';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';
import type { EmailJobPayload } from '../types/index.js';
import { sendEmailViaSender } from './emailSender.js';
import { acquireSenderSendSlot } from './rateLimiter.js';

const processableStates = [
  EmailStatus.pending,
  EmailStatus.queued,
  EmailStatus.rate_limited,
  EmailStatus.sending,
];

async function deferJob(job: Job<EmailJobPayload>, retryAt: number): Promise<void> {
  await job.moveToDelayed(retryAt, job.token);
  throw new DelayedError();
}

export async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const record = await prisma.email.findUnique({
    where: { id: job.data.emailId },
    include: { sender: true, attachments: { include: { attachment: true } } },
  });
  if (!record || record.status === EmailStatus.sent || record.status === EmailStatus.failed) return;

  const minimumDelayMs = Math.max(config.minDelayMs, record.delayBetweenMs);
  let slot: Awaited<ReturnType<typeof acquireSenderSendSlot>>;
  try {
    slot = await acquireSenderSendSlot(
      redis,
      record.senderId,
      record.sender.hourlyLimit,
      minimumDelayMs,
    );
  } catch (error) {
    const retryAt = Date.now() + config.redisUnavailableRetryMs;
    console.error(`Redis throttle unavailable for email ${record.id}; deferring without sending.`, error);
    await prisma.email.updateMany({
      where: { id: record.id, status: { in: processableStates } },
      data: {
        status: EmailStatus.queued,
        scheduledAt: new Date(retryAt),
        errorMessage: 'Redis throttle unavailable; delivery deferred until Redis recovers.',
      },
    });
    await deferJob(job, retryAt);
    return;
  }
  if (!slot.allowed) {
    const isRateLimited = slot.reason === 'hourly_limit';
    await prisma.email.updateMany({
      where: { id: record.id, status: { in: processableStates } },
      data: {
        status: isRateLimited ? EmailStatus.rate_limited : EmailStatus.queued,
        scheduledAt: new Date(slot.retryAt),
      },
    });
    await deferJob(job, slot.retryAt);
    return;
  }

  const transitioned = await prisma.email.updateMany({
    where: { id: record.id, status: { in: processableStates } },
    data: { status: EmailStatus.sending, errorMessage: null },
  });
  if (transitioned.count === 0) return;

  try {
    const { previewUrl } = await sendEmailViaSender(record.sender, record);
    await prisma.email.update({
      where: { id: record.id },
      data: {
        status: EmailStatus.sent,
        sentAt: new Date(),
        etherealUrl: previewUrl,
        errorMessage: null,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SMTP failure';
    const attempts = job.opts.attempts ?? 1;
    const finalAttempt = job.attemptsMade + 1 >= attempts;
    await prisma.email.updateMany({
      where: { id: record.id, status: EmailStatus.sending },
      data: {
        status: finalAttempt ? EmailStatus.failed : EmailStatus.queued,
        errorMessage,
        retryCount: { increment: 1 },
      },
    });
    throw error;
  }
}
