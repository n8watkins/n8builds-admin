import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/config'
import { signInSkipped } from '@/lib/auth/bypass'
import { verifySessionToken } from '@/lib/auth/tokens'
import { contentSecurityPolicy, newNonce } from '@/lib/security/csp'

/**
 * Runs on every request except Next.js's static files. Two jobs:
 *
 * 1. The CSP, with a fresh nonce per request (lib/security/csp.ts). Next.js
 *    reads it from the request header and puts the nonce on its own scripts.
 * 2. The first gate: everything except the exact public paths below needs the
 *    owner's session cookie. The layout and each route handler check again,
 *    so a mistake here can never expose data on its own.
 */
const PUBLIC_PATHS = new Set(['/login', '/robots.txt', '/icon.png', '/apple-icon.png'])
// Sign-in itself, and the cron route (which checks its own secret).
const PUBLIC_PREFIXES = ['/api/auth/', '/api/cron/']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function proxy(request: NextRequest) {
  const csp = contentSecurityPolicy(newNonce(), { dev: process.env.NODE_ENV === 'development' })
  const pass = () => {
    const headers = new Headers(request.headers)
    headers.set('Content-Security-Policy', csp)
    const response = NextResponse.next({ request: { headers } })
    response.headers.set('Content-Security-Policy', csp)
    return response
  }

  if (signInSkipped() || isPublic(request.nextUrl.pathname)) return pass()
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (session) return pass()
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
