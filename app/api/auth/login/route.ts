import { NextResponse, type NextRequest } from 'next/server'
import { OAUTH_COOKIE, OAUTH_TTL_SECONDS } from '@/lib/auth/config'
import { setHostCookie } from '@/lib/auth/cookies'
import { callbackUrl } from '@/lib/auth/github-oauth'
import { createOAuthStateToken, isAuthConfigured, pkceChallenge, randomToken } from '@/lib/auth/tokens'
import { logError } from '@/lib/log'

export const dynamic = 'force-dynamic'

/** Starts GitHub sign-in: a fresh state and PKCE verifier, remembered in a signed short-lived cookie. */
export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) {
    logError({ event: 'auth_login_failed', reason: 'not_configured', route: '/api/auth/login', status: 303 })
    return NextResponse.redirect(new URL('/login?error=not-configured', request.url), 303)
  }
  const state = randomToken()
  const verifier = randomToken()
  const authorize = new URL('https://github.com/login/oauth/authorize')
  authorize.searchParams.set('client_id', process.env.GITHUB_OAUTH_CLIENT_ID!)
  authorize.searchParams.set('redirect_uri', callbackUrl(request.nextUrl.origin))
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('code_challenge', await pkceChallenge(verifier))
  authorize.searchParams.set('code_challenge_method', 'S256')
  authorize.searchParams.set('allow_signup', 'false')
  // No scopes: reading the signed-in account's public profile is all it needs.
  authorize.searchParams.set('scope', '')

  const response = NextResponse.redirect(authorize, 303)
  setHostCookie(response, OAUTH_COOKIE, await createOAuthStateToken({ state, verifier }), OAUTH_TTL_SECONDS)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
