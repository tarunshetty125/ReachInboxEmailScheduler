import { Worker } from 'bullmq';
import { config } from './config/index.js';
import { prisma } from './config/prisma.js';
import { createRedisConnection, redis } from './config/redis.js';
import { emailQueue, EMAIL_QUEUE_NAME, queueConnection } from './services/emailQueue.js';
import { processEmailJob } from './services/emailWorker.js';
import type { EmailJobPayload } from './types/index.js';

const workerConnection = createRedisConnection();
const worker = new Worker<EmailJobPayload>(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: workerConnection,
  concurrency: config.workerConcurrency,
});

console.info(`Email worker started with concurrency ${config.workerConcurrency}.`);
worker.on('completed', (job) => console.info(`Completed email job ${job.id}`));
worker.on('failed', (job, error) => console.error(`Email job ${job?.id ?? 'unknown'} failed:`, error.message));

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; closing email worker...`);
  try {
    await worker.close();
    await Promise.all([
      emailQueue.close(),
      queueConnection.quit(),
      workerConnection.quit(),
      redis.quit(),
      prisma.$disconnect(),
    ]);
  } catch (error) {
    // A development watcher can deliver SIGINT/SIGTERM more than once while
    // Redis is closing. The first signal has already stopped all work safely.
    console.warn('Worker shutdown completed with an already-closed resource.', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
