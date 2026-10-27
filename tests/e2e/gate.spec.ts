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

  test('a forged or foreign session cookie is refused', async ({ request }) => {
    // Sent as a raw header: a browser won't store a __Host- cookie for plain-HTTP localhost from a test.
    for (const value of ['not-a-real-token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI4MDU1OTM1In0.c2lnbmF0dXJl']) {
      const response = await request.get('/', { headers: { cookie: `__Host-n8admin_session=${value}` }, maxRedirects: 0 })
      expect(response.status()).toBe(307)
      expect(response.headers().location).toContain('/login')
    }
  })

  test('every response is marked noindex and cannot be framed', async ({ request }) => {
    const response = await request.get('/login')
    expect(response.headers()['x-robots-tag']).toContain('noindex')
    expect(response.headers()['x-frame-options']).toBe('DENY')
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toMatch(/Disallow: \//)
  })
})
