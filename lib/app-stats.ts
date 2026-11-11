import 'server-only'
import { cloudflareEnv } from './db'

/**
 * Each app's own admin numbers, read over a service binding to the app's
 * AppStats entrypoint (never a public URL). The shape is the one contract in
 * docs/APP-STATS.md: totals only, never an email, name or per-user row.
 * Actions stay in each app's own admin; this dashboard only links there.
 */

export type AppStatsTone = 'good' | 'warn' | 'bad' | 'quiet'

/** The compact summary a home tile shows. */
export type AppStatsTile = {
  /** The one number to read first, with what it counts ("users"). */
  headline: { value: number; label: string }
  /** Optional usage against a limit (emails this month of the cap). */
  meter?: { value: number; limit: number; label: string }
  /** One short line, e.g. "3 new this week". */
  note: string
  tone: AppStatsTone
}

export type AppStats = {
  /** Bumped only for a breaking change to this shape. */
  schema: 1
  /** Stable id, lowercase ("nettrailers"). */
  app: string
  name: string
  /** ISO time the app built this answer. */
  generatedAt: string
  /** The app's own admin, where every action lives. */
  adminUrl: string
  tile: AppStatsTile
  /** Counts with no limit (users, new this week, active this week). */
  totals: { key: string; label: string; value: number }[]
  /** Counts against a limit (emails today and this month). */
  quotas: { key: string; label: string; used: number; limit: number; period: 'day' | 'month' }[]
  /** Scheduled jobs and how their last run went. */
  jobs: { key: string; label: string; schedule: string; lastRunAt: string | null; status: 'ok' | 'failed' | 'running' | 'never' }[]
  /** Errors the app recorded in the last `windowHours`. */
  errors: { count: number; windowHours: number }
  /** What is live: a version or commit, and when it was deployed (null if unknown). */
  deploy: { version: string; deployedAt: string | null }
}

/** The RPC method every app's entrypoint exposes. */
export type AppStatsEntrypoint = { stats(): Promise<AppStats> }

/** The apps this dashboard reads, by their binding in wrangler.jsonc. */
export const APP_SOURCES = [{ binding: 'NETTRAILERS_ADMIN', app: 'nettrailers', name: 'NetTrailers', adminUrl: 'https://net-trailers.n8builds.dev/admin' }] as const

export type AppSource = (typeof APP_SOURCES)[number]

export type AppStatsResult =
  | { source: AppSource; state: 'ok'; stats: AppStats }
  | { source: AppSource; state: 'unbound' }
  | { source: AppSource; state: 'error'; message: string }

/** Checks an answer has the shape this dashboard renders; anything else is an error, not a crash. */
export function isAppStats(value: unknown): value is AppStats {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<AppStats>
  return (
    v.schema === 1 &&
    typeof v.app === 'string' &&
    typeof v.name === 'string' &&
    typeof v.generatedAt === 'string' &&
    typeof v.adminUrl === 'string' &&
    !!v.tile &&
    typeof v.tile.headline?.value === 'number' &&
    Array.isArray(v.totals) &&
    Array.isArray(v.quotas) &&
    Array.isArray(v.jobs) &&
    typeof v.errors?.count === 'number' &&
    typeof v.deploy?.version === 'string'
  )
}

/** The slowest app may not hold up the Overview. */
const TIMEOUT_MS = 5000

export async function readAppStats(source: AppSource, entrypoint: AppStatsEntrypoint | undefined): Promise<AppStatsResult> {
  if (!entrypoint) return { source, state: 'unbound' }
  try {
    const stats = await Promise.race([
      entrypoint.stats(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${source.name} did not answer in ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS)),
    ])
    if (!isAppStats(stats)) return { source, state: 'error', message: `${source.name} answered in an unexpected shape` }
    return { source, state: 'ok', stats }
  } catch (error) {
    return { source, state: 'error', message: error instanceof Error ? error.message : `${source.name} did not answer` }
  }
}

/** Every app's stats, in APP_SOURCES order; one failing app never hides the others. */
export async function getAllAppStats(): Promise<AppStatsResult[]> {
  const env = (await cloudflareEnv()) as Record<string, unknown> | null
  return Promise.all(APP_SOURCES.map((source) => readAppStats(source, env?.[source.binding] as AppStatsEntrypoint | undefined)))
}
