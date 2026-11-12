import type { Announcement, AnnounceAdmin, AnnounceInput, AnnounceProject, AnnounceTemplate } from './announcements'
import type { AppUsage } from './mailroom'

/*
 * A made-up Announcements entrypoint for screenshots and the E2E run
 * (tests/e2e/announcements.spec.ts), never real people or real email: it
 * holds a few projects and announcements in memory, "sends" nothing, and a
 * started announcement counts itself up over about a minute. Only in a local
 * E2E build with ANNOUNCE_FIXTURE=1 (see announceFixtureEnabled).
 */

/**
 * ADMIN_E2E_BUILD is inlined as "" in every other build, so this compiles to
 * `return false`; scripts/check-no-dev-bypass.mjs fails a normal build if
 * ANNOUNCE_FIXTURE survives. Never on a host.
 */
export function announceFixtureEnabled(): boolean {
  if (process.env.ADMIN_E2E_BUILD !== '1') return false
  if (process.env.VERCEL || process.env.APP_ENV) return false
  return process.env.ANNOUNCE_FIXTURE === '1'
}

const DAY = 86_400_000
/** How fast a started announcement "sends" (emails a second). */
const RATE = 4

export const TEMPLATES: AnnounceTemplate[] = [
  {
    id: 'open',
    name: 'Now open',
    fields: [
      { key: 'headline', label: 'Headline', max: 80 },
      { key: 'body', label: 'What is ready', max: 600 },
      { key: 'link', label: 'Link', max: 200 },
    ],
  },
  {
    id: 'progress',
    name: 'Progress update',
    fields: [
      { key: 'headline', label: 'Headline', max: 80 },
      { key: 'body', label: 'What changed', max: 800 },
    ],
  },
  {
    id: 'launched',
    name: 'Launched',
    fields: [
      { key: 'headline', label: 'Headline', max: 80 },
      { key: 'body', label: 'What it does', max: 600 },
      { key: 'link', label: 'Link', max: 200 },
    ],
  },
]

type Row = Announcement & { startedAt: number; rate: number }
type State = { projects: AnnounceProject[]; rows: Row[]; nextId: number }

const STATE = Symbol.for('n8builds-admin.announceFixture')
type WithState = typeof globalThis & { [STATE]?: State }

/** The first of next month, 06:00 UTC: when a send paused at the monthly cap resumes. */
const nextMonth = (now: number) => {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 6)
}

function seed(now: number): State {
  return {
    projects: [
      { slug: 'feelium', name: 'Feelium', confirmed: 214, lastAnnouncedAt: null },
      { slug: 'solara', name: 'Solara', confirmed: 96, lastAnnouncedAt: new Date(now - 45 * DAY).toISOString() },
      { slug: 'pivot', name: 'Pivot', confirmed: 58, lastAnnouncedAt: now - 20 * 60_000 },
      { slug: 'keysready', name: 'KeysReady', confirmed: 180, lastAnnouncedAt: now - 12 * DAY },
      { slug: 'wren', name: 'Wren', confirmed: 41, lastAnnouncedAt: now - 60 * DAY },
      { slug: 'asset-arsenal', name: 'Asset Arsenal', confirmed: 0, lastAnnouncedAt: null },
    ],
    rows: [
      // A send in progress that never moves, so screenshots and the auto-refresh have one to show.
      { id: 'a4', project: 'pivot', subject: 'Pivot is open: try the beta', total: 58, sent: 31, failed: 0, skipped: 1, state: 'sending', lastError: null, nextRunAt: null, startedAt: now - 20 * 60_000, rate: 0 },
      { id: 'a3', project: 'keysready', subject: 'KeysReady: what changed this month', total: 180, sent: 140, failed: 1, skipped: 0, state: 'paused_cap', lastError: 'month_cap: n8builds-web reached its monthly slice', nextRunAt: nextMonth(now), startedAt: now - 12 * DAY, rate: 0 },
      { id: 'a2', project: 'solara', subject: 'Solara has launched', total: 96, sent: 94, failed: 2, skipped: 0, state: 'done', lastError: 'hard_bounce on 2 addresses', nextRunAt: null, startedAt: now - 45 * DAY, rate: 0 },
      { id: 'a1', project: 'wren', subject: 'Wren: a progress update', total: 41, sent: 12, failed: 0, skipped: 0, state: 'cancelled', lastError: null, nextRunAt: null, startedAt: now - 60 * DAY, rate: 0 },
    ],
    nextId: 5,
  }
}

function state(): State {
  const global = globalThis as WithState
  return (global[STATE] ??= seed(Date.now()))
}

