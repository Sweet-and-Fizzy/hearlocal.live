import { fromZonedTime } from 'date-fns-tz'

/**
 * Parse a community-submitted event end time into a UTC Date.
 *
 * An end time at or before the show time means the event crosses midnight
 * (e.g. 9 PM–1 AM), so it rolls to the following calendar day. The rollover
 * re-derives the date string rather than adding 24 hours so DST transitions
 * don't shift the wall-clock time.
 */
export function parseEndsAt(
  date: string,
  showTime: string,
  endTime: string | null | undefined,
  timezone: string
): Date | null {
  if (!endTime) return null

  const startsAt = fromZonedTime(`${date}T${showTime}:00`, timezone)
  let endsAt = fromZonedTime(`${date}T${endTime}:00`, timezone)

  if (endsAt <= startsAt) {
    const nextDay = new Date(`${date}T00:00:00Z`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const nextDateStr = nextDay.toISOString().split('T')[0]
    endsAt = fromZonedTime(`${nextDateStr}T${endTime}:00`, timezone)
  }

  return endsAt
}
