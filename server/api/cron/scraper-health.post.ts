/**
 * Cron endpoint for daily scraper health digest
 * POST /api/cron/scraper-health
 *
 * Checks for scrapers that are:
 * - Stale (haven't run successfully in 3+ days)
 * - Failing (3+ consecutive failures)
 * - Disabled (isActive = false but should be running)
 *
 * Add to crontab:
 *   0 7 * * * curl -sX POST "http://localhost:3000/api/cron/scraper-health?token=$CRON_SECRET"
 */

import prisma from '../../utils/prisma'
import { verifyCronAuth } from '../../utils/cron-auth'
import { notifyScraperHealthDigest, type StaleScraperInfo } from '../../services/notifications'

// List of hardcoded scraper slugs for reference
const HARDCODED_SCRAPER_SLUGS = [
  'iron-horse',
  'parlor-room',
  'the-drake',
  'new-city-brewery',
  'haze',
  'de-la-luz',
  'marigold',
  'progression-brewing',
  'stone-church',
  'marigold-brattleboro',
  'luthiers',
  'fame',
  'daily-operation',
  'the-heavy-culture-coop',
  'double-edge-theatre',
]

export default defineEventHandler(async (event) => {
  verifyCronAuth(event)

  console.log('[Cron] Running scraper health check...')

  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const silentThresholdDays = 30

  // Get all active scrapers
  const sources = await prisma.source.findMany({
    where: {
      type: 'SCRAPER',
    },
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      lastRunAt: true,
      lastRunStatus: true,
      consecutiveFailures: true,
      lastEventCount: true,
    },
  })

  // Most recent scraped event per source, to catch scrapers that "succeed"
  // with zero events long after the venue's calendar moved on.
  const lastEventBySource = await prisma.eventSource.groupBy({
    by: ['sourceId'],
    _max: { scrapedAt: true },
  })
  const lastEventMap = new Map(
    lastEventBySource.map(row => [row.sourceId, row._max.scrapedAt])
  )

  const staleScrapers: StaleScraperInfo[] = []
  const failingScrapers: StaleScraperInfo[] = []
  const disabledScrapers: StaleScraperInfo[] = []
  const silentScrapers: StaleScraperInfo[] = []

  for (const source of sources) {
    const isHardcoded = HARDCODED_SCRAPER_SLUGS.includes(source.slug)
    const daysSinceLastRun = source.lastRunAt
      ? Math.floor((now.getTime() - source.lastRunAt.getTime()) / (1000 * 60 * 60 * 24))
      : null

    const lastEventAt = lastEventMap.get(source.id) || null
    const daysSinceLastEvent = lastEventAt
      ? Math.floor((now.getTime() - lastEventAt.getTime()) / (1000 * 60 * 60 * 24))
      : null

    const info: StaleScraperInfo = {
      slug: source.slug,
      name: source.name,
      lastRunAt: source.lastRunAt,
      lastRunStatus: source.lastRunStatus,
      consecutiveFailures: source.consecutiveFailures || 0,
      daysSinceLastRun,
      isHardcoded,
      daysSinceLastEvent,
    }

    // Check if disabled
    if (!source.isActive) {
      disabledScrapers.push(info)
      continue // Don't also report as stale/failing
    }

    // Check if stale (active but hasn't run in 3+ days)
    if (!source.lastRunAt || source.lastRunAt < threeDaysAgo) {
      staleScrapers.push(info)
      continue
    }

    // Check if failing (3+ consecutive failures)
    if ((source.consecutiveFailures || 0) >= 3) {
      failingScrapers.push(info)
      continue
    }

    // Check if silently dead: runs report success but return zero events.
    // lastEventCount is the primary signal (a venue with a stable calendar
    // legitimately yields no NEW events for months — e.g. an amphitheater
    // season announced once — so "nothing new lately" alone is a false
    // positive). Fall back to first-seen staleness only when lastEventCount
    // has never been recorded (sources that predate that tracking).
    const silentByCount = source.lastEventCount === 0
    const silentByStaleness =
      source.lastEventCount === null
      && (daysSinceLastEvent === null || daysSinceLastEvent >= silentThresholdDays)
    if (source.lastRunStatus === 'success' && (silentByCount || silentByStaleness)) {
      silentScrapers.push(info)
    }
  }

  // Sort by severity/age
  staleScrapers.sort((a, b) => (b.daysSinceLastRun || 999) - (a.daysSinceLastRun || 999))
  failingScrapers.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures)
  silentScrapers.sort((a, b) => (b.daysSinceLastEvent ?? 9999) - (a.daysSinceLastEvent ?? 9999))

  console.log(`[Cron] Health check: ${staleScrapers.length} stale, ${failingScrapers.length} failing, ${silentScrapers.length} silent, ${disabledScrapers.length} disabled`)

  // Send notification if there are issues
  await notifyScraperHealthDigest({
    staleScrapers,
    failingScrapers,
    disabledScrapers,
    silentScrapers,
    adminUrl: process.env.NUXT_PUBLIC_SITE_URL
      ? `${process.env.NUXT_PUBLIC_SITE_URL}/admin/scrapers`
      : undefined,
  })

  return {
    success: true,
    timestamp: now.toISOString(),
    summary: {
      total: sources.length,
      stale: staleScrapers.length,
      failing: failingScrapers.length,
      silent: silentScrapers.length,
      disabled: disabledScrapers.length,
    },
    staleScrapers: staleScrapers.map(s => s.slug),
    failingScrapers: failingScrapers.map(s => s.slug),
    silentScrapers: silentScrapers.map(s => s.slug),
    disabledScrapers: disabledScrapers.map(s => s.slug),
  }
})
