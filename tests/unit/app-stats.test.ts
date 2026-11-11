import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => ({ env: {} }) }))
const { APP_SOURCES, isAppStats, readAppStats } = await import('@/lib/app-stats')

const source = APP_SOURCES[0]
const stats = {
  schema: 1,
  app: 'nettrailers',
  name: 'NetTrailers',
  generatedAt: '2026-11-10T12:00:00.000Z',
  adminUrl: 'https://net-trailers.n8builds.dev/admin',
  tile: { headline: { value: 5, label: 'users' }, meter: { value: 4, limit: 2000, label: 'emails this month' }, note: '2 new this week', tone: 'quiet' },
  totals: [{ key: 'users', label: 'Users', value: 5 }],
  quotas: [{ key: 'email-month', label: 'Emails this month', used: 4, limit: 2000, period: 'month' }],
  jobs: [{ key: 'trending', label: 'Trending digest', schedule: 'Mon 02:00 UTC', lastRunAt: null, status: 'never' }],
  errors: { count: 0, windowHours: 24 },
  deploy: { version: 'abc1234', deployedAt: null },
} as const

describe('app stats', () => {
  it('accepts the documented shape and refuses anything else', () => {
    expect(isAppStats(stats)).toBe(true)
    expect(isAppStats({ ...stats, schema: 2 })).toBe(false)
    expect(isAppStats({ ...stats, tile: undefined })).toBe(false)
    expect(isAppStats(null)).toBe(false)
  })

  it('says when the binding is missing, failing or answering in the wrong shape', async () => {
    expect(await readAppStats(source, undefined)).toEqual({ source, state: 'unbound' })
    expect(await readAppStats(source, { stats: async () => stats as never })).toEqual({ source, state: 'ok', stats })
    expect(await readAppStats(source, { stats: async () => ({ users: 5 }) as never })).toMatchObject({ state: 'error', message: 'NetTrailers answered in an unexpected shape' })
    expect(await readAppStats(source, { stats: () => Promise.reject(new Error('no such entrypoint')) })).toMatchObject({ state: 'error', message: 'no such entrypoint' })
  })
})
