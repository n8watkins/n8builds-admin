import { SignJWT, jwtVerify } from 'jose'
import {
  JWT_ISSUER,
  OAUTH_AUDIENCE,
  OAUTH_TTL_SECONDS,
  OWNER_GITHUB_ID,
  SESSION_AUDIENCE,
  SESSION_TTL_SECONDS,
} from './config'

/** A signed-in owner. */
export type Session = {
  githubId: number
  login: string
  /** Seconds since the epoch. */
  expiresAt: number
}

/** What the sign-in redirect remembers until GitHub sends the visitor back. */
export type OAuthState = {
  state: string
  verifier: string
}

const MIN_SECRET_LENGTH = 32

/** Whether sign-in is configured at all (the OAuth App and a session secret). */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_OAUTH_CLIENT_ID &&
      process.env.GITHUB_OAUTH_CLIENT_SECRET &&
      (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= MIN_SECRET_LENGTH,
  )
}

function secretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`ADMIN_SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`)
  }
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(user: { githubId: number; login: string }): Promise<string> {
  if (user.githubId !== OWNER_GITHUB_ID) throw new Error('Only the owner can have a session')
  return new SignJWT({ login: user.login })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.githubId))
    .setIssuer(JWT_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey())
}

/** The session in a cookie value, or null if it is missing, forged, expired or not the owner's. */
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: SESSION_AUDIENCE,
    })
    if (payload.sub !== String(OWNER_GITHUB_ID) || typeof payload.exp !== 'number') return null
    return {
      githubId: OWNER_GITHUB_ID,
      login: typeof payload.login === 'string' ? payload.login : '',
      expiresAt: payload.exp,
    }
  } catch {
    return null
  }
}

export async function createOAuthStateToken(value: OAuthState): Promise<string> {
  return new SignJWT({ state: value.state, verifier: value.verifier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(OAUTH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_TTL_SECONDS}s`)
    .sign(secretKey())
}

export async function verifyOAuthStateToken(token: string | undefined): Promise<OAuthState | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: OAUTH_AUDIENCE,
    })
    if (typeof payload.state !== 'string' || typeof payload.verifier !== 'string') return null
    return { state: payload.state, verifier: payload.verifier }
  } catch {
    return null
  }
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

/** 32 random bytes, base64url (43 characters: a valid PKCE verifier and an unguessable state). */
export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

/** The PKCE S256 challenge for a verifier (RFC 7636). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/** Constant-time string comparison, for the OAuth state and the cron secret. */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  let diff = left.length ^ right.length
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return diff === 0
}
