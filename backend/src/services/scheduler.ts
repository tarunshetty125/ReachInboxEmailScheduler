const HOUR_MS = 60 * 60 * 1000;

export interface ScheduleInput {
  recipientCount: number;
  startTime: Date;
  delayBetweenMs: number;
  hourlyLimit: number;
}

/**
 * Produces initial intended delayed-job timestamps. Runtime Redis checks remain
 * authoritative because workers can race, restart, or be horizontally scaled.
 */
export function calculateScheduledTimes({
  recipientCount,
  startTime,
  delayBetweenMs,
  hourlyLimit,
}: ScheduleInput): Date[] {
  if (!Number.isInteger(recipientCount) || recipientCount < 1) return [];
  if (delayBetweenMs < 0 || hourlyLimit < 1) {
    throw new Error('Invalid scheduling configuration');
  }

  const scheduled: Date[] = [];
  const countsByHour = new Map<number, number>();
  let candidateMs = startTime.getTime();

  for (let index = 0; index < recipientCount; index += 1) {
    let hourWindow = Math.floor(candidateMs / HOUR_MS);
    let count = countsByHour.get(hourWindow) ?? 0;

    if (count >= hourlyLimit) {
      candidateMs = (hourWindow + 1) * HOUR_MS;
      hourWindow = Math.floor(candidateMs / HOUR_MS);
      count = countsByHour.get(hourWindow) ?? 0;
    }

    scheduled.push(new Date(candidateMs));
    countsByHour.set(hourWindow, count + 1);
    candidateMs += delayBetweenMs;
  }

  return scheduled;
}

export const HOUR_IN_MS = HOUR_MS;
