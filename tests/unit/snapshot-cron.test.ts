import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const sentry = vi.hoisted(() => ({
  captureCheckIn: vi.fn((_checkIn: { status: string }, _config?: object) => 'check-in-1'),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
}))
vi.mock('@sentry/nextjs', () => sentry)

const state = vi.hoisted(() => ({ store: true, github: true, repoOk: true, owner: false, set: vi.fn() }))
vi.mock('@/lib/store', () => ({
  SNAPSHOT_TTL_SECONDS: 1,
  isStoreConnected: () => state.store,
  store: () => ({ set: state.set }),
  utcDate: () => '2026-10-28',
}))
vi.mock('@/lib/github', () => ({
  isGitHubConnected: () => state.github,
  getRepo: async () => (state.repoOk ? { ok: true, data: { stargazers_count: 3 } } : { ok: false, status: 401, message: 'Bad credentials' }),
  getPersonalMinutes: async () => ({ ok: true, data: { total: 10 } }),
  getOrgMinutes: async () => ({ ok: true, data: { total: 5 } }),
}))
vi.mock('@/lib/repos', () => ({ TRACKED_REPOS: [{ repo: 'n8builds-web' }] }))
vi.mock('@/lib/auth/owner', () => ({ ownerFromRequest: async () => (state.owner ? { login: 'n8watkins' } : null) }))

const { GET } = await import('@/app/api/cron/snapshot/route')

const call = (auth?: string) =>
  GET(new NextRequest('https://admin.n8builds.dev/api/cron/snapshot', { headers: auth ? { authorization: auth } : {} }))
const statuses = () => sentry.captureCheckIn.mock.calls.map(([checkIn]) => checkIn.status)

describe('the daily snapshot reports to Sentry', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'secret')
    Object.assign(state, { store: true, github: true, repoOk: true, owner: false })
  })

  it('checks in, then reports ok, when the scheduled run saves a full snapshot', async () => {
    expect((await call('Bearer secret')).status).toBe(200)
    expect(statuses()).toEqual(['in_progress', 'ok'])
    expect(sentry.captureMessage).not.toHaveBeenCalled()
    expect(sentry.flush).toHaveBeenCalled()
  })

  it('reports an error, naming the gap, when a GitHub read fails (an expired token)', async () => {
    state.repoOk = false
    expect((await call('Bearer secret')).status).toBe(200)
    expect(statuses()).toEqual(['in_progress', 'error'])
    expect(sentry.captureMessage).toHaveBeenCalledWith('Daily snapshot: GitHub reads failed: n8builds-web', 'error')
  })

  it('reports an error when the database is not connected', async () => {
    state.store = false
    expect((await call('Bearer secret')).status).toBe(503)
    expect(statuses()).toEqual(['in_progress', 'error'])
    expect(sentry.captureMessage).toHaveBeenCalledWith('Daily snapshot: the analytics database is not connected', 'error')
  })

  it("doesn't check in when the owner runs it by hand, so the monitor tracks the schedule only", async () => {
    state.owner = true
    expect((await call()).status).toBe(200)
    expect(sentry.captureCheckIn).not.toHaveBeenCalled()
  })

  it('refuses anyone else without touching Sentry', async () => {
    expect((await call('Bearer wrong')).status).toBe(401)
    expect(sentry.captureCheckIn).not.toHaveBeenCalled()
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
})
