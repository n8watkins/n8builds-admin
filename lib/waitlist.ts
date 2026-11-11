import 'server-only'
import { waitlistDb, waitlistWriter } from '@/lib/db'

/**
 * The n8builds.dev waitlist (/upcoming), in n8builds-waitlist, which
 * n8builds-web owns and writes (its lib/waitlist/store.ts and docs/DATABASE.md):
 * - waitlist_subscribers  one row per address: email, note, interest,
 *   referrer, created_at, confirmed_at; unconfirmed rows expire after 7 days
 * - waitlist_projects     one row per address and project, requested or confirmed
 * This dashboard only reads them; a deletion goes through n8builds-web.
 */

/** In n8builds.dev's order (UPCOMING_SLUGS in n8builds-web's data/upcoming.ts); add a project there and here together. */
export const PROJECTS = [
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
}

type SubscriberRow = {
  id: string
  email: string
  note: string
  requested_note: string
  interest: string
  referrer: string
  created_at: string
  confirmed_at: string | null
}

type ProjectRow = { subscriber_id: string; project: string; status: 'requested' | 'confirmed' }

/** One subscriber and its project rows, as the page shows them. */
export function toRow(subscriber: SubscriberRow, projects: ProjectRow[]): WaitlistRow {
  const mine = projects.filter((p) => p.subscriber_id === subscriber.id)
  return {
    id: subscriber.id,
    email: subscriber.email,
    projects: mine.filter((p) => p.status === 'confirmed').map((p) => p.project),
    requested: mine.filter((p) => p.status === 'requested').map((p) => p.project),
    note: subscriber.note,
    requestedNote: subscriber.requested_note,
    createdAt: subscriber.created_at,
    confirmedAt: subscriber.confirmed_at ?? '',
    interest: subscriber.interest,
    referrer: subscriber.referrer,
  }
}

/** Whether the list can be read (the Worker binds n8builds-waitlist). */
export async function isWaitlistConnected(): Promise<boolean> {
  return (await waitlistDb()) !== null
}

/** Every live entry, newest first (an unconfirmed one past its 7 days is gone). */
export async function readWaitlist(now = new Date()): Promise<WaitlistRow[]> {
  const db = await waitlistDb()
  if (!db) throw new Error('The waitlist database is not connected')
  const at = now.getTime()
  const [subscribers, projects] = await Promise.all([
    db.all<SubscriberRow>(
      `SELECT id, email, note, requested_note, interest, referrer, created_at, confirmed_at
       FROM waitlist_subscribers WHERE expires_at IS NULL OR expires_at > ? ORDER BY created_at DESC`,
      at
    ),
    db.all<ProjectRow>(
      `SELECT p.subscriber_id, p.project, p.status FROM waitlist_projects p
       JOIN waitlist_subscribers s ON s.id = p.subscriber_id
       WHERE s.expires_at IS NULL OR s.expires_at > ? ORDER BY p.requested_at, p.project`,
      at
    ),
  ])
  return subscribers.map((subscriber) => toRow(subscriber, projects))
}

/**
 * Deletes an entry with everything stored with it (a deletion request), through
 * n8builds-web's WaitlistAdmin entrypoint: this dashboard never writes the waitlist.
 */
export async function deleteEntry(id: string): Promise<void> {
  const writer = await waitlistWriter()
  if (!writer) throw new Error('Deleting needs the WAITLIST_ADMIN service binding (the Cloudflare Worker)')
  await writer.deleteSubscriber(id)
}

/** Confirmed sign-ups per project. */
export function countByProject(rows: WaitlistRow[]): { slug: string; name: string; confirmed: number; emails: string[] }[] {
  return PROJECTS.map((project) => {
    const emails = rows.filter((row) => row.confirmedAt && row.projects.includes(project.slug)).map((row) => row.email)
    return { ...project, confirmed: emails.length, emails }
  })
}
