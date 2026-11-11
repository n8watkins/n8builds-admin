import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { testDatabases, type TestDatabases } from './d1'

vi.mock('server-only', () => ({}))

let dbs: TestDatabases
/** Which database the admin sees as WAITLIST_DB, and every statement it prepared there. */
let bound: 'waitlist' | 'analytics' = 'waitlist'
const prepared: string[] = []

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: {
      WAITLIST_DB: {
        prepare(sql: string) {
          prepared.push(sql)
          return dbs[bound].prepare(sql)
        },
      },
    },
  }),
}))

const { digestLine, isStuck, postTitles, readNewsletter, shortDate, subscriberStatus, tileSummary, toDigest } = await import('@/lib/newsletter')

const NOW = new Date('2026-11-11T20:00:00Z')
const at = NOW.getTime()
const HOUR = 60 * 60 * 1000

const digest = (extra: Partial<Parameters<typeof toDigest>[0]> = {}) =>
  toDigest({
    id: 1,
    created_at: '2026-11-09T14:15:00.000Z',
    posts_since: '2026-11-02T14:15:00.000Z',
    posts: JSON.stringify([{ title: 'First post', slug: 'first', publishedAt: '2026-11-05', excerpt: '' }]),
    status: 'sent',
    recipients: 12,
    note: '',
    finished_at: '2026-11-09T14:20:00.000Z',
    delivered: 12,
    ...extra,
  })

describe('newsletter formatting', () => {
  it("reads a digest's post titles, and tolerates JSON that isn't the expected list", () => {
    expect(postTitles('[{"title":"A"},{"title":"B"}]')).toEqual(['A', 'B'])
    expect(postTitles('[{"slug":"x"}]')).toEqual(['Untitled'])
    expect(postTitles('[]')).toEqual([])
    expect(postTitles('{"title":"A"}')).toBeNull()
    expect(postTitles('not json')).toBeNull()
  })

  it('tells confirmed, pending and expired apart', () => {
    expect(subscriberStatus('2026-11-01T00:00:00Z', null, at)).toBe('confirmed')
    expect(subscriberStatus(null, at + 1, at)).toBe('pending')
    expect(subscriberStatus(null, at, at)).toBe('expired')
    expect(subscriberStatus(null, at - 1, at)).toBe('expired')
  })

  it("calls a digest stuck only when it is still 'sending' over an hour after it started", () => {
    const started = (ms: number) => new Date(at - ms).toISOString()
    expect(isStuck({ status: 'sending', createdAt: started(HOUR + 1000) }, at)).toBe(true)
    expect(isStuck({ status: 'sending', createdAt: started(HOUR - 1000) }, at)).toBe(false)
    expect(isStuck({ status: 'sent', createdAt: started(5 * HOUR) }, at)).toBe(false)
    expect(isStuck({ status: 'skipped', createdAt: started(5 * HOUR) }, at)).toBe(false)
  })

  it('describes a digest in a few words, in Pacific time', () => {
    expect(shortDate('2026-11-09T05:00:00.000Z')).toBe('Nov 8')
    expect(digestLine(digest())).toBe('Nov 9: sent to 12')
    expect(digestLine(digest({ recipients: 1234 }))).toBe('Nov 9: sent to 1,234')
    expect(digestLine(digest({ status: 'skipped' }))).toBe('Nov 9: skipped')
    expect(digestLine(digest({ status: 'sending', delivered: 4, finished_at: null }))).toBe('Nov 9: sending, 4 of 12')
  })

  it('sums up the Overview tile, and flags a stuck digest', () => {
    const counts = { confirmed: 1234, pending: 3, expired: 2 }
    expect(tileSummary({ counts, digests: [digest()], subscribers: [] }, at)).toEqual({
      headline: '1,234',
      detail: 'confirmed, 3 pending; digest Nov 9: sent to 12',
      status: 'Fine',
      tone: 'quiet',
    })
    expect(tileSummary({ counts, digests: [], subscribers: [] }, at).detail).toBe('confirmed, 3 pending; no digest yet')
    const stuck = digest({ status: 'sending', delivered: 4, finished_at: null, created_at: new Date(at - 2 * HOUR).toISOString() })
    expect(tileSummary({ counts, digests: [stuck, digest({ id: 0 })], subscribers: [] }, at)).toMatchObject({ status: 'Digest stuck sending', tone: 'warn', detail: 'Nov 11 digest still sending, 4 of 12 delivered' })
  })
})

