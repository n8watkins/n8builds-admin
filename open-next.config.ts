import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'

// Every page is dynamic (each one checks the owner's session), so there is no
// ISR and no revalidation queue. What is cached is Next's data cache: the
// five-minute `unstable_cache` and `fetch(..., { next: { revalidate } })`
// reads of GitHub, GA4, Sentry, OpenPing and Cloudflare (lib/cache.ts), kept
// in R2 (https://opennext.js.org/cloudflare/caching). No tag cache: the one
// revalidatePath call (waitlist/actions.ts) refreshes a dynamic page whose data
// is never cached.
const config = {
  ...defineCloudflareConfig({ incrementalCache: r2IncrementalCache }),
  // ADMIN_WORKER_BUILD=1 makes next.config.mjs refuse an E2E build (the
  // test-only sign-in stub), however this build is started.
  buildCommand: 'ADMIN_WORKER_BUILD=1 npm run build',
}

export default config
