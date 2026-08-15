import { describe, expect, it } from 'vitest';
import { calculateScheduledTimes } from '../scheduler.js';

describe('calculateScheduledTimes', () => {
  it('spaces initial jobs by the requested delay', () => {
    const scheduled = calculateScheduledTimes({
      recipientCount: 3,
      startTime: new Date('2026-08-14T10:00:00.000Z'),
      delayBetweenMs: 5_000,
      hourlyLimit: 50,
    });
    expect(scheduled.map((item) => item.toISOString())).toEqual([
      '2026-08-14T10:00:00.000Z',
      '2026-08-14T10:00:05.000Z',
      '2026-08-14T10:00:10.000Z',
    ]);
  });

  it('moves remaining jobs to the next fixed hour after an hourly limit', () => {
    const scheduled = calculateScheduledTimes({
      recipientCount: 4,
      startTime: new Date('2026-08-14T10:58:00.000Z'),
      delayBetweenMs: 60_000,
      hourlyLimit: 2,
    });
    expect(scheduled.map((item) => item.toISOString())).toEqual([
      '2026-08-14T10:58:00.000Z',
      '2026-08-14T10:59:00.000Z',
      '2026-08-14T11:00:00.000Z',
      '2026-08-14T11:01:00.000Z',
    ]);
  });

  it('calculates a large 1000-recipient batch without dropping timestamps', () => {
    const scheduled = calculateScheduledTimes({
      recipientCount: 1_000,
      startTime: new Date('2026-08-14T10:00:00.000Z'),
      delayBetweenMs: 0,
      hourlyLimit: 50,
    });
    expect(scheduled).toHaveLength(1_000);
    expect(scheduled[0].toISOString()).toBe('2026-08-14T10:00:00.000Z');
    expect(scheduled[50].toISOString()).toBe('2026-08-14T11:00:00.000Z');
    expect(scheduled[999].toISOString()).toBe('2026-08-15T05:00:00.000Z');
  });
});