describe('reading the newsletter', () => {
  beforeAll(async () => {
    dbs = await testDatabases()
  })
  afterAll(() => dbs.dispose())

  beforeEach(async () => {
    bound = 'waitlist'
    prepared.length = 0
    await dbs.reset()
    const w = dbs.waitlist
    const subscriber = (id: string, email: string, created: string, confirmed: string | null, expires: number | null) =>
      w
        .prepare('INSERT INTO newsletter_subscribers (id, email, created_at, confirmed_at, expires_at, confirm_hash, unsubscribe_token) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id.repeat(32), email, created, confirmed, expires, confirmed ? null : id.repeat(64), `unsubscribe-token-${id}`.padEnd(24, 'x'))
    const digestRow = (id: number, created: string, status: string, recipients: number, note: string, finished: string | null) =>
      w
        .prepare('INSERT INTO newsletter_digests (id, created_at, posts_since, posts, status, recipients, note, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, created, '2026-10-01T00:00:00.000Z', '[{"title":"A post","slug":"a","publishedAt":"2026-11-01","excerpt":""}]', status, recipients, note, finished)
    await w.batch([
      subscriber('a', 'alice@example.com', '2026-11-01T10:00:00.000Z', '2026-11-01T10:05:00.000Z', null),
      subscriber('b', 'bo@example.com', '2026-11-02T10:00:00.000Z', '2026-11-02T10:05:00.000Z', null),
      subscriber('c', 'carol@example.org', '2026-11-10T10:00:00.000Z', null, at + 86_400_000),
      subscriber('d', 'dee@example.net', '2026-10-20T10:00:00.000Z', null, at - 1),
      digestRow(1, '2026-10-26T14:15:00.000Z', 'skipped', 2, 'Skipped: past the monthly budget.', '2026-10-26T14:15:00.000Z'),
      digestRow(2, '2026-11-09T14:15:00.000Z', 'sending', 2, '', null),
      w.prepare("INSERT INTO newsletter_deliveries (digest_id, subscriber_id, sent_at) VALUES (2, ?, '2026-11-09T14:16:00.000Z')").bind('a'.repeat(32)),
    ])
  })

  it('counts confirmed, pending and expired, and lists digests newest first with their deliveries', async () => {
    const data = await readNewsletter(NOW)
    if (data === 'no-tables') throw new Error('expected the tables')
    expect(data.counts).toEqual({ confirmed: 2, pending: 1, expired: 1 })
    expect(data.digests.map((d) => [d.id, d.status, d.recipients, d.delivered, d.posts, d.note])).toEqual([
      [2, 'sending', 2, 1, ['A post'], ''],
      [1, 'skipped', 2, 0, ['A post'], 'Skipped: past the monthly budget.'],
    ])
    expect(tileSummary(data, at)).toMatchObject({ headline: '2', tone: 'warn' })
  })

  it('masks every address in the query and never reads a token', async () => {
    const data = await readNewsletter(NOW)
    if (data === 'no-tables') throw new Error('expected the tables')
    expect(data.subscribers).toEqual([
      { address: 'ca***@example.org', createdAt: '2026-11-10T10:00:00.000Z', confirmedAt: '', status: 'pending' },
      { address: 'b***@example.com', createdAt: '2026-11-02T10:00:00.000Z', confirmedAt: '2026-11-02T10:05:00.000Z', status: 'confirmed' },
      { address: 'al***@example.com', createdAt: '2026-11-01T10:00:00.000Z', confirmedAt: '2026-11-01T10:05:00.000Z', status: 'confirmed' },
      { address: 'd***@example.net', createdAt: '2026-10-20T10:00:00.000Z', confirmedAt: '', status: 'expired' },
    ])
    const everything = JSON.stringify(data)
    for (const secret of ['alice@', 'carol@', 'unsubscribe-token', 'a'.repeat(64)]) expect(everything).not.toContain(secret)
    for (const sql of prepared) expect(sql).not.toMatch(/confirm_hash|unsubscribe_token|SELECT\s+\*|\.\*/)
  })

  it("says 'no-tables' while n8builds-web's newsletter migration hasn't reached the database", async () => {
    // n8builds-analytics has none of the newsletter's tables.
    bound = 'analytics'
    expect(await readNewsletter(NOW)).toBe('no-tables')
  })
})
