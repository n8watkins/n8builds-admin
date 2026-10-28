import * as Sentry from '@sentry/nextjs'

/**
 * Server-only Sentry: this dashboard's own errors and the daily snapshot's
 * check-ins go to the `n8builds-admin` project. No browser SDK, so the strict
 * CSP (lib/security/csp.ts) allows no new origin. Inert without SENTRY_DSN
 * (local runs, CI and E2E builds).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
}

// Errors thrown in server components, route handlers and the proxy.
export const onRequestError = Sentry.captureRequestError
