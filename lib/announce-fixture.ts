import type { Announcement, AnnounceAdmin, AnnounceInput, AnnounceProject, AnnounceTemplate, TemplateField, TemplateId } from './announcements'
import type { AppUsage } from './mailroom'

/*
 * A made-up Announcements entrypoint for screenshots and the E2E run
 * (tests/e2e/announcements*.spec.ts), never real people or real email. It
 * behaves like n8builds-web's (its lib/announce/service.ts and templates.ts):
 * the same templates and checks, each project's default copy, the 30-day rule,
 * no_recipients, and a started announcement that sends 20 at once and then
 * counts itself up. It holds everything in memory and sends nothing.
 *
 * ANNOUNCE_FIXTURE=1 has projects with people and a history;
 * ANNOUNCE_FIXTURE=empty has the projects with nobody confirmed yet, as
 * n8builds-web is today. Only in a local E2E build (announceFixtureEnabled).
 */

/**
 * ADMIN_E2E_BUILD is inlined as "" in every other build, so this compiles to
 * `return false`; scripts/check-no-dev-bypass.mjs fails a normal build if
 * ANNOUNCE_FIXTURE survives. Never on a host.
 */
export function announceFixtureEnabled(): boolean {
  if (process.env.ADMIN_E2E_BUILD !== '1') return false
  if (process.env.VERCEL || process.env.APP_ENV) return false
  return process.env.ANNOUNCE_FIXTURE === '1' || process.env.ANNOUNCE_FIXTURE === 'empty'
}

const fixtureMode = () => (process.env.ANNOUNCE_FIXTURE === 'empty' ? 'empty' : 'full')

const DAY = 86_400_000
/** After the first 20, how fast a started announcement "sends" (emails a second). */
const RATE = 4

const SUBJECT: TemplateField = { key: 'subject', label: 'Subject', max: 120, required: true }
const TITLE: TemplateField = { key: 'title', label: 'Title', max: 80, required: true }
const BODY: TemplateField = { key: 'body', label: 'Body (a blank line starts a paragraph)', max: 800, required: true }
const BUTTON_LABEL: TemplateField = { key: 'buttonLabel', label: 'Button label', max: 40, required: true }
const BUTTON_URL: TemplateField = { key: 'buttonUrl', label: 'Button link (https)', max: 300, required: true }
const PERK: TemplateField = { key: 'perk', label: 'Early sign-up perk (optional)', max: 200, required: false }
const SELF_HOST: TemplateField = { key: 'selfHost', label: 'Self-host line (optional, links to the repository)', max: 160, required: false }

export const TEMPLATES: AnnounceTemplate[] = [
  { id: 'open', name: "It's open", fields: [SUBJECT, TITLE, BODY, BUTTON_LABEL, BUTTON_URL] },
  { id: 'progress', name: 'Progress update', fields: [SUBJECT, TITLE, BODY, BUTTON_LABEL, BUTTON_URL] },
  { id: 'launched', name: 'It launched', fields: [SUBJECT, TITLE, BODY, PERK, BUTTON_LABEL, BUTTON_URL, SELF_HOST] },
]

const PLACEHOLDER = /\[\[[^\]]*\]\]/

type FixtureProject = AnnounceProject & { summary: string; landing: string; repo: boolean }

function defaults(project: FixtureProject, template: TemplateId): Record<string, string> {
  const name = project.name
  const common = { perk: '', selfHost: '', buttonUrl: project.landing }
  switch (template) {
    case 'open':
      return { ...common, subject: `Early access to ${name} is open`, title: `${name}: early access is open`, body: `You joined the waitlist for ${name}, and early access is open now.\n\n${project.summary}\n\nIt's early, so tell me what works and what doesn't: just reply to this email.`, buttonLabel: `Try ${name}` }
    case 'progress':
      return { ...common, subject: `${name}: a progress update`, title: `Where ${name} stands`, body: `You joined the waitlist for ${name}, so here's a short update on where it stands.\n\n[[What changed, and what comes next]]`, buttonLabel: `See ${name}` }
    case 'launched':
      return { ...common, subject: `${name} is open, and your early spot is ready`, title: `${name} is ready`, body: `You joined the waitlist for ${name}, and it's ready.\n\n${project.summary}`, buttonLabel: `Open ${name}`, selfHost: project.repo ? 'Rather self-host? It stays free and open source.' : '' }
  }
}

