import { describe, it, expect } from 'vitest'
import { parseEndsAt } from '../event-times'

describe('parseEndsAt', () => {
  const tz = 'America/New_York'

  it('returns null when no end time is given', () => {
    expect(parseEndsAt('2026-08-15', '20:00', '', tz)).toBeNull()
    expect(parseEndsAt('2026-08-15', '20:00', undefined, tz)).toBeNull()
  })

  it('parses a same-evening end time', () => {
    // 8 PM show ending 11 PM Eastern (EDT, UTC-4)
    const endsAt = parseEndsAt('2026-08-15', '20:00', '23:00', tz)
    expect(endsAt?.toISOString()).toBe('2026-08-16T03:00:00.000Z')
  })

  it('rolls an end time at or before the show time to the next day', () => {
    // 9 PM show ending 1 AM = 1 AM the following day
    const endsAt = parseEndsAt('2026-08-15', '21:00', '01:00', tz)
    expect(endsAt?.toISOString()).toBe('2026-08-16T05:00:00.000Z')
  })

  it('rolls an end time equal to the show time (ambiguous) to the next day', () => {
    const endsAt = parseEndsAt('2026-08-15', '20:00', '20:00', tz)
    expect(endsAt?.toISOString()).toBe('2026-08-17T00:00:00.000Z')
  })

  it('handles the DST fall-back boundary without drifting an hour', () => {
    // Nov 1 2026: clocks fall back at 2 AM Eastern. 9 PM show ending 1 AM
    // lands on Nov 2, which is EST (UTC-5).
    const endsAt = parseEndsAt('2026-11-01', '21:00', '01:00', tz)
    expect(endsAt?.toISOString()).toBe('2026-11-02T06:00:00.000Z')
  })
})
