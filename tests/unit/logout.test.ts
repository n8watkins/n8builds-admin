import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/auth/logout/route'

const signOut = (site?: string) =>
  POST(new NextRequest('https://admin.n8builds.dev/api/auth/logout', { method: 'POST', headers: site ? { 'sec-fetch-site': site } : {} }))

describe('sign-out', () => {
  it("clears the session cookie when the dashboard's own form posts it", async () => {
    const response = await signOut('same-origin')
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://admin.n8builds.dev/login?signed-out=1')
    expect(response.headers.get('set-cookie')).toMatch(/__Host-n8admin_session=;.*Max-Age=0/i)
  })

  it('refuses a post from another site, or one without Sec-Fetch-Site, and leaves the cookie alone', async () => {
    for (const site of ['cross-site', 'same-site', undefined]) {
      const response = await signOut(site)
      expect(response.status, String(site)).toBe(403)
      expect(response.headers.get('set-cookie'), String(site)).toBeNull()
    }
  })
})
