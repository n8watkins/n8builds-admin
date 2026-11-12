import type { Tone } from '@/components/ui'
import type { Announcement, AnnounceProject, AnnounceTemplate, TemplateField, When } from './announcements'
import { formatNumber } from './format'
import type { AppUsage } from './mailroom'

/*
 * What the Announcements page shows, worked out from n8builds-web's and
 * mailroom's answers. Plain functions, no I/O, so the rules are unit-tested
 * (tests/unit/announcements.test.ts) and the server and the browser agree.
 */

const DAY_MS = 86_400_000

/**
 * n8builds-web's budget for announcements inside its mailroom slice (200 a
 * month, 60 a day), leaving the rest for the contact form and waitlist mail
 * (its DAY_BUDGET and MONTH_BUDGET in lib/announce/service.ts). Its cron sends
 * up to perRun every runEveryMinutes, and start() sends the first batch at once.
 */
export const ANNOUNCE_BUDGET = { day: 40, month: 140, perRun: 20, runEveryMinutes: 15 } as const

/** n8builds-web announces a project at most once in this many days (its start() answers too_soon). */
export const COOLDOWN_DAYS = 30

/** Epoch ms from n8builds-web's ISO string (or a number); null for nothing or nonsense. */
export function toMs(when: When | null | undefined): number | null {
  if (when === null || when === undefined || when === '') return null
  const ms = typeof when === 'number' ? when : Date.parse(when)
  return Number.isFinite(ms) ? ms : null
}

/** "Nov 9", with the year when it isn't this year's ("Dec 30, 2025"). UTC, as the rest of the admin. */
export function formatDay(when: When | null | undefined, now: number): string {
  const ms = toMs(when)
  if (ms === null) return '-'
  const date = new Date(ms)
  const sameYear = date.getUTCFullYear() === new Date(now).getUTCFullYear()
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' })
}

/** "Nov 9, 14:00 UTC". */
export function formatDayTime(when: When | null | undefined, now: number): string {
  const ms = toMs(when)
  if (ms === null) return '-'
  const time = new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })
  return `${formatDay(ms, now)}, ${time} UTC`
}

/** "1 person", "240 people". */
export const formatPeople = (n: number) => `${formatNumber(n)} ${n === 1 ? 'person' : 'people'}`

export type ProjectChoice = {
  slug: string
  name: string
  confirmed: number
  /** Whether it can be picked right now. */
  available: boolean
  /** When the 30 days since the last announcement are up; null when it isn't waiting. */
  opensAt: number | null
  /** The one line under its name: when it was last announced, or why it can't be picked. */
  note: string
}

/** A project as the picker shows it: the 30-day rule, and nobody to send to. */
export function projectChoice(project: AnnounceProject, now: number): ProjectChoice {
  const last = toMs(project.lastAnnouncedAt)
  const opensAt = last === null ? null : last + COOLDOWN_DAYS * DAY_MS
  const waiting = opensAt !== null && opensAt > now
  const base = { slug: project.slug, name: project.name, confirmed: project.confirmed }
  if (waiting) return { ...base, available: false, opensAt, note: `Announced ${formatDay(last, now)}; opens again ${formatDay(opensAt, now)}` }
  if (project.confirmed <= 0) return { ...base, available: false, opensAt: null, note: last === null ? 'No one confirmed yet' : `No one confirmed; last announced ${formatDay(last, now)}` }
  return { ...base, available: true, opensAt: null, note: last === null ? 'Never announced' : `Last announced ${formatDay(last, now)}` }
}

/** Available projects first (most people first), then the ones that open soonest. */
export function projectChoices(projects: AnnounceProject[], now: number): ProjectChoice[] {
  return projects
    .map((project) => projectChoice(project, now))
    .sort((a, b) => Number(b.available) - Number(a.available) || b.confirmed - a.confirmed || (a.opensAt ?? 0) - (b.opensAt ?? 0) || a.name.localeCompare(b.name))
}

/** Why nothing can be sent at all, when no project can be picked; null when one can. */
export function nothingToPick(choices: ProjectChoice[]): string | null {
  if (choices.some((choice) => choice.available)) return null
  if (choices.length === 0) return 'There is no project with a waitlist yet.'
  if (choices.every((choice) => choice.confirmed <= 0)) return 'No one has confirmed a spot on any waitlist yet, so there is no one to send to.'
  return 'Every project with confirmed people was announced in the last 30 days.'
}

