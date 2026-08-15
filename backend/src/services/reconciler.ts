import { EmailStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { emailQueue, enqueueSingleEmail } from './emailQueue.js';

/** Recreates only genuinely missing jobs; persisted BullMQ delayed jobs are left intact. */
export async function reconcilePendingJobs(): Promise<number> {
  const emails = await prisma.email.findMany({
    where: { status: { in: [EmailStatus.pending, EmailStatus.queued, EmailStatus.rate_limited, EmailStatus.sending] } },
    select: { id: true, senderId: true, scheduledAt: true },
  });
  let restored = 0;

  for (const email of emails) {
    const job = await emailQueue.getJob(`email-${email.id}`);
    if (job) continue;
    await enqueueSingleEmail(email);
    await prisma.email.update({ where: { id: email.id }, data: { status: EmailStatus.queued } });
    restored += 1;
  }
  return restored;
}
