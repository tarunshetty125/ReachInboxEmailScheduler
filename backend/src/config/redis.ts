import { Redis } from 'ioredis';
import { config } from './index.js';

export function createRedisConnection(): Redis {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const redis = createRedisConnection();
