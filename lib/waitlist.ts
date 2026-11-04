import 'server-only'
import { Redis } from '@upstash/redis'
import { isStoreConnected } from '@/lib/store'

/**
 * The n8builds.dev waitlist (/upcoming), written by n8builds-web
 * (lib/waitlist/store.ts there) into the analytics database:
 * - `waitlist:entry:<id>`  hash per address: email, projects, requested, note,
 *   requestedNote, createdAt, updatedAt, confirmedAt, interest, referrer, token
 * - `waitlist:token:<t>`   the entry id behind its confirm and leave links
 * - `waitlist:all`         sorted set of entry ids by sign-up time
 * Unconfirmed entries expire after 7 days; their ids linger in `waitlist:all`
 * until this page reads the list and drops them.
 */

/** In n8builds.dev's order (UPCOMING_SLUGS in n8builds-web's data/upcoming.ts); add a project there and here together. */
export const PROJECTS = [
  { slug: 'relink', name: 'Relink' },
  { slug: 'strollz', name: 'Strollz' },
  { slug: 'vibelog', name: 'VibeLog' },
  { slug: 'keysready', name: 'KeysReady' },
  { slug: 'asset-arsenal', name: 'Asset Arsenal' },
  { slug: 'feelium', name: 'Feelium' },
] as const

/** A project's display name; an unknown slug shows as itself. */
export const projectName = (slug: string) => PROJECTS.find((p) => p.slug === slug)?.name ?? slug

export type WaitlistRow = {
  id: string
  email: string
  projects: string[]
  requested: string[]
  note: string
  requestedNote: string
  createdAt: string
  confirmedAt: string
  interest: string
  referrer: string
  token: string
}

let client: Redis | null = null
/** Its own client without JSON parsing, so a note such as "42" stays a string. */
function redis(): Redis {
  if (!isStoreConnected()) throw new Error('The analytics database is not connected')
  client ??= new Redis({
    url: process.env.ANALYTICS_REDIS_REST_URL!,
    token: process.env.ANALYTICS_REDIS_REST_TOKEN!,
    automaticDeserialization: false,
  })
  return client
}

const list = (value: string | undefined) => (value ? value.split(',').filter(Boolean) : [])

/**
 * An entry hash as HGETALL returns it. With automatic deserialization off, the
 * client hands back Redis's flat [field, value, ...] list instead of an object,
 * and an empty list for a missing key.
 */
type Hash = Record<string, string> | string[] | null

function fieldsOf(hash: Hash): Record<string, string> | null {
  if (!Array.isArray(hash)) return hash
  if (hash.length === 0) return null
  const fields: Record<string, string> = {}
  for (let i = 0; i + 1 < hash.length; i += 2) fields[hash[i]] = hash[i + 1]
  return fields
}

export function toRow(id: string, hash: Hash): WaitlistRow | null {
  const fields = fieldsOf(hash)
  if (!fields?.email) return null
  return {
    id,
    email: fields.email,
    projects: list(fields.projects),
    requested: list(fields.requested),
    note: fields.note ?? '',
    requestedNote: fields.requestedNote ?? '',
    createdAt: fields.createdAt ?? '',
    confirmedAt: fields.confirmedAt ?? '',
    interest: fields.interest ?? '',
    referrer: fields.referrer ?? '',
    token: fields.token ?? '',
  }
}

/**
 * The index entries to put back: every entry hash whose id is missing from
 * waitlist:all, scored by its createdAt, as n8builds-web's store writes it.
 * An entry with no usable createdAt is left out rather than guessed.
 */
export function missingFromIndex(
  entries: { id: string; createdAt: string | null }[],
  indexed: Set<string>
): { score: number; member: string }[] {
  return entries
    .filter((entry) => !indexed.has(entry.id))
    .map((entry) => ({ score: Date.parse(entry.createdAt ?? ''), member: entry.id }))
    .filter((entry) => Number.isFinite(entry.score))
}

/**
 * Puts back any entry missing from waitlist:all (an early version of the
 * Waitlist page dropped every id it misread). Additive and idempotent, so it
 * runs on every visit and also covers any future drift; unconfirmed entries
 * still expire on their own TTL, and the read below then prunes their ids.
 */
export async function repairIndex(): Promise<number> {
  const ids: string[] = []
  let cursor = '0'
  do {
    const [next, keys] = await redis().scan(cursor, { match: 'waitlist:entry:*', count: 500 })
    cursor = String(next)
    for (const key of keys) ids.push(key.slice('waitlist:entry:'.length))
  } while (cursor !== '0')
  if (ids.length === 0) return 0
  const indexed = new Set(await redis().zrange<string[]>('waitlist:all', 0, -1))
  const missing = ids.filter((id) => !indexed.has(id))
  if (missing.length === 0) return 0
  const pipeline = redis().pipeline()
  for (const id of missing) pipeline.hget(`waitlist:entry:${id}`, 'createdAt')
  const created = (await pipeline.exec()) as (string | null)[]
  const adds = missingFromIndex(missing.map((id, index) => ({ id, createdAt: created[index] })), indexed)
  if (adds.length === 0) return 0
  const [first, ...rest] = adds
  await redis().zadd('waitlist:all', first, ...rest)
  console.info(`waitlist: put ${adds.length} missing entr${adds.length === 1 ? 'y' : 'ies'} back in waitlist:all`)
  return adds.length
}

/** Every entry, newest first; ids whose entry expired are dropped from the list. */
export async function readWaitlist(): Promise<WaitlistRow[]> {
  await repairIndex()
  const ids = await redis().zrange<string[]>('waitlist:all', 0, -1, { rev: true })
  if (ids.length === 0) return []
  const pipeline = redis().pipeline()
  for (const id of ids) pipeline.hgetall(`waitlist:entry:${id}`)
  const results = (await pipeline.exec()) as Hash[]
  const rows = ids.map((id, index) => toRow(id, results[index]))
  const gone = ids.filter((_, index) => !rows[index])
  if (gone.length > 0) await redis().zrem('waitlist:all', ...gone)
  return rows.filter((row): row is WaitlistRow => row !== null)
}

/** Deletes an entry, its link token and its place in the list (a deletion request). */
export async function deleteEntry(id: string): Promise<void> {
  const token = await redis().hget<string>(`waitlist:entry:${id}`, 'token')
  const tx = redis().multi()
  tx.del(`waitlist:entry:${id}`, ...(token ? [`waitlist:token:${token}`] : []))
  tx.zrem('waitlist:all', id)
  await tx.exec()
}

/** Confirmed sign-ups per project. */
export function countByProject(rows: WaitlistRow[]): { slug: string; name: string; confirmed: number; emails: string[] }[] {
  return PROJECTS.map((project) => {
    const emails = rows.filter((row) => row.confirmedAt && row.projects.includes(project.slug)).map((row) => row.email)
    return { ...project, confirmed: emails.length, emails }
  })
}
