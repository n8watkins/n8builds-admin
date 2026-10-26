import { SignJWT } from 'jose'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JWT_ISSUER, OWNER_GITHUB_ID, SESSION_AUDIENCE } from '@/lib/auth/config'
import {
  createOAuthStateToken,
  createSessionToken,
  pkceChallenge,
  randomToken,
  safeEqual,
  verifyOAuthStateToken,
  verifySessionToken,
} from '@/lib/auth/tokens'

const SECRET = 'test-secret-that-is-long-enough-for-hs256-0123456789'

beforeEach(() => {
  vi.stubEnv('ADMIN_SESSION_SECRET', SECRET)
})

describe('session tokens', () => {
  it('round-trips the owner with a 7-day expiry', async () => {
    const token = await createSessionToken({ githubId: OWNER_GITHUB_ID, login: 'n8watkins' })
    const session = await verifySessionToken(token)
    expect(session?.githubId).toBe(OWNER_GITHUB_ID)
    expect(session?.login).toBe('n8watkins')
    const days = ((session?.expiresAt ?? 0) - Date.now() / 1000) / 86_400
    expect(days).toBeGreaterThan(6.99)
    expect(days).toBeLessThanOrEqual(7)
  })

  it('refuses to mint a session for anyone else', async () => {
    await expect(createSessionToken({ githubId: 1, login: 'someone' })).rejects.toThrow()
  })

  it('rejects a validly signed token for another account', async () => {
    const forged = await new SignJWT({ login: 'someone' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuer(JWT_ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET))
    expect(await verifySessionToken(forged)).toBeNull()
  })

  it('rejects tokens signed with another secret, expired, or tampered with', async () => {
    const token = await createSessionToken({ githubId: OWNER_GITHUB_ID, login: 'n8watkins' })
    vi.stubEnv('ADMIN_SESSION_SECRET', `${SECRET}-rotated`)
    expect(await verifySessionToken(token)).toBeNull()
    vi.stubEnv('ADMIN_SESSION_SECRET', SECRET)
    expect(await verifySessionToken(`${token.slice(0, -2)}xx`)).toBeNull()
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(OWNER_GITHUB_ID))
      .setIssuer(JWT_ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(SECRET))
    expect(await verifySessionToken(expired)).toBeNull()
    expect(await verifySessionToken(undefined)).toBeNull()
  })

  it('does not accept an OAuth state token as a session', async () => {
    const state = await createOAuthStateToken({ state: 'a', verifier: 'b' })
    expect(await verifySessionToken(state)).toBeNull()
  })

  it('treats a missing or short secret as no session, never as open', async () => {
    const token = await createSessionToken({ githubId: OWNER_GITHUB_ID, login: 'n8watkins' })
    vi.stubEnv('ADMIN_SESSION_SECRET', 'short')
    expect(await verifySessionToken(token)).toBeNull()
    vi.stubEnv('ADMIN_SESSION_SECRET', undefined)
    expect(await verifySessionToken(token)).toBeNull()
  })
})

describe('OAuth state and PKCE', () => {
  it('round-trips state and verifier', async () => {
    const value = { state: randomToken(), verifier: randomToken() }
    expect(await verifyOAuthStateToken(await createOAuthStateToken(value))).toEqual(value)
  })

  it('makes 43-character base64url tokens', () => {
    const token = randomToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(token)
  })

  it('computes the RFC 7636 S256 challenge', async () => {
    // The test vector from RFC 7636, appendix B.
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('compares strings exactly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', 'a')).toBe(false)
  })
})
