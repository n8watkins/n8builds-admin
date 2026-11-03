// The Worker's handlers around the OpenNext build of the dashboard:
//
// - fetch: every request, straight to Next.
// - scheduled: the daily Cron Trigger (wrangler.jsonc triggers.crons, 06:15
//   UTC), which was the Vercel cron. It calls the existing
//   /api/cron/snapshot route in-process through the OpenNext handler (no
//   network hop), with the same `Authorization: Bearer $CRON_SECRET` Vercel
//   Cron sent, so the snapshot code and its tests stay as they are.

/** The bindings (cloudflare-env.d.ts) plus the secrets this file reads, which may be unset. */
import { errorSummary, logError, pathOf } from '../lib/log'

export type WorkerEnv = CloudflareEnv & { CRON_SECRET?: string; SENTRY_DSN?: string }

export type FetchHandler = {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response>
}

// Handled in-process, so the host never resolves. The host header must match
// it, or OpenNext treats the request as external and fetches it over the network.
const INTERNAL_HOST = 'worker.internal'
export const SNAPSHOT_URL = `https://${INTERNAL_HOST}/api/cron/snapshot`

export async function runSnapshot(app: FetchHandler, env: WorkerEnv, ctx: ExecutionContext): Promise<unknown> {
  if (!env.CRON_SECRET) throw new Error('CRON_SECRET is not set')
  const request = new Request(SNAPSHOT_URL, {
    headers: { host: INTERNAL_HOST, authorization: `Bearer ${env.CRON_SECRET}` },
  })
  const response = await app.fetch(request, env, ctx)
  // A failed run throws, so Cloudflare records the cron run as failed too
  // (the route has already reported it to Sentry).
  if (!response.ok) throw new Error(`daily snapshot failed with status ${response.status}`)
  return response.json()
}

export function createWorker(app: FetchHandler) {
  return {
    async fetch(request, env, ctx) {
      try {
        return await app.fetch(request, env, ctx)
      } catch (err) {
        // Next handles its own errors (instrumentation.ts logs them); this is
        // for a throw that escapes OpenNext itself.
        logError({
          event: 'unhandled_exception',
          reason: 'worker_fetch_threw',
          route: pathOf(request.url),
          method: request.method,
          status: 500,
          error: errorSummary(err),
        })
        throw err
      }
    },

    async scheduled(controller, env, ctx) {
      const result = await runSnapshot(app, env, ctx)
      console.log(JSON.stringify({ event: 'daily_snapshot', cron: controller.cron, result }))
    },
  } satisfies ExportedHandler<WorkerEnv>
}
