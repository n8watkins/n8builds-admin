import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { appName, monthRows, sliceTotals, withShare } = await import('@/lib/mailroom')

const app = (id: string, sentMonth: number, month = 0, slice = 100) => ({
  app: id,
  today: 0,
  month,
  sentMonth,
  caps: { day: 10, month: slice, recipientDay: 5 },
  defaultDayCap: 10,
  paused: false,
  bounces30d: 0,
  complaints30d: 0,
  failed30d: 0,
})

const usage = {
  generatedAt: '2026-11-11T00:00:00.000Z',
  monthStart: '2026-11-01',
  eventsSince: null,
  globalToday: 0,
  globalDayCap: 900,
  priorityReserve: 150,
  monthlyIncluded: 3000,
  accountMonth: 31,
  otherSenders: [{ sender: 'hello@techforpros.com', sentMonth: 4 }],
  suppressions: 0,
  apps: [app('wren', 2), app('prpost', 0), app('nettrailers', 25)],
}

describe('mailroom usage', () => {
  it('lists this month busiest first, leaves out apps with none, then senders no app owns', () => {
    expect(monthRows(usage)).toEqual([
      { label: 'Net Trailers', value: 25 },
      { label: 'Wren', value: 2 },
      { label: 'hello@techforpros.com', value: 4 },
    ])
  })

  it('names apps the way people say them', () => {
    expect(appName('n8builds-web')).toBe('n8builds.dev')
    expect(appName('something-new')).toBe('something-new')
    expect(appName(null)).toBe('Unknown app')
  })

  it('shows a count with its share of a total', () => {
    expect(withShare(150, 2500)).toBe('150 (6%)')
    expect(withShare(1800, 2500)).toBe('1,800 (72%)')
    expect(withShare(2500, 2500)).toBe('2,500 (100%)')
    expect(withShare(5, 2500)).toBe('5 (<1%)')
    expect(withShare(0, 2500)).toBe('0 (0%)')
    expect(withShare(40, 0)).toBe('40')
  })

  it('adds up the apps\' month slices and use against the all-app cap', () => {
    const globalMonth = {
      used: 190,
      cap: 2500,
      priorityReserve: 300,
      windowStart: '2026-10-11',
      windowDays: 32,
      warnAt: 1750,
      attention: false,
      attentionSince: null,
      alerts: [],
    }
    const apps = [app('prpost', 0, 120, 1800), app('wren', 0, 60, 550), app('n8builds-web', 0, 10, 150)]
    expect(sliceTotals({ apps, globalMonth })).toEqual({ slices: 2500, used: 190, left: 0 })
    expect(sliceTotals({ apps: apps.slice(1), globalMonth })).toEqual({ slices: 700, used: 70, left: 1800 })
    expect(sliceTotals({ apps, globalMonth: { ...globalMonth, cap: 2000 } }).left).toBe(-500)
    // An older mailroom has no all-app cap: the sums still hold, with nothing to compare them to.
    expect(sliceTotals({ apps })).toEqual({ slices: 2500, used: 190, left: null })
  })
})