type Row = Announcement & { startedAt: number; rate: number }
type State = { projects: FixtureProject[]; rows: Row[] }

const STATE = Symbol.for('n8builds-admin.announceFixture')
type WithState = typeof globalThis & { [STATE]?: State }

const hexId = () => crypto.randomUUID().replaceAll('-', '')
const iso = (ms: number) => new Date(ms).toISOString()
const startOfDay = (now: number) => {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
const startOfMonth = (now: number) => {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

const PROJECTS = (now: number): FixtureProject[] => [
  { slug: 'feelium', name: 'Feelium', confirmed: 214, lastAnnouncedAt: null, summary: 'A mood journal that takes two taps a day and shows the week at a glance.', landing: 'https://n8builds.dev/upcoming/feelium', repo: true },
  { slug: 'wren', name: 'Wren', confirmed: 41, lastAnnouncedAt: iso(now - 60 * DAY), summary: 'A calm reader for the newsletters you actually want.', landing: 'https://n8builds.dev/upcoming/wren', repo: false },
  { slug: 'solara', name: 'Solara', confirmed: 26, lastAnnouncedAt: iso(now - 45 * DAY), summary: 'Plan a solar setup for your roof in an evening.', landing: 'https://n8builds.dev/upcoming/solara', repo: true },
  { slug: 'pivot', name: 'Pivot', confirmed: 58, lastAnnouncedAt: null, summary: 'Spreadsheets that explain themselves.', landing: 'https://n8builds.dev/upcoming/pivot', repo: false },
  { slug: 'keysready', name: 'KeysReady', confirmed: 180, lastAnnouncedAt: null, summary: 'Every key handover for a rental, in one checklist.', landing: 'https://n8builds.dev/upcoming/keysready', repo: true },
  { slug: 'asset-arsenal', name: 'Asset Arsenal', confirmed: 0, lastAnnouncedAt: null, summary: 'Icons and illustrations for side projects.', landing: 'https://n8builds.dev/upcoming/asset-arsenal', repo: true },
]

function seed(now: number): State {
  const projects = PROJECTS(now)
  if (fixtureMode() === 'empty') return { projects: projects.map((p) => ({ ...p, confirmed: 0, lastAnnouncedAt: null })), rows: [] }
  // Inside this UTC day and month whatever the date, so the budget adds up the same.
  const pivotAt = Math.max(startOfDay(now), now - 20 * 60_000)
  const keysAt = Math.max(startOfMonth(now), now - 3 * DAY)
  const solaraAt = now - 45 * DAY
  const wrenAt = now - 60 * DAY
  const set = (slug: string, at: number) => Object.assign(projects.find((p) => p.slug === slug)!, { lastAnnouncedAt: iso(at) })
  set('pivot', pivotAt)
  set('keysready', keysAt)
  const row = (r: Omit<Row, 'id' | 'rate' | 'createdBy'> & { createdBy?: string }): Row => ({ id: hexId(), rate: 0, createdBy: 'n8watkins', ...r })
  return {
    projects,
    rows: [
      // A send in progress that never moves, so screenshots and the auto-refresh have one to show.
      row({ project: 'pivot', template: 'open', subject: 'Early access to Pivot is open', total: 58, sent: 12, failed: 0, skipped: 1, state: 'sending', lastError: null, nextRunAt: iso(now + 15 * 60_000), createdAt: iso(pivotAt), finishedAt: null, startedAt: pivotAt }),
      row({ project: 'keysready', template: 'progress', subject: 'KeysReady: a progress update', total: 180, sent: 40, failed: 1, skipped: 0, state: 'paused_cap', lastError: 'budget_day', nextRunAt: iso(startOfDay(now) + DAY), createdAt: iso(keysAt), finishedAt: null, startedAt: keysAt }),
      row({ project: 'solara', template: 'launched', subject: 'Solara is open, and your early spot is ready', total: 26, sent: 24, failed: 2, skipped: 0, state: 'done', lastError: null, nextRunAt: null, createdAt: iso(solaraAt), finishedAt: iso(solaraAt + 2 * 3_600_000), startedAt: solaraAt }),
      row({ project: 'wren', template: 'progress', subject: 'Wren: a progress update', total: 41, sent: 12, failed: 0, skipped: 29, state: 'cancelled', lastError: null, nextRunAt: null, createdAt: iso(wrenAt), finishedAt: iso(wrenAt + 3_600_000), startedAt: wrenAt }),
    ],
  }
}

function state(): State {
  const global = globalThis as WithState
  return (global[STATE] ??= seed(Date.now()))
}

/** A row as it stands now: a started one sends 20 at once, then counts up until it is done. */
function current(row: Row, now: number): Announcement {
  const { startedAt, rate, ...announcement } = row
  if (row.state !== 'sending' || rate === 0) return announcement
  const sent = Math.min(row.total, 20 + Math.floor(((now - startedAt) / 1000) * rate))
  const done = sent >= row.total
  return { ...announcement, sent, state: done ? 'done' : 'sending', finishedAt: done ? iso(startedAt + ((row.total - 20) / rate) * 1000) : null, nextRunAt: done ? null : announcement.nextRunAt }
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** n8builds-web's resolveFields: the defaults, the request on top, then its checks. Throws like it does. */
function resolve(input: AnnounceInput): { project: FixtureProject; template: AnnounceTemplate; fields: Record<string, string> } {
  const project = state().projects.find((p) => p.slug === input?.project)
  if (!project) throw new Error(`unknown project: ${String(input?.project)}`)
  const template = TEMPLATES.find((t) => t.id === input.template)
  if (!template) throw new Error(`unknown template: ${String(input.template)}`)
  const fields = defaults(project, template.id)
  for (const field of template.fields) {
    const value = input.fields?.[field.key]
    if (value === undefined || value === null) continue
    fields[field.key] = String(value).replace(/\r\n?/g, '\n').trim()
  }
  for (const key of Object.keys(fields)) if (!template.fields.some((f) => f.key === key)) fields[key] = ''
  for (const field of template.fields) {
    const value = fields[field.key]
    if (field.required && !value) throw new Error(`${field.label} is required`)
    if (value.length > field.max) throw new Error(`${field.label} is longer than ${field.max} characters`)
    if (field.key !== 'body' && value.includes('\n')) throw new Error(`${field.label} must be one line`)
  }
  if (!/^https:\/\//.test(fields.buttonUrl)) throw new Error('The button link must start with https://')
  return { project, template, fields }
}

function render(project: FixtureProject, fields: Record<string, string>) {
  const paragraphs = fields.body
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:25px;color:#c9d3e6">${escape(p.trim()).replaceAll('\n', '<br>')}</p>`)
    .join('')
  const html = `<!doctype html><html><body style="margin:0;background:#050b1a;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:28px 16px">
<p style="margin:0 0 18px;font-size:15px;font-weight:700;color:#fff">n8builds<span style="color:#22d3ee">.dev</span></p>
<div style="background:#0b1430;border:1px solid #1c2a4d;border-radius:16px;padding:32px 28px">
<h1 style="margin:0 0 16px;font-size:24px;line-height:31px;color:#fff">${escape(fields.title)}</h1>
${paragraphs}
<div style="margin:18px 0 0;padding:12px 14px;border:1px solid #1c2a4d;border-radius:12px"><p style="margin:0;font-weight:700;color:#fff">${escape(project.name)}</p><p style="margin:4px 0 0;font-size:14px;color:#8a99b8">${escape(project.summary)}</p></div>
${fields.perk ? `<p style="margin:20px 0 0;padding:12px 16px;border-left:3px solid #22d3ee;background:#101c3d;color:#c9d3e6">${escape(fields.perk)}</p>` : ''}
<p style="margin:26px 0 0"><a href="${escape(fields.buttonUrl)}" style="display:inline-block;background:#22d3ee;color:#04122b;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">${escape(fields.buttonLabel)}</a></p>
${fields.selfHost ? `<p style="margin:16px 0 0;font-size:14px;color:#8a99b8"><a href="#" style="color:#8a99b8">${escape(fields.selfHost)}</a></p>` : ''}
<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #1c2a4d;font-size:17px;font-weight:800;color:#fff">Nathan</p>
</div>
<p style="margin:18px 4px 0;font-size:12px;line-height:18px;color:#6b7a99">You're getting this because you confirmed a spot on the ${escape(project.name)} waitlist at n8builds.dev. <a href="#" style="color:#6b7a99">Manage or leave the waitlist</a></p>
</div></body></html>`
  const text = `${fields.title}\n\n${fields.body}\n\n${fields.buttonLabel}: ${fields.buttonUrl}\n\nNathan`
  return { subject: fields.subject, html, text }
}

const fixture: AnnounceAdmin = {
  async projects() {
    return state().projects.map(({ slug, name, confirmed, lastAnnouncedAt }) => ({ slug, name, confirmed, lastAnnouncedAt }))
  },
  async templates() {
    return TEMPLATES
  },
  async preview(input) {
    const { project, fields } = resolve(input)
    return { ...render(project, fields), recipients: project.confirmed, fields }
  },
  async sendTest(input) {
    resolve(input)
    return { ok: true, messageId: 'fixture-test' }
  },
  async start(input, actor) {
    const { project, template, fields } = resolve(input)
    if (PLACEHOLDER.test(Object.values(fields).join('\n'))) throw new Error('Replace the [[...]] placeholder with your own words first')
    const now = Date.now()
    const last = project.lastAnnouncedAt === null ? null : typeof project.lastAnnouncedAt === 'string' ? Date.parse(project.lastAnnouncedAt) : project.lastAnnouncedAt
    if (last !== null && last + 30 * DAY > now) return { error: 'too_soon', nextAllowedAt: iso(last + 30 * DAY) }
    if (project.confirmed === 0) return { error: 'no_recipients' }
    const id = hexId()
    state().rows.unshift({
      id,
      project: project.slug,
      template: template.id,
      subject: fields.subject,
      total: project.confirmed,
      sent: 0,
      failed: 0,
      skipped: 0,
      state: 'sending',
      lastError: null,
      nextRunAt: iso(now + 15 * 60_000),
      createdAt: iso(now),
      createdBy: actor,
      finishedAt: null,
      startedAt: now,
      rate: RATE,
    })
    project.lastAnnouncedAt = iso(now)
    return { id }
  },
  async status(id) {
    const row = state().rows.find((r) => r.id === id)
    return row ? current(row, Date.now()) : null
  },
  async list({ limit }) {
    const now = Date.now()
    return state()
      .rows.slice(0, limit)
      .map((row) => current(row, now))
  },
  async cancel(id) {
    const row = state().rows.find((r) => r.id === id)
    if (!row) return null
    const now = current(row, Date.now())
    if (now.state !== 'sending' && now.state !== 'paused_cap') return now
    Object.assign(row, now, { state: 'cancelled', rate: 0, skipped: now.total - now.sent - now.failed, nextRunAt: null, finishedAt: iso(Date.now()) })
    return current(row, Date.now())
  },
}

export const fixtureAnnounce = () => fixture

/** n8builds-web's made-up mailroom row: its slice of 200 a month and 60 a day, with contact and waitlist mail in it. */
export function fixtureMailroomApp(): AppUsage {
  return { app: 'n8builds-web', today: 18, month: 95, sentMonth: 95, caps: { day: 60, month: 200, recipientDay: 5 }, defaultDayCap: 60, paused: false, bounces30d: 2, complaints30d: 0, failed30d: 1 }
}
