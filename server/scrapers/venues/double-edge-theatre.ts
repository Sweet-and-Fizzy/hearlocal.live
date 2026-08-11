import { EventbriteScraper, type EventbriteScraperConfig } from '../platforms/eventbrite'

const config: EventbriteScraperConfig = {
  id: 'double-edge-theatre',
  name: 'Double Edge Theatre',
  venueSlug: 'double-edge-theatre',
  organizerId: '28696770023',
  url: '', // Set by EventbriteScraper based on organizerId
  enabled: true,
  schedule: '0 6,14 * * *', // 6 AM and 2 PM daily
  category: 'VENUE',
  priority: 10,
  timezone: 'America/New_York',
}

/**
 * Scraper for Double Edge Theatre in Ashfield, MA
 *
 * Their website's /performances/ pages are historical archives; current
 * shows are ticketed through Eventbrite, so we scrape their organizer
 * account. Replaces a DB-stored AI scraper that had extracted nothing
 * since March 2026. Note the organizer often has zero future events
 * between seasonal productions — that is not a scraper failure.
 */
export class DoubleEdgeTheatreScraper extends EventbriteScraper {
  constructor() {
    super(config)
  }
}
