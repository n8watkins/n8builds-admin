import 'server-only'
import { adminDb, analyticsDb } from './db'

/**
 * The counters and trends (docs/DATABASE.md):
 * - n8builds-analytics (n8builds-web writes it; read only here): `analytics_daily`
 *   rows of (metric, day, field, count), e.g. `ref:techforpros` by link
 *   placement, `contact:sent`, and the dino game's (lib/game.ts). Daily totals
 *   only: no IPs, no visitor IDs, no cookies.
 * - n8builds-admin (this dashboard's own): `admin_snapshots`, one JSON snapshot
 *   a day written by /api/cron/snapshot, kept SNAPSHOT_KEEP_DAYS.
 * All dates are UTC `YYYY-MM-DD`.
 */

export const SNAPSHOT_KEEP_DAYS = 400

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

/** Whether the counters can be read (the Worker binds n8builds-analytics). */
export async function isAnalyticsConnected(): Promise<boolean> {
  return (await analyticsDb()) !== null
}

/** Whether the daily snapshot can be kept (the Worker binds n8builds-admin). */
export async function isAdminDbConnected(): Promise<boolean> {
  return (await adminDb()) !== null
}

async function analytics() {
  const db = await analyticsDb()
  if (!db) throw new Error('The analytics database is not connected')
  return db
}

export async function readSnapshots(days = 30, now = new Date()): Promise<(Snapshot | null)[]> {
  const db = await adminDb()
  if (!db) throw new Error('The admin database is not connected')
  const dates = lastDays(days, now)
  const { results } = await db.prepare('SELECT day, data FROM admin_snapshots WHERE day >= ? ORDER BY day').bind(dates[0]).all<{ day: string; data: string }>()
  const byDay = new Map(results.map((row) => [row.day, JSON.parse(row.data) as Snapshot]))
  return dates.map((date) => byDay.get(date) ?? null)
}

/** Saves today's snapshot (replacing an earlier run's) and drops the ones past SNAPSHOT_KEEP_DAYS. */
export async function writeSnapshot(snapshot: Snapshot, now = new Date()): Promise<void> {
  const db = await adminDb()
  if (!db) throw new Error('The admin database is not connected')
  const oldest = lastDays(SNAPSHOT_KEEP_DAYS, now)[0]
  await db.batch([
    db
      .prepare('INSERT INTO admin_snapshots (day, data, created_at) VALUES (?, ?, ?) ON CONFLICT (day) DO UPDATE SET data = excluded.data, created_at = excluded.created_at')
      .bind(snapshot.date, JSON.stringify(snapshot), now.toISOString()),
    db.prepare('DELETE FROM admin_snapshots WHERE day < ?').bind(oldest),
  ])
}

/** Daily totals of a counter with fields (`ref:techforpros`, `game:rounds`) over the last `days`. */
export async function readDailyFieldTotals(
  metric: string,
  days = 30,
  now = new Date()
): Promise<{ date: string; total: number; byField: Record<string, number> }[]> {
  const dates = lastDays(days, now)
  const rows = await (await analytics()).all<{ day: string; field: string; count: number }>(
    'SELECT day, field, count FROM analytics_daily WHERE metric = ? AND day >= ?',
    metric,
    dates[0]
  )
  return dates.map((date) => {
    const byField: Record<string, number> = {}
    for (const row of rows) if (row.day === date) byField[row.field] = (byField[row.field] ?? 0) + row.count
    return { date, total: Object.values(byField).reduce((sum, value) => sum + value, 0), byField }
  })
}

/** Daily values of a plain counter (`contact:sent`) over the last `days`. */
export async function readDailyCounts(metric: string, days = 30, now = new Date()): Promise<{ date: string; count: number }[]> {
  return (await readDailyFieldTotals(metric, days, now)).map(({ date, total }) => ({ date, count: total }))
}
