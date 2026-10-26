import { NextResponse, type NextRequest } from 'next/server'
import { OAUTH_COOKIE, OWNER_GITHUB_ID, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/auth/config'
import { clearHostCookie, setHostCookie } from '@/lib/auth/cookies'
import { callbackUrl, exchangeCode, fetchGitHubUser, revokeToken } from '@/lib/auth/github-oauth'
import { createSessionToken, isAuthConfigured, safeEqual, verifyOAuthStateToken } from '@/lib/auth/tokens'

export const dynamic = 'force-dynamic'

function fail(request: NextRequest, error: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url), 303)
  clearHostCookie(response, OAUTH_COOKIE)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

/** GitHub sends the owner back here: check state, swap the code (with PKCE), admit only the owner's ID. */
export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) return fail(request, 'not-configured')
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const saved = await verifyOAuthStateToken(request.cookies.get(OAUTH_COOKIE)?.value)
  if (!code || !state || !saved || !safeEqual(state, saved.state)) return fail(request, 'state')

  const token = await exchangeCode(code, saved.verifier, callbackUrl(request.nextUrl.origin))
  if (!token) return fail(request, 'exchange')
  const user = await fetchGitHubUser(token)
  await revokeToken(token)
  if (!user) return fail(request, 'exchange')
  if (user.id !== OWNER_GITHUB_ID) return fail(request, 'not-owner')

  const response = NextResponse.redirect(new URL('/', request.url), 303)
  clearHostCookie(response, OAUTH_COOKIE)
  setHostCookie(response, SESSION_COOKIE, await createSessionToken({ githubId: user.id, login: user.login }), SESSION_TTL_SECONDS)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
