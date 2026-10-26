import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/config'
import { isDevBypassEnabled } from '@/lib/auth/dev-bypass'
import { verifySessionToken } from '@/lib/auth/tokens'

/**
 * The first gate: every page and API route except sign-in itself and the cron
 * route (which checks its own secret) needs the owner's session cookie.
 * The layout and each route handler check again, so a matcher mistake here
 * can never expose data on its own.
 */
export async function proxy(request: NextRequest) {
  if (isDevBypassEnabled()) return NextResponse.next()
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (session) return NextResponse.next()
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!login|api/auth/|api/cron/|_next/static|_next/image|icon.png|apple-icon.png|robots.txt).*)'],
}
