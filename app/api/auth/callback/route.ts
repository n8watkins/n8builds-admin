import { NextResponse, type NextRequest } from 'next/server'
import { OAUTH_COOKIE, OWNER_GITHUB_ID, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/auth/config'
import { clearHostCookie, setHostCookie } from '@/lib/auth/cookies'
import { callbackUrl, exchangeCode, fetchGitHubUser, revokeToken } from '@/lib/auth/github-oauth'
import { createSessionToken, isAuthConfigured, safeEqual, verifyOAuthStateToken } from '@/lib/auth/tokens'
import { logError, logWarn, oauthErrorCode, type LogFields } from '@/lib/log'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/auth/callback'

function fail(request: NextRequest, error: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url), 303)
  clearHostCookie(response, OAUTH_COOKIE)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

/** One JSON line naming why sign-in failed; never the code, state, cookie, token or account. */
function logFailure(level: 'warn' | 'error', fields: Omit<LogFields, 'event' | 'route' | 'status'>) {
  const line = { event: 'auth_callback_failed', route: ROUTE, status: 303, ...fields } as LogFields
  if (level === 'error') logError(line)
  else logWarn(line)
}

/** GitHub sends the owner back here: check state, swap the code (with PKCE), admit only the owner's ID. */
export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) {
    logFailure('error', { reason: 'not_configured' })
    return fail(request, 'not-configured')
  }
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const cookie = request.cookies.get(OAUTH_COOKIE)?.value
  const saved = await verifyOAuthStateToken(cookie)
  if (!code || !state || !saved || !safeEqual(state, saved.state)) {
    const reason = !cookie
      ? 'missing_cookie'
      : !saved
        ? 'invalid_cookie'
        : !state || !safeEqual(state, saved.state)
          ? 'state_mismatch'
          : 'missing_code'
    // GitHub's own reason when it sent the owner back without a code
    // (access_denied when they cancel).
    logFailure('warn', { reason, providerError: oauthErrorCode(request.nextUrl.searchParams.get('error')) })
    return fail(request, 'state')
  }

  const exchange = await exchangeCode(code, saved.verifier, callbackUrl(request.nextUrl.origin))
  if (exchange.token === null) {
    logFailure('warn', { reason: 'token_exchange_failed', providerStatus: exchange.status, providerError: exchange.error })
    return fail(request, 'exchange')
  }
  const profile = await fetchGitHubUser(exchange.token)
  await revokeToken(exchange.token)
  if (profile.user === null) {
    logFailure('warn', { reason: 'profile_fetch_failed', providerStatus: profile.status })
    return fail(request, 'exchange')
  }
  const user = profile.user
  if (user.id !== OWNER_GITHUB_ID) {
    logFailure('warn', { reason: 'not_owner' })
    return fail(request, 'not-owner')
  }

  const response = NextResponse.redirect(new URL('/', request.url), 303)
  clearHostCookie(response, OAUTH_COOKIE)
  setHostCookie(response, SESSION_COOKIE, await createSessionToken({ githubId: user.id, login: user.login }), SESSION_TTL_SECONDS)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
