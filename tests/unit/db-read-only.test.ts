import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { testDatabases, type TestDatabases } from './d1'

/**
 * n8builds-web owns n8builds-waitlist and n8builds-analytics; this dashboard
 * only reads them (docs/DATABASE.md). D1 can't make a binding read-only, so
 * these tests do: they fail if any admin code writes to either database.
 */

vi.mock('server-only', () => ({}))

let dbs: TestDatabases
/** Every statement the admin prepared, per binding. */
const prepared: Record<string, string[]> = {}

/** A binding that records each statement before running it. */
function recording(name: string, db: TestDatabases['waitlist']) {
  return {
    prepare(sql: string) {
      ;(prepared[name] ??= []).push(sql)
      return db.prepare(sql)
    },
    batch: (statements: Parameters<typeof db.batch>[0]) => db.batch(statements),
  }
}

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: {
      WAITLIST_DB: recording('WAITLIST_DB', dbs.waitlist),
      ANALYTICS_DB: recording('ANALYTICS_DB', dbs.analytics),
      ADMIN_DB: recording('ADMIN_DB', dbs.admin),
      WAITLIST_ADMIN: { deleteSubscriber: async () => true },
    },
  }),
}))

const { assertReadOnly, readOnly } = await import('@/lib/db')
const { countByProject, readWaitlist } = await import('@/lib/waitlist')
const { readGameStats } = await import('@/lib/game')
const { readNewsletter } = await import('@/lib/newsletter')
const { readDailyCounts, readDailyFieldTotals, readSnapshots, writeSnapshot } = await import('@/lib/store')

const NOW = new Date('2026-11-04T12:00:00Z')
const TODAY = '2026-11-04'

beforeAll(async () => {
  dbs = await testDatabases()
})
afterAll(() => dbs.dispose())

/** The data n8builds-web would have written, put in directly. */
async function seed() {
  const w = dbs.waitlist
  const subscriber = (id: string, email: string, confirmed: boolean, created: string) =>
    w
      .prepare(
        'INSERT INTO waitlist_subscribers (id, email, note, requested_note, interest, referrer, created_at, updated_at, confirmed_at, expires_at) VALUES (?, ?, ?, \'\', ?, \'\', ?, ?, ?, ?)'
      )
      .bind(id.padEnd(32, '0'), email, '42', 'feelium', created, created, confirmed ? created : null, confirmed ? null : NOW.getTime() + 86_400_000)
  const project = (id: string, slug: string, status: string) =>
    w.prepare('INSERT INTO waitlist_projects (subscriber_id, project, status, requested_at) VALUES (?, ?, ?, ?)').bind(id.padEnd(32, '0'), slug, status, '2026-11-01')
  await w.batch([
    subscriber('a', 'a@example.com', true, '2026-11-01T10:00:00.000Z'),
    subscriber('b', 'b@example.com', true, '2026-11-02T10:00:00.000Z'),
    subscriber('c', 'c@example.com', false, '2026-11-03T10:00:00.000Z'),
    // Unconfirmed and expired: gone as far as the dashboard is concerned.
    w
      .prepare("INSERT INTO waitlist_subscribers (id, email, created_at, updated_at, expires_at) VALUES (?, 'old@example.com', '2026-10-01', '2026-10-01', ?)")
      .bind('d'.padEnd(32, '0'), NOW.getTime() - 1),
    project('a', 'feelium', 'confirmed'),
    project('a', 'keysready', 'confirmed'),
    project('b', 'keysready', 'confirmed'),
    project('b', 'asset-arsenal', 'requested'),
    project('c', 'feelium', 'requested'),
  ])
  const a = dbs.analytics
  const count = (metric: string, day: string, field: string, n: number) =>
    a.prepare('INSERT INTO analytics_daily (metric, day, field, count) VALUES (?, ?, ?, ?)').bind(metric, day, field, n)
  await a.batch([
    count('ref:techforpros', TODAY, 'navbar', 3),
    count('ref:techforpros', '2026-11-03', 'card', 2),
    count('ref:techforpros', '2026-09-01', 'card', 9),
    count('contact:sent', TODAY, '', 4),
    count('game:rounds', TODAY, 'start:n8builds', 5),
    count('game:rounds', TODAY, 'end:n8builds', 4),
    count('game:scores', TODAY, '12', 4),
    count('game:countries', TODAY, 'US', 5),
    a.prepare("INSERT INTO game_players (day, site, player, rounds) VALUES (?, 'n8builds', ?, 3), (?, 'portfolio', ?, 1), (?, 'n8builds', ?, 1)").bind(TODAY, 'p'.repeat(24), TODAY, 'p'.repeat(24), TODAY, 'q'.repeat(24)),
    a.prepare("INSERT INTO game_top (round_id, score, site, country, day) VALUES ('r1', 12, 'n8builds', 'US', ?)").bind(TODAY),
  ])
}

/** Every row of every table, to compare before and after. */
async function snapshotOf(db: TestDatabases['waitlist']): Promise<string> {
  const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name").all<{ name: string }>()
  const out: Record<string, unknown[]> = {}
  for (const { name } of results) out[name] = (await db.prepare(`SELECT * FROM "${name}"`).all()).results
  return JSON.stringify(out)
}

