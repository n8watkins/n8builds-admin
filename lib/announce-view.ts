import type { Tone } from '@/components/ui'
import type { Announcement, AnnounceProject, AnnounceTemplate, When } from './announcements'
import { formatNumber } from './format'
import type { AppUsage } from './mailroom'

/*
 * What the Announcements page shows, worked out from n8builds-web's and
 * mailroom's answers. Plain functions, no I/O, so the rules are unit-tested
 * (tests/unit/announcements.test.ts) and the server and the browser agree.
 */

const DAY_MS = 86_400_000

/** n8builds-web announces a project at most once in this many days (its start() answers too_soon). */
export const COOLDOWN_DAYS = 30

/** Epoch ms from n8builds-web's number or ISO string; null for nothing or nonsense. */
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

export type Allowance = {
  /** n8builds-web's emails through mailroom this month, and its monthly slice. */
  monthUsed: number
  monthCap: number
  monthLeft: number
  /** And today, against its daily cap. */
  dayLeft: number
  dayCap: number
  paused: boolean
}

export function allowanceOf(usage: AppUsage | null): Allowance | null {
  if (!usage) return null
  return {
    monthUsed: usage.month,
    monthCap: usage.caps.month,
    monthLeft: Math.max(0, usage.caps.month - usage.month),
    dayLeft: Math.max(0, usage.caps.day - usage.today),
    dayCap: usage.caps.day,
    paused: usage.paused,
  }
}

/**
 * What the allowance means for sending to `recipients` people: nothing to say
 * when it all fits today, a note when it spreads over days, a warning when
 * it runs past the month's slice (the send pauses at the cap and resumes
 * when it resets) or n8builds-web's email is paused in mailroom.
 */
export function allowanceNotice(recipients: number, allowance: Allowance | null): { tone: Extract<Tone, 'warn' | 'idle'>; message: string } | null {
  if (!allowance || recipients <= 0) return null
  if (allowance.paused) return { tone: 'warn', message: 'n8builds-web\'s email is paused in mailroom: nothing goes out until it is resumed on the Mailroom page.' }
  if (recipients > allowance.monthLeft) {
    const fits = allowance.monthLeft
    return {
      tone: 'warn',
      message: `${formatPeople(recipients)} is more than the ${formatNumber(fits)} emails n8builds-web has left this month. ${fits > 0 ? `The first ${formatNumber(fits)} go out, then the send pauses` : 'The send pauses straight away'} at the cap and resumes on its own when the month resets.`,
    }
  }
  if (recipients > allowance.dayLeft) {
    return { tone: 'idle', message: `More than today's ${formatNumber(allowance.dayLeft)} left of n8builds-web's ${formatNumber(allowance.dayCap)} a day: it pauses at the daily cap and carries on the next day.` }
  }
  return null
}

export type Progress = {
  /** Handled so far: sent, failed or skipped. */
  done: number
  share: number
  /** "112 of 240 sent". */
  label: string
  /** "3 failed, 1 skipped", or empty. */
  problems: string
}

export function progressOf(announcement: Pick<Announcement, 'total' | 'sent' | 'failed' | 'skipped'>): Progress {
  const { total, sent, failed, skipped } = announcement
  const done = Math.min(total, sent + failed + skipped)
  const problems = [failed > 0 && `${formatNumber(failed)} failed`, skipped > 0 && `${formatNumber(skipped)} skipped`].filter(Boolean).join(', ')
  return { done, share: total > 0 ? done / total : 1, label: `${formatNumber(sent)} of ${formatNumber(total)} sent`, problems }
}

/** Its pill: what state it is in, in words, with when a paused one resumes. */
export function statePill(announcement: Pick<Announcement, 'state' | 'nextRunAt' | 'failed'>, now: number): { tone: Tone; label: string } {
  switch (announcement.state) {
    case 'sending':
      return { tone: 'running', label: 'Sending' }
    case 'paused_cap': {
      const next = toMs(announcement.nextRunAt)
      return { tone: 'warn', label: next === null ? 'Paused at the cap' : `Paused at the cap until ${formatDayTime(next, now)}` }
    }
    case 'done':
      return announcement.failed > 0 ? { tone: 'warn', label: `Done, ${formatNumber(announcement.failed)} failed` } : { tone: 'good', label: 'Done' }
    case 'cancelled':
      return { tone: 'idle', label: 'Cancelled' }
    default:
      return { tone: 'idle', label: String(announcement.state) }
  }
}

/** Still going (sending, or waiting at the cap): it can be cancelled. */
export const isActive = (announcement: Pick<Announcement, 'state'>) => announcement.state === 'sending' || announcement.state === 'paused_cap'

/** The page refreshes itself while one is sending right now (a paused one waits for its day). */
export const anySending = (list: Pick<Announcement, 'state'>[]) => list.some((announcement) => announcement.state === 'sending')

export type FieldCheck = { key: string; length: number; max: number; tone: 'good' | 'warn' | 'bad'; label: string }

/** Each field's live count ("42 / 80"): amber in the last 10%, red past the limit or empty. */
export function fieldChecks(template: AnnounceTemplate, values: Record<string, string>): FieldCheck[] {
  return template.fields.map((field) => {
    const length = [...(values[field.key] ?? '').trim()].length
    const tone = length === 0 || length > field.max ? 'bad' : length > field.max * 0.9 ? 'warn' : 'good'
    return { key: field.key, length, max: field.max, tone, label: `${formatNumber(length)} / ${formatNumber(field.max)}` }
  })
}

/** Every field filled in and within its limit: only then can it be previewed and sent. */
export const fieldsReady = (template: AnnounceTemplate, values: Record<string, string>) => fieldChecks(template, values).every((check) => check.length > 0 && check.length <= check.max)

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
      detail: paused ? `${name(active.project)}: paused at the cap${next === null ? '' : ` until ${formatDay(next, now)}`}` : `Sending: ${name(active.project)}`,
      status: paused ? 'Paused at the cap' : 'Sending',
      tone: 'quiet',
      meter: { value: done, max: active.total },
    }
  }
  const last = list.find((announcement) => announcement.state === 'done')
  if (!last) return { headline: 'None yet', detail: 'No announcement sent yet', status: 'None yet', tone: 'quiet' }
  const project = projects.find((p) => p.slug === last.project)
  const when = project?.lastAnnouncedAt ? `, ${formatDay(project.lastAnnouncedAt, now)}` : ''
  return {
    headline: formatNumber(last.sent),
    detail: `sent about ${name(last.project)}${when}`,
    status: last.failed > 0 ? `${formatNumber(last.failed)} failed` : 'Sent',
    tone: last.failed > 0 ? 'warn' : 'quiet',
  }
}
