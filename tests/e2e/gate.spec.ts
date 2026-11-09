import { expect, test } from '@playwright/test'
import { PAGES } from './pages'

// The normal production build (what Vercel deploys), started with
// ADMIN_DEV_BYPASS=1 and ADMIN_TEST_AUTH=1: both must be ignored.

test.describe('sign-in gate (normal build)', () => {
  for (const { path } of PAGES) {
    test(`${path} redirects to /login without a session`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('heading', { level: 1, name: 'n8builds admin' })).toBeVisible()
    })
  }

  test('the sign-in page explains that sign-in is not set up yet', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/Sign-in isn't set up yet/)).toBeVisible()
    await expect(page.getByRole('link', { name: /Sign in with GitHub/ })).toHaveCount(0)
  })

  test('starting sign-in without an OAuth App goes back to /login', async ({ request }) => {
    const response = await request.get('/api/auth/login', { maxRedirects: 0 })
    expect(response.status()).toBe(303)
    expect(response.headers().location).toContain('/login?error=not-configured')
  })

  test('the callback refuses a request without a valid state', async ({ request }) => {
    const response = await request.get('/api/auth/callback?code=x&state=y', { maxRedirects: 0 })
    expect(response.status()).toBe(303)
    expect(response.headers().location).toContain('/login?error=')
  })

  test('API routes answer 401 without a session', async ({ request }) => {
    const cron = await request.get('/api/cron/snapshot')
    expect(cron.status()).toBe(401)
    const other = await request.get('/api/anything', { maxRedirects: 0 })
    expect(other.status()).toBe(401)
  })

  test("sign-out works from the dashboard's own form, in a real browser", async ({ page }) => {
    await page.goto('/login')
    // The same form the sidebar renders (components/Nav.tsx), posted by the browser itself.
    await page.evaluate(() => {
      const form = document.createElement('form')
      form.method = 'post'
      form.action = '/api/auth/logout'
      document.body.append(form)
      form.submit()
    })
    await expect(page).toHaveURL(/\/login\?signed-out=1$/)
  })

  test("another site's form can't sign the owner out", async ({ request }) => {
    const logout = await request.post('/api/auth/logout', { headers: { 'sec-fetch-site': 'cross-site' }, maxRedirects: 0 })
    expect(logout.status()).toBe(403)
    expect(logout.headers()['set-cookie']).toBeUndefined()
  })

  test('a forged or foreign session cookie is refused', async ({ request }) => {
    // Sent as a raw header: a browser won't store a __Host- cookie for plain-HTTP localhost from a test.
    for (const value of ['not-a-real-token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI4MDU1OTM1In0.c2lnbmF0dXJl']) {
      const response = await request.get('/', { headers: { cookie: `__Host-n8admin_session=${value}` }, maxRedirects: 0 })
      expect(response.status()).toBe(307)
      expect(response.headers().location).toContain('/login')
    }
  })

  test('only the exact public paths skip the gate', async ({ request }) => {
    for (const path of ['/loginx', '/login-anything', '/robots.txt.bak']) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(307)
      expect(response.headers().location, path).toMatch(/\/login$/)
    }
  })

  test('pages send a CSP whose scripts need a fresh nonce on every request', async ({ request }) => {
    const nonceOf = async () => {
      const csp = (await request.get('/login')).headers()['content-security-policy'] ?? ''
      expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/)
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
      expect(csp).toContain("frame-ancestors 'none'")
      return csp.match(/'nonce-([^']+)'/)?.[1]
    }
    expect(await nonceOf()).not.toBe(await nonceOf())
  })

  test('the sign-in page runs under its CSP without a violation', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] }
      w.__csp = []
      document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
    })
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1, name: 'n8builds admin' })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([])
  })

  test('every response is marked noindex and cannot be framed', async ({ request }) => {
    const response = await request.get('/login')
    expect(response.headers()['x-robots-tag']).toContain('noindex')
    expect(response.headers()['x-frame-options']).toBe('DENY')
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toMatch(/Disallow: \//)
  })
})
