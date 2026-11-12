import { describe, expect, it, vi } from 'vitest'
import {
  allowanceNotice,
  allowanceOf,
  anySending,
  fieldChecks,
  fieldsReady,
  formatDay,
  progressOf,
  projectChoice,
  projectChoices,
  statePill,
  tileOf,
  toMs,
  type Allowance,
} from '@/lib/announce-view'
import type { Announcement, AnnounceTemplate } from '@/lib/announcements'

vi.mock('server-only', () => ({}))

const DAY = 86_400_000
const NOW = Date.parse('2026-11-11T12:00:00Z')

const project = (lastAnnouncedAt: number | string | null, confirmed = 40) => ({ slug: 'feelium', name: 'Feelium', confirmed, lastAnnouncedAt })

const announcement = (over: Partial<Announcement>): Announcement => ({
  id: 'a1',
  project: 'feelium',
  subject: 'Feelium is open',
  total: 100,
  sent: 0,
  failed: 0,
  skipped: 0,
  state: 'sending',
  lastError: null,
  nextRunAt: null,
  ...over,
})

describe('dates', () => {
  it('reads epoch ms and ISO strings, and nothing else', () => {
    expect(toMs(NOW)).toBe(NOW)
    expect(toMs('2026-11-11T12:00:00Z')).toBe(NOW)
    expect(toMs(null)).toBeNull()
    expect(toMs('')).toBeNull()
    expect(toMs('soon')).toBeNull()
  })

  it('shows the year only when it is not this one', () => {
    expect(formatDay(NOW, NOW)).toBe('Nov 11')
    expect(formatDay('2025-12-30T00:00:00Z', NOW)).toBe('Dec 30, 2025')
    expect(formatDay(null, NOW)).toBe('-')
  })
})

describe('the 30-day rule in the project picker', () => {
  it('lets a never-announced project be picked', () => {
    expect(projectChoice(project(null), NOW)).toMatchObject({ available: true, opensAt: null, note: 'Never announced' })
  })

  it('disables one announced in the last 30 days, with the day it opens again', () => {
    const choice = projectChoice(project(NOW - 12 * DAY), NOW)
    expect(choice.available).toBe(false)
    expect(choice.opensAt).toBe(NOW + 18 * DAY)
    expect(choice.note).toBe('Announced Oct 30; opens again Nov 29')
  })

  it('opens again exactly 30 days later, and reads ISO dates too', () => {
    expect(projectChoice(project(NOW - 30 * DAY), NOW)).toMatchObject({ available: true, note: 'Last announced Oct 12' })
    expect(projectChoice(project(new Date(NOW - 30 * DAY + 1).toISOString()), NOW).available).toBe(false)
  })

  it('disables a project with nobody confirmed', () => {
    expect(projectChoice(project(null, 0), NOW)).toMatchObject({ available: false, note: 'No one confirmed yet' })
  })

  it('lists what can be picked first, most people first, then what opens soonest', () => {
    const order = projectChoices(
      [
        { slug: 'a', name: 'A', confirmed: 10, lastAnnouncedAt: NOW - 5 * DAY },
        { slug: 'b', name: 'B', confirmed: 5, lastAnnouncedAt: null },
        { slug: 'c', name: 'C', confirmed: 50, lastAnnouncedAt: null },
        { slug: 'd', name: 'D', confirmed: 10, lastAnnouncedAt: NOW - 25 * DAY },
      ],
      NOW,
    ).map((choice) => choice.slug)
    expect(order).toEqual(['c', 'b', 'd', 'a'])
  })
})

describe('the mailroom allowance', () => {
  const usage = { app: 'n8builds-web', today: 22, month: 455, sentMonth: 455, caps: { day: 150, month: 600, recipientDay: 5 }, defaultDayCap: 150, paused: false, bounces30d: 0, complaints30d: 0, failed30d: 0 }
  const allowance = allowanceOf(usage) as Allowance

  it('is the monthly slice less this month, and the day cap less today', () => {
    expect(allowance).toEqual({ monthUsed: 455, monthCap: 600, monthLeft: 145, dayLeft: 128, dayCap: 150, paused: false })
    expect(allowanceOf({ ...usage, month: 700 })?.monthLeft).toBe(0)
    expect(allowanceOf(null)).toBeNull()
  })

  it('says nothing when it all goes out today', () => {
    expect(allowanceNotice(100, allowance)).toBeNull()
    expect(allowanceNotice(0, allowance)).toBeNull()
    expect(allowanceNotice(100, null)).toBeNull()
  })

  it('notes a send that spreads over days', () => {
    expect(allowanceNotice(140, allowance)).toMatchObject({ tone: 'idle', message: expect.stringContaining('carries on the next day') })
  })

  it('warns when the people outnumber what is left this month, and says it pauses and resumes', () => {
    const notice = allowanceNotice(214, allowance)
    expect(notice?.tone).toBe('warn')
    expect(notice?.message).toBe('214 people is more than the 145 emails n8builds-web has left this month. The first 145 go out, then the send pauses at the cap and resumes on its own when the month resets.')
    expect(allowanceNotice(1, { ...allowance, monthLeft: 0 })?.message).toMatch(/^1 person is more than the 0 .* The send pauses straight away at the cap/)
  })

  it('warns when n8builds-web is paused in mailroom', () => {
    expect(allowanceNotice(5, { ...allowance, paused: true })).toMatchObject({ tone: 'warn', message: expect.stringContaining('paused in mailroom') })
  })
})