export type Allowance = {
  /** Announcement emails this month, as far as this page can count them, against n8builds-web's 140. */
  monthUsed: number
  monthCap: number
  /** What can still go out this month: the announcement budget, capped by what is left of the whole slice. */
  monthLeft: number
  /** The same for today (UTC), against 40 a day. */
  dayUsed: number
  dayCap: number
  dayLeft: number
  /** n8builds-web's whole slice in mailroom (shared with contact and waitlist mail); null without mailroom. */
  slice: { monthLeft: number; monthCap: number; dayLeft: number; dayCap: number } | null
  /** n8builds-web's email is paused in mailroom. */
  paused: boolean
}

const startOfUtcDay = (now: number) => {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
const startOfUtcMonth = (now: number) => {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

/**
 * The announcements' own budget (40 a day, 140 a month), less what went out.
 * mailroom has no separate count of announcement sends, so this adds up the
 * `sent` of the announcements started this UTC month (and today): about
 * right, since one started late last month and still sending isn't counted.
 * Capped by what is left of n8builds-web's whole slice, when mailroom answers.
 */
export function allowanceOf(usage: AppUsage | null, history: Pick<Announcement, 'sent' | 'createdAt'>[], now: number): Allowance {
  const sentSince = (since: number) => history.reduce((sum, a) => sum + ((toMs(a.createdAt) ?? -1) >= since ? a.sent : 0), 0)
  const monthUsed = sentSince(startOfUtcMonth(now))
  const dayUsed = sentSince(startOfUtcDay(now))
  const slice = usage
    ? { monthLeft: Math.max(0, usage.caps.month - usage.month), monthCap: usage.caps.month, dayLeft: Math.max(0, usage.caps.day - usage.today), dayCap: usage.caps.day }
    : null
  const budgetMonthLeft = Math.max(0, ANNOUNCE_BUDGET.month - monthUsed)
  const budgetDayLeft = Math.min(Math.max(0, ANNOUNCE_BUDGET.day - dayUsed), budgetMonthLeft)
  return {
    monthUsed,
    monthCap: ANNOUNCE_BUDGET.month,
    monthLeft: slice ? Math.min(budgetMonthLeft, slice.monthLeft) : budgetMonthLeft,
    dayUsed,
    dayCap: ANNOUNCE_BUDGET.day,
    dayLeft: slice ? Math.min(budgetDayLeft, slice.dayLeft) : budgetDayLeft,
    slice,
    paused: usage?.paused ?? false,
  }
}

/** Days to send `recipients` at about 40 a day, starting with what is left today. */
export function daysToSend(recipients: number, allowance: Pick<Allowance, 'dayLeft' | 'dayCap'>): number {
  if (recipients <= 0) return 0
  if (recipients <= allowance.dayLeft) return 1
  return (allowance.dayLeft > 0 ? 1 : 0) + Math.ceil((recipients - allowance.dayLeft) / allowance.dayCap)
}

const days = (n: number) => `${formatNumber(n)} ${n === 1 ? 'day' : 'days'}`

/**
 * What the budget means for sending to `recipients` people: how long it takes
 * at about 40 a day, and a warning when it runs past this month's announcement
 * emails (it pauses and carries on next month) or mailroom has paused n8builds-web.
 */
export function allowanceNotice(recipients: number, allowance: Allowance | null): { tone: Extract<Tone, 'warn' | 'idle'>; message: string } | null {
  if (!allowance || recipients <= 0) return null
  if (allowance.paused) return { tone: 'warn', message: 'n8builds-web\'s email is paused in mailroom: nothing goes out until it is resumed on the Mailroom page.' }
  const { perRun, runEveryMinutes } = ANNOUNCE_BUDGET
  const rate = `It sends about ${formatNumber(allowance.dayCap)} a day (${perRun} at once, then ${perRun} every ${runEveryMinutes} minutes)`
  if (recipients > allowance.monthLeft) {
    const fits = allowance.monthLeft
    return {
      tone: 'warn',
      message: `${formatPeople(recipients)} is more than the ${formatNumber(fits)} announcement emails left this month. ${
        fits > 0 ? `${rate}, so the first ${formatNumber(fits)} take about ${days(daysToSend(fits, allowance))}; then it pauses` : 'It pauses straight away'
      } and carries on next month at the same pace.`,
    }
  }
  if (recipients > allowance.dayLeft) {
    return { tone: 'idle', message: `${rate}, so ${formatPeople(recipients)} takes about ${days(daysToSend(recipients, allowance))}. At the day's limit it pauses until the next UTC day, then carries on.` }
  }
  return { tone: 'idle', message: `All ${formatPeople(recipients)} go out today: ${formatNumber(Math.min(recipients, perRun))} at once, the rest ${perRun} every ${runEveryMinutes} minutes.` }
}

export type Progress = {
  /** Handled so far: sent, failed or skipped. */
  done: number
  share: number
  /** "112 of 240 sent". */
  label: string
  /** "3 failed", always, then ", 1 skipped" when any were. */
  problems: string
}

export function progressOf(announcement: Pick<Announcement, 'total' | 'sent' | 'failed' | 'skipped'>): Progress {
  const { total, sent, failed, skipped } = announcement
  const done = Math.min(total, sent + failed + skipped)
  const problems = [`${formatNumber(failed)} failed`, skipped > 0 && `${formatNumber(skipped)} skipped`].filter(Boolean).join(', ')
  return { done, share: total > 0 ? done / total : 1, label: `${formatNumber(sent)} of ${formatNumber(total)} sent`, problems }
}

/** n8builds-web's and mailroom's stop codes, in words. Anything else shows as it came. */
const STOPS: Record<string, string> = {
  budget_day: 'today\'s 40 announcement emails are used',
  budget_month: 'this month\'s 140 announcement emails are used',
  cap_app_day: 'n8builds-web reached its daily cap in mailroom',
  cap_app_month: 'n8builds-web reached its monthly slice in mailroom',
  cap_global_day: 'mailroom\'s all-app daily cap was reached',
  cap_global_month: 'mailroom\'s all-app monthly cap was reached',
  cap_recipient: 'mailroom\'s limit per address was reached',
  daily_limit: 'Cloudflare\'s daily sending limit was reached',
  paused: 'n8builds-web is paused in mailroom',
  not_configured: 'n8builds-web has no MAILROOM binding',
  unknown_project: 'the project is no longer on /upcoming',
}

/** A stop code in words ("budget_day" is "today's 40 announcement emails are used"). */
export function stopReason(code: string | null): string | null {
  if (!code) return null
  return STOPS[code] ?? code.replaceAll('_', ' ')
}

/** "It's open, started Nov 9, 14:02 UTC by n8watkins, finished Nov 9, 15:10 UTC": what the Worker reports about it. */
export function historyMeta(
  announcement: Pick<Announcement, 'template' | 'createdAt' | 'createdBy' | 'finishedAt' | 'state'>,
  templates: Pick<AnnounceTemplate, 'id' | 'name'>[],
  now: number,
): string {
  const parts: string[] = []
  if (announcement.template) parts.push(templates.find((t) => t.id === announcement.template)?.name ?? announcement.template)
  if (announcement.createdAt) parts.push(`started ${formatDayTime(announcement.createdAt, now)}${announcement.createdBy ? ` by ${announcement.createdBy}` : ''}`)
  if (announcement.finishedAt) parts.push(`${announcement.state === 'cancelled' ? 'cancelled' : 'finished'} ${formatDayTime(announcement.finishedAt, now)}`)
  return parts.join(', ')
}

/** Its pill: what state it is in, in words, with when a paused one resumes. */
export function statePill(announcement: Pick<Announcement, 'state' | 'nextRunAt' | 'failed'>, now: number): { tone: Tone; label: string } {
  switch (announcement.state) {
    case 'sending':
      return { tone: 'running', label: 'Sending' }
    case 'paused_cap': {
      const next = toMs(announcement.nextRunAt)
      return { tone: 'warn', label: next === null ? 'Paused' : `Paused until ${formatDayTime(next, now)}` }
    }
    case 'done':
      return announcement.failed > 0 ? { tone: 'warn', label: `Done, ${formatNumber(announcement.failed)} failed` } : { tone: 'good', label: 'Done' }
    case 'cancelled':
      return { tone: 'idle', label: 'Cancelled' }
    default:
      return { tone: 'idle', label: String(announcement.state) }
  }
}

/** Still going (sending, or paused at a limit): it can be cancelled. */
export const isActive = (announcement: Pick<Announcement, 'state'>) => announcement.state === 'sending' || announcement.state === 'paused_cap'

/** The page refreshes itself while one is sending right now (a paused one waits for its day). */
export const anySending = (list: Pick<Announcement, 'state'>[]) => list.some((announcement) => announcement.state === 'sending')

/** Where the progress template asks for the owner's own words: n8builds-web won't start with one left in. */
export const PLACEHOLDER = /\[\[[^\]]*\]\]/

const PLACEHOLDER_ERROR = 'Replace the [[...]] placeholder with your own words.'

/** Required unless n8builds-web says otherwise (an older Worker doesn't say). */
export const isRequired = (field: Pick<TemplateField, 'required'>) => field.required !== false

export type FieldCheck = {
  key: string
  length: number
  max: number
  required: boolean
  tone: 'good' | 'warn' | 'bad'
  /** "42 / 80". */
  label: string
  /** What is wrong with it, for the line under the field; null when it is fine. */
  error: string | null
}

/**
 * Each field as n8builds-web will check it: a required one filled in, every
 * one within its max (counted as it counts them, in UTF-16 units), one line
 * except the body, a link that is a full https:// address, and no [[...]]
 * placeholder left in. The count turns amber in the last 10%.
 */
export function fieldChecks(template: AnnounceTemplate, values: Record<string, string>): FieldCheck[] {
  return template.fields.map((field) => {
    const value = (values[field.key] ?? '').trim()
    const length = value.length
    const required = isRequired(field)
    let error: string | null = null
    if (required && length === 0) error = 'Required.'
    else if (length > field.max) error = `${formatNumber(length - field.max)} over the ${formatNumber(field.max)} characters.`
    else if (field.key !== 'body' && value.includes('\n')) error = 'One line only.'
    else if (/url$/i.test(field.key) && value && !/^https:\/\/[^\s/.]+\.[^\s]+$/i.test(value)) error = 'Must be a full link starting with https://.'
    else if (PLACEHOLDER.test(value)) error = PLACEHOLDER_ERROR
    const tone = error ? 'bad' : length > field.max * 0.9 ? 'warn' : 'good'
    return { key: field.key, length, max: field.max, required, tone, label: `${formatNumber(length)} / ${formatNumber(field.max)}`, error }
  })
}

/** Ready to preview: everything but a placeholder is fine (the preview shows it, so it is easy to spot). */
export const previewReady = (template: AnnounceTemplate, values: Record<string, string>) => fieldChecks(template, values).every((check) => !check.error || check.error === PLACEHOLDER_ERROR)

/** Ready to send: every field passes. */
export const fieldsReady = (template: AnnounceTemplate, values: Record<string, string>) => fieldChecks(template, values).every((check) => !check.error)

/** The Overview tile: the announcement going out now, else the last one sent. */
export function tileOf(list: Announcement[], projects: AnnounceProject[], now: number): { headline: string; detail: string; status: string; tone: 'warn' | 'quiet' | 'good'; meter?: { value: number; max: number } } {
  const name = (slug: string) => projects.find((project) => project.slug === slug)?.name ?? slug
  const active = list.find(isActive)
  if (active) {
    const { done } = progressOf(active)
    const paused = active.state === 'paused_cap'
    const next = toMs(active.nextRunAt)
    return {
      headline: `${formatNumber(done)} / ${formatNumber(active.total)}`,
      detail: paused ? `${name(active.project)}: paused${next === null ? '' : ` until ${formatDay(next, now)}`}` : `Sending: ${name(active.project)}`,
      status: paused ? 'Paused' : 'Sending',
      tone: 'quiet',
      meter: { value: done, max: active.total },
    }
  }
  const last = list.find((announcement) => announcement.state === 'done')
  if (!last) return { headline: 'None yet', detail: 'No announcement sent yet', status: 'None yet', tone: 'quiet' }
  const at = last.finishedAt ?? last.createdAt ?? projects.find((p) => p.slug === last.project)?.lastAnnouncedAt
  return {
    headline: formatNumber(last.sent),
    detail: `sent about ${name(last.project)}${at ? `, ${formatDay(at, now)}` : ''}`,
    status: last.failed > 0 ? `${formatNumber(last.failed)} failed` : 'Sent',
    tone: last.failed > 0 ? 'warn' : 'quiet',
  }
}
