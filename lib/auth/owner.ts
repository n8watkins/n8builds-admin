import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { OWNER_GITHUB_ID, OWNER_LOGIN, SESSION_COOKIE } from './config'
import { signInSkipped } from './bypass'
import { verifySessionToken, type Session } from './tokens'

export type Owner = Session & { devBypass: boolean }

function bypassOwner(): Owner {
  return {
    githubId: OWNER_GITHUB_ID,
    login: OWNER_LOGIN,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    devBypass: true,
  }
}

/** The signed-in owner for a server component, or null. */
export async function getOwner(): Promise<Owner | null> {
  if (signInSkipped()) return bypassOwner()
  const store = await cookies()
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  return session ? { ...session, devBypass: false } : null
}

/** For pages and layouts: the owner, or a redirect to the sign-in page. */
export async function requireOwner(): Promise<Owner> {
  const owner = await getOwner()
  if (!owner) redirect('/login')
  return owner
}

/** For route handlers: the owner from the request's cookie, or null (answer 401). */
export async function ownerFromRequest(request: NextRequest): Promise<Owner | null> {
  if (signInSkipped()) return bypassOwner()
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  return session ? { ...session, devBypass: false } : null
}
