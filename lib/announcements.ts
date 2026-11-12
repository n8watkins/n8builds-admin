import 'server-only'
import { announceFixtureEnabled, fixtureAnnounce, fixtureMailroomApp } from './announce-fixture'
import { announceAdmin as boundAnnounceAdmin, isUnreachableBinding } from './db'
import type { Fetched } from './github'
import { getEmailUsage, type AppUsage } from './mailroom'

/**
 * Announcements: emailing a project's confirmed waitlist people when there is
 * news about it. n8builds-web owns everything about them (the subscribers,
 * their leave links, the templates, the 30-day rule and the sending, through
 * mailroom as the n8builds-web app); this page reaches it over the ANNOUNCE
 * service binding to its Announcements entrypoint and never sees an address.
 */

export type TemplateId = 'open' | 'progress' | 'launched'

/** A date as n8builds-web sends it: epoch ms or an ISO string. */
export type When = number | string

export type AnnounceProject = {
  slug: string
  name: string
  /** Confirmed waitlist people for this project, who would get it. */
  confirmed: number
  lastAnnouncedAt: When | null
}

export type TemplateField = { key: string; label: string; max: number }
export type AnnounceTemplate = { id: TemplateId; name: string; fields: TemplateField[] }

export type AnnounceInput = { project: string; template: TemplateId; fields: Record<string, string> }
export type AnnouncePreview = { subject: string; html: string; text: string; recipients: number }

/** mailroom's SendResult. */
export type SendResult = { ok: boolean; code?: string; retryable?: boolean; messageId?: string }

export type StartResult = { id: string | number } | { error: 'too_soon'; nextAllowedAt: When }

export type AnnouncementState = 'sending' | 'paused_cap' | 'done' | 'cancelled'

export type Announcement = {
  id: string | number
  /** The project's slug. */
  project: string
  subject: string
  total: number
  sent: number
  failed: number
  skipped: number
  state: AnnouncementState
  lastError: string | null
  /** When a paused send picks up again. */
  nextRunAt: When | null
}

/** n8builds-web's Announcements entrypoint. */
export type AnnounceAdmin = {
  projects(): Promise<AnnounceProject[]>
  templates(): Promise<AnnounceTemplate[]>
  preview(input: AnnounceInput): Promise<AnnouncePreview>
  sendTest(input: AnnounceInput, actor: string): Promise<SendResult>
  start(input: AnnounceInput, actor: string): Promise<StartResult>
  status(id: string | number): Promise<Announcement>
  list(opts: { limit: number }): Promise<Announcement[]>
  cancel(id: string | number, actor: string): Promise<unknown>
}

/** The app n8builds-web sends as, in mailroom. */
export const SENDER_APP = 'n8builds-web'
export const HISTORY_LIMIT = 50

/** The entrypoint, or null where it isn't bound (or, in a local E2E build, the made-up one). */
export async function announceAdmin(): Promise<AnnounceAdmin | null> {
  if (announceFixtureEnabled()) return fixtureAnnounce()
  return boundAnnounceAdmin()
}

/** Null when the entrypoint isn't there: not bound, or bound before n8builds-web serves it. */
async function read<T>(load: (admin: AnnounceAdmin) => Promise<T>): Promise<Fetched<T> | null> {
  const admin = await announceAdmin()
  if (!admin) return null
  try {
    return { ok: true, data: await load(admin) }
  } catch (error) {
    if (isUnreachableBinding(error)) return null
    return { ok: false, status: 0, message: error instanceof Error ? error.message : 'n8builds-web did not answer' }
  }
}

export const getProjectsAndTemplates = () => read(async (admin) => ({ projects: await admin.projects(), templates: await admin.templates() }))
export const getProjects = () => read((admin) => admin.projects())
export const getHistory = (limit = HISTORY_LIMIT) => read((admin) => admin.list({ limit }))

/**
 * n8builds-web's slice in mailroom this month, which every announcement
 * email counts against; null without mailroom (or with no n8builds-web row).
 */
export async function getSenderUsage(): Promise<AppUsage | null> {
  if (announceFixtureEnabled()) return fixtureMailroomApp()
  const usage = await getEmailUsage()
  if (!usage?.ok) return null
  return usage.data.apps.find((app) => app.app === SENDER_APP) ?? null
}
