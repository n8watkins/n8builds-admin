import { describe, expect, it, vi } from 'vitest'
import {
  ANNOUNCE_BUDGET,
  allowanceNotice,
  allowanceOf,
  anySending,
  daysToSend,
  fieldChecks,
  fieldsReady,
  formatDay,
  historyMeta,
  nothingToPick,
  previewReady,
  progressOf,
  projectChoice,
  projectChoices,
  statePill,
  stopReason,
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
  id: 'a'.repeat(32),
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
  it('reads ISO strings and epoch ms, and nothing else', () => {
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

  it('says why nothing can be sent when no project can be picked', () => {
    const none = projectChoices([project(null, 0), { ...project(null, 0), slug: 'wren', name: 'Wren' }], NOW)
    expect(nothingToPick(none)).toBe('No one has confirmed a spot on any waitlist yet, so there is no one to send to.')
    expect(nothingToPick(projectChoices([project(NOW - DAY, 5)], NOW))).toMatch(/announced in the last 30 days/)
    expect(nothingToPick([])).toMatch(/no project/)
    expect(nothingToPick(projectChoices([project(null, 5)], NOW))).toBeNull()
  })
})

describe('the announcement budget', () => {
  const usage = { app: 'n8builds-web', today: 18, month: 95, sentMonth: 95, caps: { day: 60, month: 200, recipientDay: 5 }, defaultDayCap: 60, paused: false, bounces30d: 0, complaints30d: 0, failed30d: 0 }
  const today = new Date(NOW - 3_600_000).toISOString()
  const thisMonth = new Date(NOW - 5 * DAY).toISOString()
  const lastMonth = new Date(NOW - 20 * DAY).toISOString()
  const history = [
    { sent: 12, createdAt: today },
    { sent: 40, createdAt: thisMonth },
    { sent: 90, createdAt: lastMonth },
  ]

  it('is 40 a day and 140 a month, less this UTC month\'s and day\'s announcement sends', () => {
    expect(ANNOUNCE_BUDGET).toMatchObject({ day: 40, month: 140 })
    expect(allowanceOf(usage, history, NOW)).toEqual({
      monthUsed: 52,
      monthCap: 140,
      monthLeft: 88,
      dayUsed: 12,
      dayCap: 40,
      dayLeft: 28,
      slice: { monthLeft: 105, monthCap: 200, dayLeft: 42, dayCap: 60 },
      paused: false,
    })
  })

  it('is capped by what is left of n8builds-web\'s whole slice', () => {
    const tight = allowanceOf({ ...usage, month: 180, today: 50 }, history, NOW)
    expect(tight.monthLeft).toBe(20)
    expect(tight.dayLeft).toBe(10)
  })

  it('still counts without mailroom, from the announcements alone', () => {
    expect(allowanceOf(null, history, NOW)).toMatchObject({ monthLeft: 88, dayLeft: 28, slice: null, paused: false })
    expect(allowanceOf(null, [], NOW)).toMatchObject({ monthLeft: 140, dayLeft: 40 })
    // Never more today than is left this month.
    expect(allowanceOf(null, [{ sent: 130, createdAt: thisMonth }], NOW).dayLeft).toBe(10)
  })

  const allowance: Allowance = allowanceOf(usage, history, NOW)

  it('works out the days at about 40 a day, starting with what is left today', () => {
    expect(daysToSend(20, allowance)).toBe(1)
    expect(daysToSend(28, allowance)).toBe(1)
    expect(daysToSend(29, allowance)).toBe(2)
    expect(daysToSend(68, allowance)).toBe(2)
    expect(daysToSend(69, allowance)).toBe(3)
    expect(daysToSend(40, { dayLeft: 0, dayCap: 40 })).toBe(1)
    expect(daysToSend(0, allowance)).toBe(0)
  })

  it('says it all goes out today when it fits', () => {
    expect(allowanceNotice(26, allowance)).toEqual({ tone: 'idle', message: 'All 26 people go out today: 20 at once, the rest 20 every 15 minutes.' })
    expect(allowanceNotice(0, allowance)).toBeNull()
    expect(allowanceNotice(10, null)).toBeNull()
  })

  it('says how many days a longer list takes', () => {
    expect(allowanceNotice(41, allowance)).toEqual({
      tone: 'idle',
      message: 'It sends about 40 a day (20 at once, then 20 every 15 minutes), so 41 people takes about 2 days. At the day\'s limit it pauses until the next UTC day, then carries on.',
    })
  })

  it('warns when the people outnumber this month\'s announcement emails, and says it carries on next month', () => {
    expect(allowanceNotice(214, allowance)).toEqual({
      tone: 'warn',
      message: '214 people is more than the 88 announcement emails left this month. It sends about 40 a day (20 at once, then 20 every 15 minutes), so the first 88 take about 3 days; then it pauses and carries on next month at the same pace.',
    })
    expect(allowanceNotice(1, { ...allowance, monthLeft: 0 })?.message).toBe('1 person is more than the 0 announcement emails left this month. It pauses straight away and carries on next month at the same pace.')
  })

  it('warns when n8builds-web is paused in mailroom', () => {
    expect(allowanceNotice(5, { ...allowance, paused: true })).toMatchObject({ tone: 'warn', message: expect.stringContaining('paused in mailroom') })
  })
})

describe('progress, state and history', () => {
  it('counts sent, failed and skipped as handled, and always says how many failed', () => {
    expect(progressOf(announcement({ total: 240, sent: 112, failed: 3, skipped: 1 }))).toEqual({ done: 116, share: 116 / 240, label: '112 of 240 sent', problems: '3 failed, 1 skipped' })
    expect(progressOf(announcement({ total: 10, sent: 4 })).problems).toBe('0 failed')
    expect(progressOf(announcement({ total: 0 }))).toMatchObject({ done: 0, share: 1 })
    expect(progressOf(announcement({ total: 10, sent: 12 })).done).toBe(10)
  })

  it('names each state, with when a paused one picks up again', () => {
    expect(statePill(announcement({ state: 'sending' }), NOW)).toEqual({ tone: 'running', label: 'Sending' })
    expect(statePill(announcement({ state: 'paused_cap', nextRunAt: '2026-11-12T00:00:00.000Z' }), NOW)).toEqual({ tone: 'warn', label: 'Paused until Nov 12, 00:00 UTC' })
    expect(statePill(announcement({ state: 'paused_cap' }), NOW).label).toBe('Paused')
    expect(statePill(announcement({ state: 'done' }), NOW)).toEqual({ tone: 'good', label: 'Done' })
    expect(statePill(announcement({ state: 'done', failed: 2 }), NOW)).toEqual({ tone: 'warn', label: 'Done, 2 failed' })
    expect(statePill(announcement({ state: 'cancelled' }), NOW)).toEqual({ tone: 'idle', label: 'Cancelled' })
  })

  it('says why it stopped in words', () => {
    expect(stopReason('budget_day')).toBe('today\'s 40 announcement emails are used')
    expect(stopReason('cap_app_month')).toBe('n8builds-web reached its monthly slice in mailroom')
    expect(stopReason('something_new')).toBe('something new')
    expect(stopReason(null)).toBeNull()
  })

  it('shows the template, who started it and when, and when it finished', () => {
    const templates = [{ id: 'open' as const, name: "It's open" }]
    expect(
      historyMeta(announcement({ template: 'open', createdAt: '2026-11-09T14:02:00.000Z', createdBy: 'n8watkins', finishedAt: '2026-11-09T15:10:00.000Z', state: 'done' }), templates, NOW),
    ).toBe("It's open, started Nov 9, 14:02 UTC by n8watkins, finished Nov 9, 15:10 UTC")
    expect(historyMeta(announcement({ template: 'progress', createdAt: '2026-11-09T14:02:00.000Z', finishedAt: '2026-11-10T09:00:00.000Z', state: 'cancelled' }), templates, NOW)).toBe(
      'progress, started Nov 9, 14:02 UTC, cancelled Nov 10, 09:00 UTC',
    )
    // An older Worker reports none of it.
    expect(historyMeta(announcement({}), templates, NOW)).toBe('')
  })

  it('refreshes only while one is sending right now', () => {
    expect(anySending([announcement({ state: 'done' }), announcement({ state: 'sending' })])).toBe(true)
    expect(anySending([announcement({ state: 'paused_cap' }), announcement({ state: 'cancelled' })])).toBe(false)
  })
})

describe('the fields', () => {
  const template: AnnounceTemplate = {
    id: 'launched',
    name: 'It launched',
    fields: [
      { key: 'title', label: 'Title', max: 10, required: true },
      { key: 'body', label: 'Body', max: 100, required: true },
      { key: 'perk', label: 'Perk', max: 50, required: false },
      { key: 'buttonUrl', label: 'Button link (https)', max: 300, required: true },
    ],
  }
  const good = { title: 'Open now', body: 'Come see', perk: '', buttonUrl: 'https://n8builds.dev/upcoming' }

  it('counts live: amber in the last 10%, red with a reason when something is wrong', () => {
    expect(fieldChecks(template, { ...good, title: 'Open now!!' })[0]).toEqual({ key: 'title', length: 10, max: 10, required: true, tone: 'warn', label: '10 / 10', error: null })
    expect(fieldChecks(template, { ...good, title: 'Open now!!!' })[0]).toMatchObject({ length: 11, tone: 'bad', error: '1 over the 10 characters.' })
    // Counted as n8builds-web counts them: an emoji is two.
    expect(fieldChecks(template, { ...good, title: '🎉' })[0].length).toBe(2)
  })

  it('needs the required fields, and lets an optional one be empty', () => {
    expect(fieldChecks(template, { ...good, body: '  ' })[1].error).toBe('Required.')
    expect(fieldChecks(template, good)[2]).toMatchObject({ required: false, error: null })
    // A field n8builds-web doesn't mark is required.
    expect(fieldChecks({ ...template, fields: [{ key: 'title', label: 'Title', max: 10 }] }, {})[0]).toMatchObject({ required: true, error: 'Required.' })
  })

  it('wants a full https link, one line outside the body, and no [[...]] placeholder', () => {
    for (const url of ['http://n8builds.dev', 'n8builds.dev', 'https://', 'https://localhost', 'https://n8 builds.dev']) {
      expect(fieldChecks(template, { ...good, buttonUrl: url })[3].error, url).toBe('Must be a full link starting with https://.')
    }
    expect(fieldChecks(template, { ...good, title: 'Two\nlines' })[0].error).toBe('One line only.')
    expect(fieldChecks(template, { ...good, body: 'One\n\nTwo' })[1].error).toBeNull()
    expect(fieldChecks(template, { ...good, body: 'Hi\n\n[[What changed]]' })[1].error).toBe('Replace the [[...]] placeholder with your own words.')
  })

  it('previews with a placeholder left in, but sends only when everything passes', () => {
    const placeholder = { ...good, body: '[[What changed]]' }
    expect(previewReady(template, placeholder)).toBe(true)
    expect(fieldsReady(template, placeholder)).toBe(false)
    expect(fieldsReady(template, good)).toBe(true)
    expect(previewReady(template, { ...good, buttonUrl: 'http://x.dev' })).toBe(false)
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
    expect(tileOf([announcement({ state: 'paused_cap', nextRunAt: '2026-11-12T00:00:00Z' })], projects, NOW).detail).toBe('Feelium: paused until Nov 12')
  })

  it('otherwise the last one sent, and when it finished', () => {
    expect(tileOf([announcement({ state: 'cancelled' }), announcement({ project: 'solara', state: 'done', sent: 9, finishedAt: '2026-10-02T10:00:00Z' })], projects, NOW)).toEqual({
      headline: '9',
      detail: 'sent about Solara, Oct 2',
      status: 'Sent',
      tone: 'quiet',
    })
    expect(tileOf([announcement({ state: 'done', sent: 8, failed: 1 })], projects, NOW)).toMatchObject({ status: '1 failed', tone: 'warn' })
  })

  it('or none yet', () => {
    expect(tileOf([], projects, NOW)).toMatchObject({ headline: 'None yet', tone: 'quiet' })
  })
})
