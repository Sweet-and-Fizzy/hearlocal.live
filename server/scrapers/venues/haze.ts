import { HttpScraper } from '../base'
import type { ScrapedEvent, ScraperConfig } from '../types'
import * as cheerio from 'cheerio'
import { slugify } from '../../utils/html'

/**
 * Scraper for Haze Northampton
 *
 * The venue replaced its old PHP site with a Next.js site (www subdomain)
 * in early 2026. The events calendar is server-rendered on the homepage in
 * a section with id="calendar": a month header ("August 2026"), then day
 * blocks ("Sunday, Aug 9") each containing events identified by
 * aria-label="Event details: <title>" with a time span ("7:00 PM").
 *
 * IMPORTANT: the server-rendered day headings and times are in UTC, not
 * Eastern — the site's SSR formats dates without a timezone and the client
 * only fixes them up in the hydrated desktop grid. "Wednesday, Aug 12,
 * 12:00 AM" in the scraped HTML is really Tuesday Aug 11 8:00 PM Eastern
 * (verified against the rendered desktop calendar, 2026-08-11). We therefore
 * parse date+time as UTC to recover the true instant. If the venue ever
 * fixes their SSR to render Eastern times, the fixture test will catch the
 * shift.
 *
 * Only the current month is server-rendered (month paging is client-side),
 * so each daily run covers the month in progress.
 */

export const hazeConfig: ScraperConfig = {
  id: 'haze',
  name: 'Haze Northampton',
  venueSlug: 'haze',
  url: 'https://www.hazenorthampton.org/',
  enabled: true,
  schedule: '0 6,14 * * *',
  category: 'VENUE',
  priority: 10,
  timezone: 'America/New_York',
  defaultAgeRestriction: 'TWENTY_ONE_PLUS', // Bar venue
}

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Parse the server-rendered calendar section of the Haze homepage.
 * Exported for testing.
 */
export function parseHazeCalendar(html: string): ScrapedEvent[] {
  const $ = cheerio.load(html)
  const calendar = $('#calendar')
  if (calendar.length === 0) return []

  // Month header, e.g. "August 2026"
  const monthHeader = calendar
    .find('p')
    .filter((_, el) => /^[A-Z][a-z]+ \d{4}$/.test($(el).text().trim()))
    .first()
    .text()
    .trim()
  const headerMatch = monthHeader.match(/^([A-Z][a-z]+) (\d{4})$/)
  if (!headerMatch) return []
  const year = parseInt(headerMatch[2]!, 10)

  const events: ScrapedEvent[] = []

  // The mobile list view contains one block per day; the desktop grid
  // duplicates every event, so we only parse the mobile container.
  const mobileList = calendar.find('div[class*="md:hidden"]').first()

  mobileList.children('div').each((_, dayEl) => {
    const $day = $(dayEl)

    // Day heading, e.g. "Sunday, Aug 9"
    const heading = $day.find('p').first().text().trim()
    const dayMatch = heading.match(/([A-Z][a-z]{2})\s+(\d{1,2})$/)
    if (!dayMatch) return
    const month = MONTHS[dayMatch[1]!]
    if (!month) return
    const day = parseInt(dayMatch[2]!, 10)

    $day.find('[aria-label^="Event details:"]').each((_, evEl) => {
      const $ev = $(evEl)
      const title = ($ev.attr('aria-label') || '')
        .replace(/^Event details:\s*/, '')
        .trim()
      if (!title) return

      // Time span, e.g. "7:00 PM"; default to 23:00 UTC (~7 PM Eastern) when absent
      const timeText = $ev
        .find('span')
        .filter((_, s) => /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test($(s).text().trim()))
        .first()
        .text()
        .trim()
      let hour = 23
      let minute = 0
      const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      if (timeMatch) {
        hour = parseInt(timeMatch[1]!, 10)
        minute = parseInt(timeMatch[2]!, 10)
        const ampm = timeMatch[3]!.toUpperCase()
        if (ampm === 'PM' && hour !== 12) hour += 12
        if (ampm === 'AM' && hour === 12) hour = 0
      }

      const dateStr = `${year}-${pad(month)}-${pad(day)}`
      // The scraped date+time is UTC (see module comment)
      const startsAt = new Date(`${dateStr}T${pad(hour)}:${pad(minute)}:00Z`)

      // Note: calendar flyer images are pre-signed S3 URLs that expire within
      // an hour, so we deliberately do not store imageUrl.
      events.push({
        title,
        startsAt,
        sourceUrl: 'https://www.hazenorthampton.org/#calendar',
        sourceEventId: `haze-${dateStr}-${slugify(title)}`,
      })
    })
  })

  return events
}

export class HazeScraper extends HttpScraper {
  constructor() {
    super(hazeConfig)
  }

  protected async parseEvents(html: string): Promise<ScrapedEvent[]> {
    const now = new Date()
    return parseHazeCalendar(html).filter(e => e.startsAt >= now)
  }
}