describe('progress and state', () => {
  it('counts sent, failed and skipped as handled', () => {
    expect(progressOf(announcement({ total: 240, sent: 112, failed: 3, skipped: 1 }))).toEqual({ done: 116, share: 116 / 240, label: '112 of 240 sent', problems: '3 failed, 1 skipped' })
    expect(progressOf(announcement({ total: 0 }))).toMatchObject({ done: 0, share: 1, problems: '' })
    expect(progressOf(announcement({ total: 10, sent: 12 })).done).toBe(10)
  })

  it('names each state, with when a paused one picks up again', () => {
    expect(statePill(announcement({ state: 'sending' }), NOW)).toEqual({ tone: 'running', label: 'Sending' })
    expect(statePill(announcement({ state: 'paused_cap', nextRunAt: '2026-12-01T06:00:00Z' }), NOW)).toEqual({ tone: 'warn', label: 'Paused at the cap until Dec 1, 06:00 UTC' })
    expect(statePill(announcement({ state: 'paused_cap' }), NOW).label).toBe('Paused at the cap')
    expect(statePill(announcement({ state: 'done' }), NOW)).toEqual({ tone: 'good', label: 'Done' })
    expect(statePill(announcement({ state: 'done', failed: 2 }), NOW)).toEqual({ tone: 'warn', label: 'Done, 2 failed' })
    expect(statePill(announcement({ state: 'cancelled' }), NOW)).toEqual({ tone: 'idle', label: 'Cancelled' })
  })

  it('refreshes only while one is sending right now', () => {
    expect(anySending([announcement({ state: 'done' }), announcement({ state: 'sending' })])).toBe(true)
    expect(anySending([announcement({ state: 'paused_cap' }), announcement({ state: 'cancelled' })])).toBe(false)
  })
})

describe('the fields', () => {
  const template: AnnounceTemplate = { id: 'open', name: 'Now open', fields: [{ key: 'headline', label: 'Headline', max: 10 }, { key: 'body', label: 'Body', max: 100 }] }

  it('counts characters live: amber in the last 10%, red past the limit or empty', () => {
    expect(fieldChecks(template, { headline: 'Open now!!', body: ' hi ' })).toEqual([
      { key: 'headline', length: 10, max: 10, tone: 'warn', label: '10 / 10' },
      { key: 'body', length: 2, max: 100, tone: 'good', label: '2 / 100' },
    ])
    expect(fieldChecks(template, { headline: 'Open now!!!' })[0]).toMatchObject({ length: 11, tone: 'bad' })
    // An emoji is one character, as people count them.
    expect(fieldChecks(template, { headline: '🎉' })[0].length).toBe(1)
  })

  it('is ready only with every field filled in and within its limit', () => {
    expect(fieldsReady(template, { headline: 'Open', body: 'Come see' })).toBe(true)
    expect(fieldsReady(template, { headline: 'Open', body: '   ' })).toBe(false)
    expect(fieldsReady(template, { headline: 'Open now, really', body: 'x' })).toBe(false)
  })
})

describe('the Overview tile', () => {
  const projects = [project(NOW - 3 * DAY), { slug: 'solara', name: 'Solara', confirmed: 9, lastAnnouncedAt: NOW - 40 * DAY }]

  it('shows the one going out now, with a meter', () => {
    expect(tileOf([announcement({ total: 240, sent: 100, failed: 2 }), announcement({ state: 'done' })], projects, NOW)).toEqual({
      headline: '102 / 240',
      detail: 'Sending: Feelium',
      status: 'Sending',
      tone: 'quiet',
      meter: { value: 102, max: 240 },
    })
    expect(tileOf([announcement({ state: 'paused_cap', nextRunAt: '2026-12-01T06:00:00Z' })], projects, NOW).detail).toBe('Feelium: paused at the cap until Dec 1')
  })

  it('otherwise the last one sent, and when', () => {
    expect(tileOf([announcement({ state: 'cancelled' }), announcement({ project: 'solara', state: 'done', sent: 9 })], projects, NOW)).toEqual({ headline: '9', detail: 'sent about Solara, Oct 2', status: 'Sent', tone: 'quiet' })
    expect(tileOf([announcement({ state: 'done', sent: 8, failed: 1 })], projects, NOW)).toMatchObject({ status: '1 failed', tone: 'warn' })
  })

  it('or none yet', () => {
    expect(tileOf([], projects, NOW)).toMatchObject({ headline: 'None yet', tone: 'quiet' })
  })
})
