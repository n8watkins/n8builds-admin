# Deploying the admin dashboard

The dashboard runs on Cloudflare Workers as the `n8builds-admin` Worker in the owner's Cloudflare account, built by the OpenNext adapter (`@opennextjs/cloudflare`).
It is served at https://admin.n8builds.dev (a Workers custom domain in `wrangler.jsonc`) and at https://n8builds-admin.nathancwatkins23.workers.dev.

## How it fits together

- `npm run build:worker` runs `next build` (Turbopack, through `open-next.config.ts`'s `buildCommand`) and turns its output into `.open-next/`: the server bundle (`.open-next/worker.js`) and the static assets (`.open-next/assets`).
- `worker/index.ts` is the Worker's entry point (`main` in `wrangler.jsonc`).
  It wraps the OpenNext handler with Sentry (`withSentry`) and adds the `scheduled` handler (`worker/handlers.ts`).
- The daily snapshot is a Cron Trigger (`15 6 * * *`, the Vercel cron's schedule).
  It calls `/api/cron/snapshot` in-process with `Authorization: Bearer $CRON_SECRET`, exactly as Vercel Cron did, so the route and its Sentry cron monitor are unchanged.
- Next's data cache (the five-minute reads of GitHub, GA4, Sentry, OpenPing and Cloudflare) lives in the R2 bucket `n8builds-admin-opennext-cache`.
  Every page is dynamic, so there is no ISR, queue or tag cache.
- `next/image` (the project icons) resizes through the Cloudflare Images binding (`IMAGES`).
- `APP_ENV=production` (a `wrangler.jsonc` var) replaces `VERCEL_ENV`: the Setup page's hosting check and Sentry's environment read it.
- The Releases page reads each project's latest Worker deploy from the Cloudflare API (`lib/cloudflare.ts`) with the read-only `CLOUDFLARE_DEPLOYS_TOKEN`, in place of the Vercel deployments GitHub recorded.

## The sign-in bypasses can never run here

Three independent locks keep the local dev bypass (`lib/auth/dev-bypass.ts`) and the test sign-in (`lib/auth/test-auth.ts`) off on the Worker:

1. The Worker is a normal production build, so both compile to `return false`.
   `npm run build:worker` checks the deployable bundle itself (`scripts/check-no-dev-bypass.mjs --worker`) and fails if either variable is still read anywhere in `.open-next`.
2. `next.config.mjs` refuses an E2E build whenever OpenNext builds (`ADMIN_WORKER_BUILD=1`) or Workers Builds does (`WORKERS_CI`).
3. At runtime, any `APP_ENV` value switches both off again.

`tests/unit/worker-config.test.ts`, `dev-bypass.test.ts` and `test-auth.test.ts` pin all three.
Never set `ADMIN_DEV_BYPASS`, `ADMIN_TEST_AUTH` or `ADMIN_E2E_BUILD` on the Worker.

## Configuration

Plain values live in `wrangler.jsonc` (`vars`).
Secrets are set with `npx wrangler secret put <NAME>` (it asks for the value) and listed with `npx wrangler secret list`.
[docs/SETUP.md](docs/SETUP.md) says where each one comes from.
Until a secret exists, its pages show "not connected", and sign-in stays off until the OAuth App's two values are set.

After changing bindings in `wrangler.jsonc`, run `npm run cf-typegen` to update `cloudflare-env.d.ts`; CI checks it.

## Automatic deploys

`.github/workflows/deploy.yml` builds and deploys on every push to `main`, and on demand from the Actions tab.
It needs a `CLOUDFLARE_API_TOKEN` repository secret: a Cloudflare API token made from the "Edit Cloudflare Workers" template, limited to the owner's account.
Until that secret exists, the workflow builds and then skips the deploy with a notice.

## Deploy by hand

Log in once with `npx wrangler login` (check with `npx wrangler whoami`), then run `npm run deploy`.
To check the Worker locally first, run `npm run preview` and open http://localhost:8787.
To run the cron locally, run `npx wrangler dev --test-scheduled` after a build and open http://localhost:8787/__scheduled.

## Reading the logs

Workers Logs keeps every request (`observability` in `wrangler.jsonc`, `head_sampling_rate: 1`).
In the Cloudflare dashboard, open Workers & Pages, then the `n8builds-admin` Worker, then Logs.
To stream them live, run `npx wrangler tail n8builds-admin --format pretty`.
`--search` matches log messages only, not request URLs, so use `--status error` or no filter to see requests.
Failures log one JSON line with `event`, `reason`, `route` and `status`: sign-in failures as `auth_callback_failed` (`missing_cookie`, `invalid_cookie`, `state_mismatch`, `missing_code`, `token_exchange_failed` with GitHub's error code, `profile_fetch_failed`, `not_owner`), and errors thrown in pages, route handlers or the proxy as `unhandled_exception` with the route (`instrumentation.ts`).
They never carry secrets, tokens, OAuth codes or state values, cookies, emails or other personal data.

## Testing a deployment

`E2E_REMOTE_URL=https://n8builds-admin.nathancwatkins23.workers.dev npx playwright test` runs the gate specs against the deployed Worker: every page and API route locked without a session, forged cookies refused, the CSP and `noindex` headers in place.
The signed-in specs need the test sign-in, which a deployment never has, so they run only locally and in CI.

## Roll back

Run `npx wrangler deployments list` to see recent deployments, and `npx wrangler rollback` to return to the previous version (or `npx wrangler rollback <version-id>`).
Fix forward afterwards by reverting the commit and deploying again, so the repository matches what is live.

## Moving admin.n8builds.dev over

1. Set the Worker's secrets (docs/SETUP.md).
2. The GitHub OAuth App takes several callback URLs: `https://admin.n8builds.dev/api/auth/callback` stays, and adding `https://n8builds-admin.nathancwatkins23.workers.dev/api/auth/callback` lets sign-in be tested on the Worker first.
3. In Cloudflare DNS for n8builds.dev, delete the `admin` A record that points at Vercel (76.76.21.21), then merge the change that adds `admin.n8builds.dev` to `routes` in `wrangler.jsonc`; its deploy creates the new record.
   The two steps leave admin.n8builds.dev unanswered for the minute in between.
4. Then remove `vercel.json`, `.vercelignore` and `scripts/vercel-ignore-build.sh`, the `VERCEL` and `VERCEL_ENV` fallbacks, and delete the Vercel project.

## Taking it down

Run `npx wrangler delete n8builds-admin`; the R2 bucket stays until `npx wrangler r2 bucket delete n8builds-admin-opennext-cache`.
