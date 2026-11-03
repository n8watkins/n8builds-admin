import * as Sentry from '@sentry/nextjs'
import type { Instrumentation } from 'next'
import { errorSummary, logError, pathOf } from './lib/log'

/**
 * Server-only Sentry: this dashboard's own errors and the daily snapshot's
 * check-ins go to the `n8builds-admin` project. No browser SDK, so the strict
 * CSP (lib/security/csp.ts) allows no new origin. Inert without SENTRY_DSN
 * (local runs, CI and E2E builds).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
}

// Errors thrown in server components, route handlers and the proxy: one JSON
// line with the route for Workers Logs, then Sentry. The path drops its query
// string, which can carry codes or state.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logError({
    event: 'unhandled_exception',
    reason: context.routeType,
    route: context.routePath,
    path: pathOf(request.path),
    method: request.method,
    status: 500,
    error: errorSummary(error),
    digest: (error as { digest?: unknown } | null)?.digest as string | undefined,
  })
  return Sentry.captureRequestError(error, request, context)
}
