import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.VERCEL_ENV ?? 'development',
  // Errors and cron check-ins only: no tracing, logs or profiling.
  tracesSampleRate: 0,
  // The owner is the only user; nothing about requests is needed beyond the error.
  sendDefaultPii: false,
  // Stack-frame locals can hold API tokens and the session secret.
  includeLocalVariables: false,
})