/** A row as it stands now: a started one counts up until it is done. */
function current(row: Row, now: number): Announcement {
  const { startedAt, rate, ...announcement } = row
  if (row.state !== 'sending' || rate === 0) return announcement
  const sent = Math.min(row.total, Math.floor(((now - startedAt) / 1000) * rate))
  return { ...announcement, sent, state: sent >= row.total ? 'done' : 'sending' }
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function render(input: AnnounceInput, project: AnnounceProject) {
  const template = TEMPLATES.find((t) => t.id === input.template)
  if (!template) throw new Error(`Unknown template ${input.template}`)
  const field = (key: string) => (input.fields[key] ?? '').trim()
  const headline = field('headline') || template.name
  const subject = headline.includes(project.name) ? headline : `${project.name}: ${headline}`
  const link = field('link')
  const paragraphs = field('body')
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escape(p).replaceAll('\n', '<br>')}</p>`)
    .join('')
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c2333">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 20px;font-size:13px;color:#5b6478">n8builds.dev &middot; ${escape(project.name)}</p>
<div style="background:#fff;border-radius:14px;padding:28px 24px;border:1px solid #e3e6ee">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escape(headline)}</h1>
${paragraphs || '<p style="margin:0 0 16px;color:#8a92a6">(The text goes here.)</p>'}
${link ? `<p style="margin:24px 0 0"><a href="${escape(link)}" style="display:inline-block;background:#0e7490;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${input.template === 'launched' ? 'Try it' : 'Take a look'}</a></p>` : ''}
</div>
<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#5b6478">You get this because you joined the ${escape(project.name)} waitlist on n8builds.dev. <a href="#" style="color:#5b6478">Leave the waitlist</a>.</p>
</div></body></html>`
  const text = `${headline}\n\n${field('body')}${link ? `\n\n${link}` : ''}\n\nYou get this because you joined the ${project.name} waitlist on n8builds.dev. Leave: (link)`
  return { subject, html, text }
}

function projectOf(slug: string): AnnounceProject {
  const project = state().projects.find((p) => p.slug === slug)
  if (!project) throw new Error(`Unknown project ${slug}`)
  return project
}

const fixture: AnnounceAdmin = {
  async projects() {
    return state().projects.map((project) => ({ ...project }))
  },
  async templates() {
    return TEMPLATES
  },
  async preview(input) {
    const project = projectOf(input.project)
    return { ...render(input, project), recipients: project.confirmed }
  },
  async sendTest(input) {
    render(input, projectOf(input.project))
    return { ok: true, messageId: 'fixture-test' }
  },
  async start(input) {
    const project = projectOf(input.project)
    const now = Date.now()
    const last = typeof project.lastAnnouncedAt === 'string' ? Date.parse(project.lastAnnouncedAt) : project.lastAnnouncedAt
    if (last !== null && last + 30 * DAY > now) return { error: 'too_soon', nextAllowedAt: last + 30 * DAY }
    const { subject } = render(input, project)
    const s = state()
    const id = `a${s.nextId++}`
    s.rows.unshift({ id, project: project.slug, subject, total: project.confirmed, sent: 0, failed: 0, skipped: 0, state: 'sending', lastError: null, nextRunAt: null, startedAt: now, rate: RATE })
    project.lastAnnouncedAt = now
    return { id }
  },
  async status(id) {
    const row = state().rows.find((r) => r.id === id)
    if (!row) throw new Error(`Unknown announcement ${id}`)
    return current(row, Date.now())
  },
  async list({ limit }) {
    const now = Date.now()
    return state()
      .rows.slice(0, limit)
      .map((row) => current(row, now))
  },
  async cancel(id) {
    const row = state().rows.find((r) => r.id === id)
    if (!row) return { ok: false, error: 'Unknown announcement' }
    const now = current(row, Date.now())
    if (now.state !== 'sending' && now.state !== 'paused_cap') return { ok: false, error: 'It has already finished' }
    Object.assign(row, now, { state: 'cancelled', rate: 0 })
    return { ok: true }
  },
}

export const fixtureAnnounce = () => fixture

/** n8builds-web's made-up mailroom row: 145 emails left this month, so the biggest list runs past it. */
export function fixtureMailroomApp(): AppUsage {
  return { app: 'n8builds-web', today: 22, month: 455, sentMonth: 455, caps: { day: 150, month: 600, recipientDay: 5 }, defaultDayCap: 150, paused: false, bounces30d: 2, complaints30d: 0, failed30d: 1 }
}
