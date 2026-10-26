import type { NextResponse } from 'next/server'

/**
 * Attributes every `__Host-` cookie needs. Clearing one needs them too: a
 * browser ignores a `__Host-` Set-Cookie without Secure and Path=/, so a plain
 * `cookies.delete()` would leave the old cookie in place.
 */
const HOST_COOKIE = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const

export function setHostCookie(response: NextResponse, name: string, value: string, maxAge: number): void {
  response.cookies.set(name, value, { ...HOST_COOKIE, maxAge })
}

export function clearHostCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, '', { ...HOST_COOKIE, maxAge: 0 })
}
