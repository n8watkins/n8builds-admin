import 'server-only'
import { Redis } from '@upstash/redis'

/**
 * The analytics database: a second free Upstash database, separate from the
 * contact form's, so counters can never use up the form's quota and switch it
 * off. Its counters are daily totals: no IPs, no visitor IDs, no cookies. The one
 * exception is the waitlist, which keeps the addresses people chose to give.
 *
 * Keys (all dates are UTC `YYYY-MM-DD`):
 * - `snapshot:<date>`            JSON Snapshot, written once a day by /api/cron/snapshot, kept 400 days.
 * - `ref:appturnity:<date>`      hash: link placement -> clicks from n8builds.dev to appturnity.com.
 * - `contact:sent:<date>`        integer: contact messages delivered that day.
 * The last two are written by n8builds-web (not built yet; see the panels' plans).
 * - `waitlist:*`                 the /upcoming waitlist's sign-ups (emails people gave, with consent), lib/waitlist.ts.
 */
export function isStoreConnected(): boolean {
  return Boolean(process.env.ANALYTICS_REDIS_REST_URL && process.env.ANALYTICS_REDIS_REST_TOKEN)
}

let client: Redis | null = null

export function store(): Redis {
  if (!isStoreConnected()) throw new Error('The analytics database is not connected')
  client ??= new Redis({ url: process.env.ANALYTICS_REDIS_REST_URL!, token: process.env.ANALYTICS_REDIS_REST_TOKEN! })
  return client
}

export const SNAPSHOT_TTL_SECONDS = 400 * 24 * 60 * 60

export type Snapshot = {
  date: string
  stars: Record<string, number>
  /** Actions minutes used so far this month, per account. */
  minutes: { personal: number | null; appturnity: number | null }
}

export function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The last `days` UTC dates, oldest first, ending today. */
export function lastDays(days: number, now = new Date()): string[] {
  return Array.from({ length: days }, (_, index) => utcDate(new Date(now.getTime() - (days - 1 - index) * 86_400_000)))
}

export async function readSnapshots(days = 30): Promise<(Snapshot | null)[]> {
  const keys = lastDays(days).map((date) => `snapshot:${date}`)
  return store().mget<(Snapshot | null)[]>(...keys)
}

/** Daily totals of a hash counter (`ref:appturnity`) over the last `days`. */
export async function readDailyHashTotals(prefix: string, days = 30): Promise<{ date: string; total: number; byField: Record<string, number> }[]> {
  const dates = lastDays(days)
  const pipeline = store().pipeline()
  for (const date of dates) pipeline.hgetall(`${prefix}:${date}`)
  const results = (await pipeline.exec()) as (Record<string, number | string> | null)[]
  return dates.map((date, index) => {
    const byField = Object.fromEntries(Object.entries(results[index] ?? {}).map(([field, value]) => [field, Number(value) || 0]))
    return { date, total: Object.values(byField).reduce((sum, value) => sum + value, 0), byField }
  })
}

/** Daily values of an integer counter (`contact:sent`) over the last `days`. */
export async function readDailyCounts(prefix: string, days = 30): Promise<{ date: string; count: number }[]> {
  const dates = lastDays(days)
  const values = await store().mget<(number | string | null)[]>(...dates.map((date) => `${prefix}:${date}`))
  return dates.map((date, index) => ({ date, count: Number(values[index]) || 0 }))
}
