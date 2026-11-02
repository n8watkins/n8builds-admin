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

export const PROJECTS = [
  { slug: 'relink', name: 'Relink' },
  { slug: 'strollz', name: 'Strollz' },
  { slug: 'vibelog', name: 'VibeLog' },
] as const

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

export function toRow(id: string, fields: Record<string, string> | null): WaitlistRow | null {
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

/** Every entry, newest first; ids whose entry expired are dropped from the list. */
export async function readWaitlist(): Promise<WaitlistRow[]> {
  const ids = await redis().zrange<string[]>('waitlist:all', 0, -1, { rev: true })
  if (ids.length === 0) return []
  const pipeline = redis().pipeline()
  for (const id of ids) pipeline.hgetall(`waitlist:entry:${id}`)
  const results = (await pipeline.exec()) as (Record<string, string> | null)[]
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
