import RedisMock from 'ioredis-mock';
import { afterEach, describe, expect, it } from 'vitest';
import {
  acquireSenderSendSlot,
  checkHourlyRateLimit,
  claimSenderSendGate,
  getNextHourStart,
  senderRateLimitKey,
  senderSendGateKey,
} from '../rateLimiter.js';

const clients: RedisMock[] = [];
afterEach(async () => { await Promise.all(clients.splice(0).map((client) => client.disconnect())); });

describe('Redis sender throttles', () => {
  it('uses per-sender fixed-hour keys and computes the aligned next window', () => {
    const now = Date.parse('2026-08-14T10:59:59.500Z');
    expect(senderRateLimitKey('sender-a', now)).toMatch(/^ratelimit:sender:sender-a:\d+$/);
    expect(senderSendGateKey('sender-a')).toBe('sendgate:sender:sender-a');
    expect(new Date(getNextHourStart(now)).toISOString()).toBe('2026-08-14T11:00:00.000Z');
  });

  it('atomically permits only the configured fixed-window count', async () => {
    const redis = new RedisMock(); clients.push(redis);
    const now = Date.parse('2026-08-14T10:00:00.000Z');
    await expect(checkHourlyRateLimit(redis, 'sender-a', 2, now)).resolves.toMatchObject({ allowed: true, count: 1 });
    await expect(checkHourlyRateLimit(redis, 'sender-a', 2, now)).resolves.toMatchObject({ allowed: true, count: 2 });
    await expect(checkHourlyRateLimit(redis, 'sender-a', 2, now)).resolves.toMatchObject({ allowed: false, count: 2 });
  });

  it('reserves a per-sender inter-email gate atomically', async () => {
    const redis = new RedisMock(); clients.push(redis);
    const now = Date.parse('2026-08-14T10:00:00.000Z');
    await expect(claimSenderSendGate(redis, 'sender-a', 2_000, now)).resolves.toMatchObject({ allowed: true, delayMs: 0 });
    await expect(claimSenderSendGate(redis, 'sender-a', 2_000, now + 500)).resolves.toMatchObject({ allowed: false, delayMs: 1_500 });
    await expect(claimSenderSendGate(redis, 'sender-a', 2_000, now + 2_000)).resolves.toMatchObject({ allowed: true, delayMs: 0 });
  });

  it('does not consume an hourly slot when the sender gate defers a job', async () => {
    const redis = new RedisMock(); clients.push(redis);
    const now = Date.parse('2026-08-14T10:00:00.000Z');
    await claimSenderSendGate(redis, 'combined-sender', 2_000, now);
    await expect(acquireSenderSendSlot(redis, 'combined-sender', 1, 2_000, now + 100)).resolves.toMatchObject({ allowed: false, reason: 'minimum_delay', count: 0 });
    await expect(acquireSenderSendSlot(redis, 'combined-sender', 1, 2_000, now + 2_000)).resolves.toMatchObject({ allowed: true, count: 1 });
  });
});
