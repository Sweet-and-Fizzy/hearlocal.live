import { HazeScraper } from '../server/scrapers/venues/haze'

async function main() {
  const scraper = new HazeScraper()
  const result = await scraper.scrape()
  console.log('success:', result.success, 'events:', result.events.length, 'errors:', result.errors)
  for (const e of result.events.slice(0, 6)) {
    console.log(' -', e.startsAt.toISOString(), '|', e.title)
  }
}

main()
