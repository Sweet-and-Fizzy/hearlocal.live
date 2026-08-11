import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseHazeCalendar } from '../venues/haze'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const fixture = readFileSync(join(fixturesDir, 'haze-homepage.html'), 'utf-8')

describe('parseHazeCalendar', () => {
  const events = parseHazeCalendar(fixture)

  it('extracts events from the server-rendered calendar section', () => {
    // The fixture month (August 2026) has ~22 unique events
    expect(events.length).toBeGreaterThanOrEqual(10)
  })

  it('does not double-count events from the desktop calendar view', () => {
    const ids = events.map(e => e.sourceEventId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('extracts known event titles', () => {
    const titles = events.map(e => e.title)
    expect(titles).toContain('Haze 1 year anniversary party!!')
    expect(titles).toContain('Game day!')
  })

  it('parses the scraped date and time as UTC (site SSR renders UTC)', () => {
    // Scraped HTML says "Sunday, Aug 9 / 7:00 PM" for Game day!, which is the
    // UTC rendering of Sunday Aug 9 3:00 PM Eastern (verified against the
    // hydrated desktop calendar).
    const gameDay = events.find(
      e => e.title === 'Game day!' && e.sourceEventId?.includes('2026-08-09')
    )
    expect(gameDay).toBeDefined()
    expect(gameDay!.startsAt.toISOString()).toBe('2026-08-09T19:00:00.000Z')
  })

  it('recovers cross-midnight events (evening Eastern shows on the next UTC day)', () => {
    // Scraped HTML lists the anniversary party under "Sunday, Aug 9" at
    // "2:00 AM" — really Saturday Aug 8, 10:00 PM Eastern.
    const anniversary = events.find(e => e.title === 'Haze 1 year anniversary party!!')
    expect(anniversary).toBeDefined()
    expect(anniversary!.startsAt.toISOString()).toBe('2026-08-09T02:00:00.000Z')
  })

  it('keeps all events within the calendar month', () => {
    for (const e of events) {
      expect(e.startsAt.getUTCFullYear()).toBe(2026)
    }
  })

  it('omits imageUrl because calendar images are short-lived signed URLs', () => {
    for (const e of events) {
      expect(e.imageUrl).toBeUndefined()
    }
  })
})
