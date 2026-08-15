import { Queue, type JobsOptions } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import type { EmailJobPayload } from '../types/index.js';

export const EMAIL_QUEUE_NAME = 'email-queue';
export const queueConnection = createRedisConnection();

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 86_400 },
    removeOnFail: false,
  },
});

export interface QueueableEmail {
  id: string;
  senderId: string;
  scheduledAt: Date;
}

function optionsFor(email: QueueableEmail): JobsOptions {
  return {
    jobId: `email-${email.id}`,
    delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
  };
}

export async function enqueueEmailBatch(emails: QueueableEmail[]): Promise<void> {
  const chunkSize = 100;
  for (let index = 0; index < emails.length; index += chunkSize) {
    const chunk = emails.slice(index, index + chunkSize);
    await emailQueue.addBulk(
      chunk.map((email) => ({
        name: 'send-email',
        data: { emailId: email.id, senderId: email.senderId },
        opts: optionsFor(email),
      })),
    );
  }
}

export async function enqueueSingleEmail(email: QueueableEmail): Promise<void> {
  await emailQueue.add('send-email', { emailId: email.id, senderId: email.senderId }, optionsFor(email));
}
