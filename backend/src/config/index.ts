import 'dotenv/config';

function readPositiveInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be configured when NODE_ENV=production');
}

export const config = {
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://reachinbox:reachinbox@127.0.0.1:5433/reachinbox?schema=public',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6380',
  port: readPositiveInt('PORT', 3000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  // A fallback keeps the take-home runnable locally, but production must supply
  // an explicit high-entropy value (enforced above).
  sessionSecret: process.env.SESSION_SECRET ?? 'development-only-change-this-secret',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/auth/google/callback',
  workerConcurrency: readPositiveInt('WORKER_CONCURRENCY', 3),
  minDelayMs: readPositiveInt('MIN_DELAY_MS', 2_000),
  defaultHourlyLimit: readPositiveInt('HOURLY_LIMIT', 50),
  redisUnavailableRetryMs: readPositiveInt('REDIS_UNAVAILABLE_RETRY_MS', 30_000),
  isProduction,
};

export const isGoogleOAuthConfigured = Boolean(
  config.googleClientId && config.googleClientSecret,
);
