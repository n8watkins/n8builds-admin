import 'server-only'
import { REVALIDATE_SECONDS } from './cache'

/**
 * The live demos' status from OpenPing (https://openping.n8builds.dev, the
 * owner's uptime monitor). The same public, already-redacted feed the
 * developer portfolio's status pills read (dev-portfolio lib/status.ts).
 */
export const STATUS_PAGE = 'https://openping.n8builds.dev/status'
export const STATUS_FEED = 'https://openping.n8builds.dev/api/public/status'

/** OpenPing checks every 12 minutes while a schedule is on; an older feed means it is off-hours. */
const STALE_AFTER_MS = 30 * 60 * 1000

export type DayBar = { date: string; state: 'up' | 'down' | 'degraded' | 'none' | string; uptimePct: number | null }

export type DemoStatus = {
  name: string
  state: string
  uptime90d: number | null
  /** The last 30 days, oldest first. */
  bars: DayBar[]
}

export type StatusFeed = { overall: string; updatedAt: number | null; offHours: boolean; services: DemoStatus[] }

export async function getDemoStatus(): Promise<StatusFeed> {
  const response = await fetch(STATUS_FEED, { next: { revalidate: REVALIDATE_SECONDS } })
  if (!response.ok) throw new Error(`OpenPing answered ${response.status}`)
  const feed = (await response.json()) as {
    overall?: string
    updatedAt?: number
    groups?: { services?: { name?: string; state?: string; uptime90d?: number; bars?: DayBar[] }[] }[]
  }
  const updatedAt = typeof feed.updatedAt === 'number' ? feed.updatedAt : null
  const services: DemoStatus[] = []
  for (const group of feed.groups ?? []) {
    for (const service of group.services ?? []) {
      if (typeof service.name !== 'string') continue
      services.push({
        name: service.name,
        state: service.state ?? 'unknown',
        uptime90d: typeof service.uptime90d === 'number' ? service.uptime90d : null,
        bars: (service.bars ?? []).slice(-30),
      })
    }
  }
  return {
    overall: feed.overall ?? 'unknown',
    updatedAt,
    offHours: updatedAt !== null && Date.now() - updatedAt > STALE_AFTER_MS,
    services,
  }
}
