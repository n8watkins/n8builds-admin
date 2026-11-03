import * as Sentry from '@sentry/nextjs'
import { SENTRY_DATA_COLLECTION } from './lib/sentry-data-collection'

const dsn = process.env.SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  // APP_ENV on the Cloudflare Worker (wrangler.jsonc); VERCEL_ENV until the Vercel project is deleted.
  environment: process.env.APP_ENV ?? process.env.VERCEL_ENV ?? 'development',
  // Errors and cron check-ins only: no tracing, logs or profiling.
  tracesSampleRate: 0,
  // The owner is the only user; nothing about requests is needed beyond the error.
  dataCollection: SENTRY_DATA_COLLECTION,
})
