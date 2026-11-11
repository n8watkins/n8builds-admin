import 'server-only'
import { waitlistDb, type ReadOnlyDb } from '@/lib/db'
import { formatNumber } from '@/lib/format'

/**
 * The blog newsletter (n8builds.dev's "get new posts by email"), in
 * n8builds-waitlist beside the waitlist, which n8builds-web owns and writes
 * (its migrations/waitlist/0002_newsletter.sql and lib/newsletter/):
 * - newsletter_subscribers  one row per address; confirmed_at null while it
 *   waits for its confirm link, until expires_at; deleted on unsubscribe
 * - newsletter_digests      one row per weekly digest: sending, sent or skipped
 * - newsletter_deliveries   who has had which digest
 * This dashboard only reads them, and never reads a token or a full address:
 * addresses are masked inside the query ("jo***@example.com", as mailroom
 * masks them), and confirm_hash and unsubscribe_token are never selected.
 */

export const TABLES = ['newsletter_subscribers', 'newsletter_digests', 'newsletter_deliveries'] as const

/**
 * A sending digest with no delivery for this long needs a look. n8builds-web
 * sends at most 30 a run (its RUN_LIMIT) and runs daily, so a long list
 * legitimately sends over several days; 26 hours is a missed daily run plus slack.
 */
export const STUCK_AFTER_MS = 26 * 60 * 60 * 1000

/** Digests and subscribers the page lists. */
export const DIGEST_LIMIT = 26
export const SUBSCRIBER_LIMIT = 200

export type DigestStatus = 'sending' | 'sent' | 'skipped'

export type Counts = {
  confirmed: number
  /** Waiting for the confirm link, still inside its 7 days. */
  pending: number
  /** Never confirmed and past expires_at: n8builds-web deletes these. */
  expired: number
}

export type Digest = {
  id: number
  createdAt: string
  postsSince: string
  status: DigestStatus
  /** Confirmed subscribers when it started. */
  recipients: number
  /** Deliveries recorded so far. */
  delivered: number
  /** The newest delivery's sent_at; empty before the first. */
  lastSentAt: string
  /** The post titles it carries, newest first as stored; null when the JSON can't be read. */
  posts: string[] | null
  note: string
  finishedAt: string
}

export type SubscriberStatus = 'confirmed' | 'pending' | 'expired'

export type Subscriber = {
  /** Masked: the first two characters (one for a short name) and the domain. */
  address: string
  createdAt: string
  confirmedAt: string
  status: SubscriberStatus
}

export type Newsletter = { counts: Counts; digests: Digest[]; subscribers: Subscriber[] }

/**
 * The address, masked in SQL so the full one never leaves the database:
 * "jo***@example.com", one character kept for a name of three or fewer.
 * The same rule as mailroom's maskAddress (n8watkins/mailroom, src/admin.ts).
 */
export const MASKED_EMAIL = `CASE
  WHEN instr(email, '@') <= 1 THEN '***'
  WHEN instr(email, '@') <= 4 THEN substr(email, 1, 1) || '***' || substr(email, instr(email, '@'))
  ELSE substr(email, 1, 2) || '***' || substr(email, instr(email, '@'))
END`

/** The post titles in a digest's `posts` JSON ([{ title, slug, publishedAt, excerpt }]); null when it isn't that. */
export function postTitles(json: string): string[] | null {
  try {
    const posts: unknown = JSON.parse(json)
    if (!Array.isArray(posts)) return null
    return posts.map((post) => (post && typeof post === 'object' && typeof (post as { title?: unknown }).title === 'string' ? (post as { title: string }).title : 'Untitled'))
  } catch {
    return null
  }
}

/** A subscriber's state at `now`: confirmed, waiting for the link, or past its 7 days. */
export function subscriberStatus(confirmedAt: string | null, expiresAt: number | null, now: number): SubscriberStatus {
  if (confirmedAt) return 'confirmed'
  return expiresAt !== null && expiresAt <= now ? 'expired' : 'pending'
}

/** When a digest last moved: its newest delivery, or its start before the first. */
export const lastProgress = (digest: Pick<Digest, 'createdAt' | 'lastSentAt'>) => digest.lastSentAt || digest.createdAt

/** A digest still 'sending' with no delivery for STUCK_AFTER_MS (26 hours): not just slow, stopped. */
export function isStuck(digest: Pick<Digest, 'status' | 'createdAt' | 'lastSentAt'>, now: number): boolean {
  return digest.status === 'sending' && now - Date.parse(lastProgress(digest)) > STUCK_AFTER_MS
}

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })

/** "Nov 9" (Pacific, like the Waitlist page); empty for no date. */
export const shortDate = (iso: string) => (iso ? DAY.format(new Date(iso)) : '')

const DAY_TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })

