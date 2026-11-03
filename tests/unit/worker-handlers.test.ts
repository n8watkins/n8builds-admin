import { describe, expect, it, vi } from 'vitest'
import { SNAPSHOT_URL, createWorker, type FetchHandler, type WorkerEnv } from '@/worker/handlers'

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext

function app(status = 200) {
  const fetch = vi.fn(async (_request: Request) => Response.json({ ok: status === 200 }, { status }))
  return { fetch } satisfies FetchHandler
}

const env = (secret?: string) => ({ APP_ENV: 'production', CRON_SECRET: secret }) as WorkerEnv
const scheduled = (worker: ReturnType<typeof createWorker>, secret?: string) =>
  worker.scheduled({ cron: '15 6 * * *', scheduledTime: 0, type: 'scheduled', noRetry() {} } as ScheduledController, env(secret), ctx)

describe('the daily Cron Trigger', () => {
  it('calls the snapshot route in-process with the cron secret, as Vercel Cron did', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const next = app()
    await scheduled(createWorker(next), 's3cret')
    const request = next.fetch.mock.calls[0]![0]
    expect(request.url).toBe(SNAPSHOT_URL)
    expect(new URL(request.url).pathname).toBe('/api/cron/snapshot')
    expect(request.headers.get('authorization')).toBe('Bearer s3cret')
    expect(request.headers.get('host')).toBe(new URL(SNAPSHOT_URL).host)
  })

  it('fails the run when the route fails, so Cloudflare records it', async () => {
    await expect(scheduled(createWorker(app(503)), 's3cret')).rejects.toThrow(/503/)
  })

  it('refuses to run without CRON_SECRET', async () => {
    const next = app()
    await expect(scheduled(createWorker(next))).rejects.toThrow(/CRON_SECRET/)
    expect(next.fetch).not.toHaveBeenCalled()
  })

  it('passes every other request straight to Next', async () => {
    const next = app()
    const request = new Request('https://example.test/login')
    await createWorker(next).fetch(request as Parameters<ReturnType<typeof createWorker>['fetch']>[0], env(), ctx)
    expect(next.fetch).toHaveBeenCalledWith(request, expect.anything(), ctx)
  })
})
