import { app } from './app.js';
import { config } from './config/index.js';
import { prisma } from './config/prisma.js';
import { redis } from './config/redis.js';
import { sessionPool } from './config/session.js';
import { emailQueue, queueConnection } from './services/emailQueue.js';
import { reconcilePendingJobs } from './services/reconciler.js';

async function start(): Promise<void> {
  await prisma.$connect();
  await redis.ping();
  const restored = await reconcilePendingJobs();
  if (restored > 0) console.info(`Reconciled ${restored} missing email jobs.`);

  const server = app.listen(config.port, () => {
    console.info(`API listening on http://localhost:${config.port}`);
  });

  const shutdown = async (signal: string) => {
    console.info(`Received ${signal}; closing API server...`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([emailQueue.close(), queueConnection.quit(), redis.quit(), prisma.$disconnect(), sessionPool.end()]);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch(async (error) => {
  console.error('Unable to start API:', error);
  await prisma.$disconnect();
  process.exit(1);
});
