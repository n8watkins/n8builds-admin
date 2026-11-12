import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, newNonce } from '@/lib/security/csp'

const directive = (policy: string, name: string) =>
  policy.split('; ').find((d) => d.startsWith(`${name} `))?.slice(name.length + 1).split(' ') ?? []

describe('contentSecurityPolicy', () => {
  it('runs only scripts carrying this request nonce in production', () => {
    const policy = contentSecurityPolicy('abc123')
    expect(directive(policy, 'script-src')).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"])
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(policy).not.toContain("'unsafe-eval'")
  })

  it('loads nothing from other origins but n8builds.dev\'s email images, and nothing can frame the dashboard', () => {
    const policy = contentSecurityPolicy('n')
    expect(directive(policy, 'connect-src')).toEqual(["'self'"])
    expect(directive(policy, 'object-src')).toEqual(["'none'"])
    expect(directive(policy, 'frame-src')).toEqual(["'none'"])
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"])
    // The Announcements preview shows the email's logo and project icons, served from n8builds.dev.
    expect(directive(policy, 'img-src')).toEqual(["'self'", 'data:', 'blob:', 'https://n8builds.dev'])
    expect(policy.replace(' https://n8builds.dev;', ';')).not.toMatch(/https?:\/\//)
  })

  it('allows eval and the HMR websocket only in dev', () => {
    const policy = contentSecurityPolicy('n', { dev: true })
    expect(directive(policy, 'script-src')).toContain("'unsafe-eval'")
    expect(directive(policy, 'connect-src')).toContain('ws:')
  })
})

describe('newNonce', () => {
  it('is 16 random bytes in base64, different every time', () => {
    const a = newNonce()
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(new Set(Array.from({ length: 50 }, newNonce)).size).toBe(50)
  })
})