/** "Nov 9, 6:15 AM" (Pacific); empty for no date. */
export const shortDateTime = (iso: string) => (iso ? DAY_TIME.format(new Date(iso)) : '')

/** A digest in a few words: "Nov 9: sent to 12", "Nov 2: skipped", "Nov 10: sending, 4 of 12". */
export function digestLine(digest: Digest): string {
  const when = shortDate(digest.createdAt)
  if (digest.status === 'sent') return `${when}: sent to ${formatNumber(digest.recipients)}`
  if (digest.status === 'skipped') return `${when}: skipped`
  return `${when}: sending, ${formatNumber(digest.delivered)} of ${formatNumber(digest.recipients)}`
}

/** The Overview tile: confirmed readers up top, then pending and the last digest; a stuck digest needs attention. */
export function tileSummary(data: Newsletter, now: number): { headline: string; detail: string; status: string; tone: 'warn' | 'quiet' } {
  const { confirmed, pending } = data.counts
  const headline = formatNumber(confirmed)
  const stuck = data.digests.find((digest) => isStuck(digest, now))
  if (stuck) {
    return { headline, detail: `${shortDate(stuck.createdAt)} digest stalled since ${shortDate(lastProgress(stuck))}, ${formatNumber(stuck.delivered)} of ${formatNumber(stuck.recipients)} delivered`, status: 'Digest stalled', tone: 'warn' }
  }
  const last = data.digests[0]
  return { headline, detail: `confirmed, ${formatNumber(pending)} pending; ${last ? `digest ${digestLine(last)}` : 'no digest yet'}`, status: 'Fine', tone: 'quiet' }
}

/** Whether n8builds-web's newsletter migration has reached this database. */
async function hasTables(db: ReadOnlyDb): Promise<boolean> {
  const rows = await db.all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${TABLES.map(() => '?').join(', ')})`, ...TABLES)
  return rows.length === TABLES.length
}

type CountsRow = { confirmed: number | null; pending: number | null; expired: number | null }
type DigestRow = { id: number; created_at: string; posts_since: string; posts: string; status: DigestStatus; recipients: number; note: string; finished_at: string | null; delivered: number; last_sent_at: string | null }
type SubscriberRow = { address: string; created_at: string; confirmed_at: string | null; expires_at: number | null }

export function toDigest(row: DigestRow): Digest {
  return {
    id: row.id,
    createdAt: row.created_at,
    postsSince: row.posts_since,
    status: row.status,
    recipients: row.recipients,
    delivered: row.delivered,
    lastSentAt: row.last_sent_at ?? '',
    posts: postTitles(row.posts),
    note: row.note,
    finishedAt: row.finished_at ?? '',
  }
}

/**
 * The newsletter as the page shows it, or 'no-tables' while n8builds-web's
 * newsletter migration hasn't reached n8builds-waitlist. Throws when the
 * database isn't bound (check isWaitlistConnected first).
 */
export async function readNewsletter(now = new Date()): Promise<Newsletter | 'no-tables'> {
  const db = await waitlistDb()
  if (!db) throw new Error('The waitlist database is not connected')
  if (!(await hasTables(db))) return 'no-tables'
  const at = now.getTime()
  const [counts, digests, subscribers] = await Promise.all([
    db.first<CountsRow>(
      `SELECT SUM(confirmed_at IS NOT NULL) AS confirmed,
              SUM(confirmed_at IS NULL AND (expires_at IS NULL OR expires_at > ?)) AS pending,
              SUM(confirmed_at IS NULL AND expires_at <= ?) AS expired
       FROM newsletter_subscribers`,
      at,
      at
    ),
    db.all<DigestRow>(
      `SELECT g.id, g.created_at, g.posts_since, g.posts, g.status, g.recipients, g.note, g.finished_at,
              (SELECT COUNT(*) FROM newsletter_deliveries d WHERE d.digest_id = g.id) AS delivered,
              (SELECT MAX(sent_at) FROM newsletter_deliveries d WHERE d.digest_id = g.id) AS last_sent_at
       FROM newsletter_digests g ORDER BY g.id DESC LIMIT ?`,
      DIGEST_LIMIT
    ),
    db.all<SubscriberRow>(
      `SELECT ${MASKED_EMAIL} AS address, created_at, confirmed_at, expires_at
       FROM newsletter_subscribers ORDER BY created_at DESC LIMIT ?`,
      SUBSCRIBER_LIMIT
    ),
  ])
  return {
    counts: { confirmed: counts?.confirmed ?? 0, pending: counts?.pending ?? 0, expired: counts?.expired ?? 0 },
    digests: digests.map(toDigest),
    subscribers: subscribers.map((row) => ({
      address: row.address,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at ?? '',
      status: subscriberStatus(row.confirmed_at, row.expires_at, at),
    })),
  }
}