describe('the read-only guard', () => {
  it('allows a single SELECT and nothing else', () => {
    expect(() => assertReadOnly('SELECT 1')).not.toThrow()
    expect(() => assertReadOnly('  with x AS (SELECT 1) SELECT * FROM x;')).not.toThrow()
    for (const sql of [
      'INSERT INTO analytics_daily VALUES (1)',
      'UPDATE waitlist_subscribers SET email = 1',
      'DELETE FROM waitlist_subscribers',
      'REPLACE INTO game_top VALUES (1)',
      'DROP TABLE game_top',
      'PRAGMA foreign_keys = OFF',
      'SELECT 1; DELETE FROM waitlist_subscribers',
      'WITH x AS (DELETE FROM game_top RETURNING *) SELECT * FROM x',
      'CREATE TABLE x (a)',
    ]) {
      expect(() => assertReadOnly(sql), sql).toThrow(/never writes/)
    }
  })

  it('is what the shared databases are handed out as', async () => {
    const db = readOnly(dbs.waitlist)
    await expect(db.all('DELETE FROM waitlist_subscribers')).rejects.toThrow(/never writes/)
    expect(await db.all('SELECT 1 AS one')).toEqual([{ one: 1 }])
  })

  it('no other file reaches the shared bindings or the Cloudflare context directly', () => {
    const root = join(import.meta.dirname, '..', '..')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(ts|tsx|js|mjs)$/.test(name) && relative(root, path) !== join('lib', 'db.ts')) {
          const text = readFileSync(path, 'utf8')
          if (/\.(WAITLIST_DB|ANALYTICS_DB)\b|\[.(WAITLIST_DB|ANALYTICS_DB).\]|getCloudflareContext/.test(text)) offenders.push(relative(root, path))
        }
      }
    }
    for (const dir of ['app', 'components', 'lib', 'worker']) walk(join(root, dir))
    expect(offenders).toEqual([])
  })
})

describe('every reader of the shared databases', () => {
  beforeEach(async () => {
    await dbs.reset()
    for (const key of Object.keys(prepared)) delete prepared[key]
    await seed()
  })

  it('only reads, and leaves both databases exactly as they were', async () => {
    const before = [await snapshotOf(dbs.waitlist), await snapshotOf(dbs.analytics)]
    await readWaitlist(NOW)
    await readNewsletter(NOW)
    await readGameStats(30, NOW)
    await readDailyFieldTotals('ref:techforpros', 30, NOW)
    await readDailyCounts('contact:sent', 30, NOW)
    expect(prepared.WAITLIST_DB?.length).toBeGreaterThan(0)
    expect(prepared.ANALYTICS_DB?.length).toBeGreaterThan(0)
    for (const sql of [...prepared.WAITLIST_DB, ...prepared.ANALYTICS_DB]) expect(() => assertReadOnly(sql), sql).not.toThrow()
    expect([await snapshotOf(dbs.waitlist), await snapshotOf(dbs.analytics)]).toEqual(before)
  })

  it('lists the live waitlist newest first, with confirmed counts per project, KeysReady and Feelium included', async () => {
    const rows = await readWaitlist(NOW)
    expect(rows.map((r) => r.email)).toEqual(['c@example.com', 'b@example.com', 'a@example.com'])
    expect(rows[1]).toMatchObject({ projects: ['keysready'], requested: ['asset-arsenal'], note: '42', interest: 'feelium' })
    expect(rows[0]).toMatchObject({ projects: [], requested: ['feelium'], confirmedAt: '' })
    const counts = Object.fromEntries(countByProject(rows).map((c) => [c.slug, c.confirmed]))
    expect(counts).toEqual({ strollz: 0, vibelog: 0, keysready: 2, 'asset-arsenal': 0, feelium: 1 })
  })

  it('adds up the counters by day and field, over the last 30 days only', async () => {
    const days = await readDailyFieldTotals('ref:techforpros', 30, NOW)
    expect(days).toHaveLength(30)
    expect(days.at(-1)).toEqual({ date: TODAY, total: 3, byField: { navbar: 3 } })
    expect(days.reduce((sum, day) => sum + day.total, 0)).toBe(5)
    expect((await readDailyCounts('contact:sent', 30, NOW)).at(-1)).toEqual({ date: TODAY, count: 4 })
  })

  it("reads the game's rounds, players, tries and top scores", async () => {
    const stats = await readGameStats(30, NOW)
    expect(stats).toMatchObject({ started: 5, finished: 4, playerDays: 2, mostAttempts: 4 })
    expect(stats.days.at(-1)).toMatchObject({ date: TODAY, players: 2 })
    expect(stats.playersBySite).toEqual({ n8builds: 2, portfolio: 1 })
    expect(stats.top).toEqual([{ score: 12, site: 'n8builds', country: 'US', date: TODAY }])
  })
})

describe("the dashboard's own database", () => {
  beforeEach(() => dbs.reset())

  it('keeps one snapshot a day, replaces a rerun, and drops those past 400 days', async () => {
    const snapshot = (date: string, stars: number) => ({ date, stars: { 'n8builds-web': stars }, minutes: { personal: 1, appturnity: 2 } })
    await dbs.admin.prepare("INSERT INTO admin_snapshots (day, data, created_at) VALUES ('2025-09-01', '{}', 'x')").run()
    await writeSnapshot(snapshot(TODAY, 3), NOW)
    await writeSnapshot(snapshot(TODAY, 4), NOW)
    const days = await readSnapshots(30, NOW)
    expect(days.at(-1)).toEqual(snapshot(TODAY, 4))
    expect(days.filter(Boolean)).toHaveLength(1)
    expect((await dbs.admin.prepare('SELECT day FROM admin_snapshots').all()).results).toEqual([{ day: TODAY }])
  })
})
