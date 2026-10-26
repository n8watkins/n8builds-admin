import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/config'
import { clearHostCookie } from '@/lib/auth/cookies'

export const dynamic = 'force-dynamic'

/** Signs out (POST only, from the header's form). Needs no session: clearing a cookie is always safe. */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login?signed-out=1', request.url), 303)
  clearHostCookie(response, SESSION_COOKIE)
  return response
}
