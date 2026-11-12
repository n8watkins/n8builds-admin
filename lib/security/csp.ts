/**
 * The dashboard's Content-Security-Policy, set per request by proxy.ts.
 *
 * Every page renders per request (they all read the session), so scripts run
 * only with this request's nonce: no 'unsafe-inline', and 'strict-dynamic'
 * lets Next.js's own scripts load the chunks they need. The browser loads
 * nothing from any other origin (GitHub, Google, Sentry and Cloudflare are all
 * called from the server) except the announcement preview's images from
 * n8builds.dev, so everything else is 'self' or nothing.
 * Styles keep 'unsafe-inline' for React style attributes.
 */
export function contentSecurityPolicy(nonce: string, { dev = false }: { dev?: boolean } = {}): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // React needs eval in `next dev` only, for its error overlays.
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    // n8builds.dev: the Announcements preview (a sandboxed srcdoc frame, which takes this page's policy) shows the email's logo and project icons from there.
    'img-src': ["'self'", 'data:', 'blob:', 'https://n8builds.dev'],
    'font-src': ["'self'"],
    // Dev HMR uses a websocket.
    'connect-src': ["'self'", ...(dev ? ['ws:'] : [])],
    'frame-src': ["'none'"],
    'worker-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    // Sign-out posts to /api/auth/logout; sign-in is a link to GitHub, not a form.
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

/** A fresh nonce: 16 random bytes, base64. */
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
}
