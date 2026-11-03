import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { OAUTH_COOKIE } from '@/lib/auth/config'
import { createOAuthStateToken } from '@/lib/auth/tokens'

vi.mock('server-only', () => ({}))

const { GET } = await import('@/app/api/auth/callback/route')

const ORIGIN = 'https://admin.example.test'

beforeEach(() => {
  vi.stubEnv('GITHUB_OAUTH_CLIENT_ID', 'cid')
  vi.stubEnv('GITHUB_OAUTH_CLIENT_SECRET', 'csecret')
  vi.stubEnv('ADMIN_SESSION_SECRET', 'test-secret-that-is-long-enough-for-hs256-0123456789')
})

function call(query: string, cookie?: string) {
  const headers = cookie ? { cookie: `${OAUTH_COOKIE}=${cookie}` } : undefined
  return GET(new NextRequest(`${ORIGIN}/api/auth/callback?${query}`, { headers }))
}

function lines(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, unknown>)
}

describe('sign-in callback failure logs', () => {
  it('names each failure in one JSON line without the code, state or cookie', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'bad_verification_code', error_description: 'x' })))
    const cookie = await createOAuthStateToken({ state: 'goodstate', verifier: 'v' })

    await call('code=secretcode&state=secretstate')
    await call('code=secretcode&state=wrong', cookie)
    await call('state=goodstate&error=access_denied', cookie)
    await call('code=secretcode&state=goodstate', 'forged')
    await call('code=secretcode&state=goodstate', cookie)

    const base = { event: 'auth_callback_failed', route: '/api/auth/callback', status: 303 }
    expect(lines(warn)).toEqual([
      { ...base, reason: 'missing_cookie' },
      { ...base, reason: 'state_mismatch' },
      { ...base, reason: 'missing_code', providerError: 'access_denied' },
      { ...base, reason: 'invalid_cookie' },
      { ...base, reason: 'token_exchange_failed', providerStatus: 200, providerError: 'bad_verification_code' },
    ])
    const logged = warn.mock.calls.map((c) => String(c[0])).join('\n')
    for (const secret of ['secretcode', 'secretstate', 'goodstate', cookie, 'forged', 'csecret']) {
      expect(logged).not.toContain(secret)
    }
  })

  it('logs profile_fetch_failed and not_owner without the account', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cookie = await createOAuthStateToken({ state: 's', verifier: 'v' })
    const github = (userStatus: number) =>
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input instanceof Request ? input.url : input)
        if (url.includes('/login/oauth/access_token')) return Response.json({ access_token: 'tok' })
        if (url === 'https://api.github.com/user') return Response.json({ id: 1, login: 'someone' }, { status: userStatus })
        return new Response(null, { status: 204 })
      })

    vi.stubGlobal('fetch', github(401))
    await call('code=c&state=s', cookie)
    vi.stubGlobal('fetch', github(200))
    await call('code=c&state=s', cookie)

    expect(lines(warn).map((l) => [l.reason, l.providerStatus])).toEqual([
      ['profile_fetch_failed', 401],
      ['not_owner', undefined],
    ])
    expect(warn.mock.calls.join('\n')).not.toContain('someone')
  })
})
