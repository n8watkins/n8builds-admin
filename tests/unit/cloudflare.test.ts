import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { getWorkerDeploy, toWorkerDeploy } = await import('@/lib/cloudflare')

const raw = {
  id: 'd1',
  source: 'wrangler',
  created_on: '2026-11-03T18:56:25Z',
  annotations: { 'workers/triggered_by': 'deployment', 'workers/message': 'feat: something' },
  versions: [
    { version_id: 'aaaaaaaa-1111', percentage: 10 },
    { version_id: 'bbbbbbbb-2222', percentage: 90 },
  ],
}

describe('Cloudflare Workers deploys', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the version serving most traffic, its trigger and message', () => {
    expect(toWorkerDeploy('n8builds-web', raw)).toEqual({
      worker: 'n8builds-web',
      createdAt: '2026-11-03T18:56:25Z',
      source: 'wrangler',
      trigger: 'deployment',
      message: 'feat: something',
      version: 'bbbbbbbb',
      url: 'https://dash.cloudflare.com/b2c564cf83cb9184dd6d7cc4ff8b38bf/workers/services/view/n8builds-web/production',
    })
    expect(toWorkerDeploy('x', undefined)).toBeNull()
  })

  it('is not connected without a token', async () => {
    vi.stubEnv('CLOUDFLARE_DEPLOYS_TOKEN', '')
    expect(await getWorkerDeploy('n8builds-web')).toMatchObject({ ok: false })
  })

  it('reads the newest deployment with the token', async () => {
    vi.stubEnv('CLOUDFLARE_DEPLOYS_TOKEN', 'token')
    const fetch = vi.fn(async () =>
      Response.json({ success: true, result: { deployments: [{ ...raw, created_on: '2026-01-01T00:00:00Z', id: 'old' }, raw] } }),
    )
    vi.stubGlobal('fetch', fetch)
    const result = await getWorkerDeploy('n8builds-web')
    expect(result).toMatchObject({ ok: true, data: { createdAt: '2026-11-03T18:56:25Z' } })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/b2c564cf83cb9184dd6d7cc4ff8b38bf/workers/scripts/n8builds-web/deployments')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token')
  })

  it('treats a Worker that does not exist as never deployed', async () => {
    vi.stubEnv('CLOUDFLARE_DEPLOYS_TOKEN', 'token')
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, errors: [{ message: 'not found' }] }, { status: 404 })))
    expect(await getWorkerDeploy('missing')).toEqual({ ok: true, data: null })
  })
})
