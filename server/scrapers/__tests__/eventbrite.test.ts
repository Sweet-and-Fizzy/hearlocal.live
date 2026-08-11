import { describe, expect, it } from 'vitest'
import {
  findEventLd,
  formatOffersPrice,
  parseAgeRestrictionFromText,
} from '../platforms/eventbrite'

describe('findEventLd', () => {
  it('finds a top-level Event block', () => {
    const blocks = [
      { '@type': 'WebPage', name: 'ignore' },
      { '@type': 'Event', name: 'Show', startDate: '2026-08-18T19:00:00-04:00' },
    ]
    expect(findEventLd(blocks)?.name).toBe('Show')
  })

  it('finds an Event inside an array block and matches subtypes', () => {
    const blocks = [[{ '@type': 'MusicEvent', name: 'Gig' }]]
    expect(findEventLd(blocks)?.name).toBe('Gig')
  })

  it('finds an Event nested in @graph', () => {
    const blocks = [{ '@graph': [{ '@type': 'WebPage' }, { '@type': 'Event', name: 'Play' }] }]
    expect(findEventLd(blocks)?.name).toBe('Play')
  })

  it('returns null when no Event exists', () => {
    expect(findEventLd([{ '@type': 'WebPage' }])).toBeNull()
  })
})

describe('formatOffersPrice', () => {
  it('formats a single price', () => {
    expect(formatOffersPrice({ price: '26.38' })).toBe('$26.38')
  })

  it('formats a range from lowPrice/highPrice', () => {
    expect(formatOffersPrice([{ lowPrice: 10, highPrice: 25 }])).toBe('$10-$25')
  })

  it('returns Free when all prices are zero', () => {
    expect(formatOffersPrice({ price: 0 })).toBe('Free')
  })

  it('returns undefined for missing offers', () => {
    expect(formatOffersPrice(undefined)).toBeUndefined()
  })
})

describe('parseAgeRestrictionFromText', () => {
  it('detects 21+', () => {
    expect(parseAgeRestrictionFromText('This event is 21+ only')).toBe('TWENTY_ONE_PLUS')
  })

  it('detects 18 and over', () => {
    expect(parseAgeRestrictionFromText('18 and over welcome')).toBe('EIGHTEEN_PLUS')
  })

  it('detects all ages', () => {
    expect(parseAgeRestrictionFromText('All ages show')).toBe('ALL_AGES')
  })

  it('returns undefined when nothing matches', () => {
    expect(parseAgeRestrictionFromText('Doors at 7')).toBeUndefined()
  })
})
