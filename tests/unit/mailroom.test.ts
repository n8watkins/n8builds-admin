import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { appName, monthRows } = await import('@/lib/mailroom')

const app = (id: string, sentMonth: number) => ({
  app: id,
  today: 0,
  month: 0,
  sentMonth,
  caps: { day: 10, month: 100, recipientDay: 5 },
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
})
