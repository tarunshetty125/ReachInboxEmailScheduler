import type { Redis } from 'ioredis';
import { HOUR_IN_MS } from './scheduler.js';

const RATE_LIMIT_TTL_SECONDS = 7_200;

const FIXED_WINDOW_RATE_LIMIT_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if current >= limit then
  return {0, current}
end
local nextValue = redis.call('INCR', KEYS[1])
if nextValue == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return {1, nextValue}
`;

const SEND_GATE_SCRIPT = `
local nextAllowed = tonumber(redis.call('GET', KEYS[1]) or '0')
local now = tonumber(ARGV[1])
local minimumDelay = tonumber(ARGV[2])
if nextAllowed > now then
  return {0, nextAllowed - now, nextAllowed}
end
local reservedUntil = now + minimumDelay
redis.call('SET', KEYS[1], reservedUntil, 'PX', tonumber(ARGV[3]))
return {1, 0, reservedUntil}
`;

// A single script prevents consuming an hourly send slot while the send gate is
// unavailable, and prevents two worker instances from receiving permission.
const ACQUIRE_SEND_SLOT_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
local now = tonumber(ARGV[3])
local minimumDelay = tonumber(ARGV[4])

if current >= limit then
  return {0, 1, ((math.floor(now / 3600000) + 1) * 3600000), current}
end

local nextAllowed = tonumber(redis.call('GET', KEYS[2]) or '0')
if nextAllowed > now then
  return {0, 2, nextAllowed, current}
end

local nextValue = redis.call('INCR', KEYS[1])
if nextValue == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
local reservedUntil = now + minimumDelay
redis.call('SET', KEYS[2], reservedUntil, 'PX', tonumber(ARGV[5]))
return {1, 0, reservedUntil, nextValue}
`;

function asNumericArray(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error('Unexpected Redis Lua response');
  return value.map((item) => Number(item));
}

export function getHourWindow(timestamp = Date.now()): number {
  return Math.floor(timestamp / HOUR_IN_MS);
}

export function getNextHourStart(timestamp = Date.now()): number {
  return (getHourWindow(timestamp) + 1) * HOUR_IN_MS;
}

export function senderRateLimitKey(senderId: string, timestamp = Date.now()): string {
  return `ratelimit:sender:${senderId}:${getHourWindow(timestamp)}`;
}

export function senderSendGateKey(senderId: string): string {
  return `sendgate:sender:${senderId}`;
}

export async function checkHourlyRateLimit(
  redis: Redis,
  senderId: string,
  hourlyLimit: number,
  now = Date.now(),
): Promise<{ allowed: boolean; count: number }> {
  const [allowed, count] = asNumericArray(
    await redis.eval(FIXED_WINDOW_RATE_LIMIT_SCRIPT, 1, senderRateLimitKey(senderId, now), hourlyLimit, RATE_LIMIT_TTL_SECONDS),
  );
  return { allowed: allowed === 1, count };
}

/** Atomically reserves the per-sender minimum inter-email interval. */
export async function claimSenderSendGate(
  redis: Redis,
  senderId: string,
  minimumDelayMs: number,
  now = Date.now(),
): Promise<{ allowed: boolean; delayMs: number; retryAt: number }> {
  const [allowed, delayMs, retryAt] = asNumericArray(
    await redis.eval(
      SEND_GATE_SCRIPT,
      1,
      senderSendGateKey(senderId),
      now,
      minimumDelayMs,
      Math.max(minimumDelayMs * 2, 60_000),
    ),
  );
  return { allowed: allowed === 1, delayMs, retryAt };
}

export type SendSlotResult =
  | { allowed: true; reservedUntil: number; count: number }
  | { allowed: false; reason: 'hourly_limit' | 'minimum_delay'; retryAt: number; delayMs: number; count: number };

/**
 * Atomic fixed-window hourly-limit + sender send-gate acquisition. The worker
 * uses this path so no concurrent process can exceed either limit.
 */
export async function acquireSenderSendSlot(
  redis: Redis,
  senderId: string,
  hourlyLimit: number,
  minimumDelayMs: number,
  now = Date.now(),
): Promise<SendSlotResult> {
  const [allowed, reasonCode, retryAt, count] = asNumericArray(
    await redis.eval(
      ACQUIRE_SEND_SLOT_SCRIPT,
      2,
      senderRateLimitKey(senderId, now),
      senderSendGateKey(senderId),
      hourlyLimit,
      RATE_LIMIT_TTL_SECONDS,
      now,
      minimumDelayMs,
      Math.max(minimumDelayMs * 2, 60_000),
    ),
  );

  if (allowed === 1) return { allowed: true, reservedUntil: retryAt, count };
  return {
    allowed: false,
    reason: reasonCode === 1 ? 'hourly_limit' : 'minimum_delay',
    retryAt,
    delayMs: Math.max(1, retryAt - now),
    count,
  };
}
