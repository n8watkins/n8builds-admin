import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/config'
import { clearHostCookie } from '@/lib/auth/cookies'
import { isSameOriginRequest } from '@/lib/auth/same-origin'

export const dynamic = 'force-dynamic'

/**
 * Signs out (POST only, from the header's form). Needs no session: clearing a
 * cookie is always safe. Only this site's own form may do it, so another site
 * can't sign the owner out (lib/auth/same-origin.ts).
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'cross-site' }, { status: 403 })
  }
  const response = NextResponse.redirect(new URL('/login?signed-out=1', request.url), 303)
  clearHostCookie(response, SESSION_COOKIE)
  return response
}
