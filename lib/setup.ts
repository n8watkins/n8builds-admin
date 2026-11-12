/**
 * The owner's setup checklist: every account resource the dashboard needs.
 * The single source for both the in-app Setup page (with live status) and
 * docs/SETUP.md, which `npm run setup:docs` generates from this file
 * (tests/unit/setup-docs.test.ts fails if the two drift apart).
 *
 * Plain data, no imports, so the generator can load it with Node directly.
 * Text may use `backticks` for code; one sentence per step.
 */

export type SetupVar = {
  name: string
  /** Where the value goes. */
  where: string
  optional?: boolean
}

export type SetupItem = {
  id: string
  title: string
  /** One sentence: what this unlocks. */
  why: string
  /** Detail pages this item powers (hrefs). */
  powers: { label: string; href: string }[]
  /**
   * How the app can tell it's done: `env` (its required variables are set),
   * `bindings` (its D1 bindings exist, and its required variables are set),
   * `deployed` (running in production, on the Cloudflare Worker) or `manual` (only visible in
   * another dashboard, so the page can only say what to check).
   */
  check: 'env' | 'bindings' | 'deployed' | 'manual'
  vars: SetupVar[]
  steps: string[]
  /** The places the steps happen, as buttons on the Setup page. */
  links: { label: string; href: string }[]
}

export const SETUP_INTRO = [
  'Everything here is an account resource only the owner can create.',
  'The code is ready for each one: a page switches from "Not connected yet" to live data as soon as its variables exist.',
  'Secrets go straight into the Cloudflare Worker (`npx wrangler secret put <NAME>` in this repo, which asks for the value) or your local `.env.local`.',
  'Never paste a secret, token or key into a chat, an issue, a commit or a doc.',
  'Agents only ever need the variable names, never the values.',
]

export const SETUP_ITEMS: SetupItem[] = [
  {
    id: 'sign-in',
    title: 'Sign-in: a GitHub OAuth App',
    why: 'Lets you sign in with GitHub; only your account (user ID 8055935) gets in.',
    powers: [{ label: 'Sign-in', href: '/login' }],
    check: 'env',
    vars: [
      { name: 'GITHUB_OAUTH_CLIENT_ID', where: 'Worker secret (and `.env.local` for real sign-in locally)' },
      { name: 'GITHUB_OAUTH_CLIENT_SECRET', where: 'Worker secret (and `.env.local` for real sign-in locally)' },
      { name: 'ADMIN_SESSION_SECRET', where: 'Worker secret and `.env.local` (different values)' },
    ],
    steps: [
      'Open GitHub, Settings, Developer settings, OAuth Apps, New OAuth App.',
      'Name `n8builds admin`, homepage `https://admin.n8builds.dev`, redirect URI `https://admin.n8builds.dev/api/auth/callback`; wildcard matching and Device Flow off; "Expire user access tokens" can stay on.',
      'Register it, click "Generate a new client secret", and put the Client ID and secret in the Worker as `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.',
      'Optional, for real GitHub sign-in on your machine: add a second redirect URI `http://localhost:3831/api/auth/callback` to the same app and put the same two values in `.env.local`. Without it, the local preview runs on `ADMIN_DEV_BYPASS`.',
      'Make a session secret with `openssl rand -base64 48` and set it as `ADMIN_SESSION_SECRET` (a different value in the Worker and in `.env.local`).',
      'No scopes are requested: the app only learns which account signed in, and the dashboard revokes that token straight away.',
      'Rotating `ADMIN_SESSION_SECRET` signs every session out.',
    ],
    links: [
      { label: 'GitHub OAuth Apps', href: 'https://github.com/settings/developers' },
      { label: 'New OAuth App', href: 'https://github.com/settings/applications/new' },
    ],
  },
  {
    id: 'github',
    title: 'GitHub data: fine-grained tokens',
    why: 'Reads CI runs, Actions minutes, stars, repo traffic, releases, deploys and Dependabot alerts.',
    powers: [
      { label: 'CI', href: '/ci' },
      { label: 'Actions minutes', href: '/minutes' },
      { label: 'Stars and traffic', href: '/repos' },
      { label: 'Releases and deploys', href: '/releases' },
      { label: 'Security alerts', href: '/security' },
    ],
    check: 'env',
    vars: [
      { name: 'GITHUB_TOKEN', where: 'Worker secret (locally: `GITHUB_TOKEN=$(gh auth token)` when starting the server)' },
      { name: 'GITHUB_ORG_TOKEN', where: 'Worker secret (optional locally: the gh token reads the org)', optional: true },
    ],
    steps: [
      'A fine-grained token covers one resource owner, so the personal repos and the Appturnity org each get their own token.',
      'Open GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token.',
      'Token one: name `n8builds-admin read`, resource owner `n8watkins`, expiration 1 year (add a calendar reminder to renew it; the current one, made 2026-10-27, expires 2027-10-27).',
      'Repository access: "Only select repositories": n8builds-web, dev-portfolio, portfolio-rank, open-ping, scribe, solara, voicedock (was piper-tts), tl-dw, tube-vault and n8builds-admin.',
      'Repository permissions, all read-only: Actions, Administration (for views and clones), Contents, Deployments, Dependabot alerts, and Metadata (added automatically).',
      'Account permissions: Plan, read-only (for the personal Actions minutes report).',
      'Set it as `GITHUB_TOKEN`.',
      'Token two: name `n8builds-admin billing`, resource owner `Appturnity` (the org must allow fine-grained tokens: Appturnity, Settings, Personal access tokens).',
      'Repository access: "Public repositories"; organization permissions: Administration, read-only (the org billing report).',
      'Set it as `GITHUB_ORG_TOKEN`.',
      'If GitHub refuses the org billing report with the fine-grained token, a classic token with only `read:org` works for it instead.',
      'While you are there, turn on Dependabot alerts in each repo\'s Settings, Code security (the Security alerts page lists the repos that have them off).',
    ],
    links: [
      { label: 'New fine-grained token', href: 'https://github.com/settings/personal-access-tokens/new' },
      { label: 'Appturnity token policy', href: 'https://github.com/organizations/Appturnity/settings/personal-access-tokens' },
    ],
  },
  {
    id: 'ga4',
    title: 'Website traffic: Google Analytics Data API',
    why: 'Reads visitors, countries, top pages, referrers, time on site and scroll depth from the GA4 property n8builds.dev already uses.',
    powers: [{ label: 'Website traffic', href: '/traffic' }],
    check: 'env',
    vars: [
      { name: 'GA4_PROPERTY_ID', where: 'Worker secret' },
      { name: 'GOOGLE_SA_CLIENT_EMAIL', where: 'Worker secret' },
      { name: 'GOOGLE_SA_PRIVATE_KEY', where: 'Worker secret' },
    ],
    steps: [
      'One GA4 property (`G-JZQGKY9Q37`) covers all of n8builds.dev, subdomains included, so one property is enough.',
      'In Google Cloud Console, create a project (or reuse one) named `n8builds-admin`.',
      'APIs and Services, Library: enable "Google Analytics Data API".',
      'IAM and Admin, Service accounts, Create service account: name `n8builds-admin-ga`, no project roles.',
      'Open it, Keys, Add key, Create new key, JSON, and download it.',
      'In Google Analytics, Admin, Property access management, add the service account\'s email as a Viewer.',
      'Copy the numeric Property ID from Admin, Property details (a number, not the `G-` measurement ID) and set it as `GA4_PROPERTY_ID`.',
      'From the JSON file, set `client_email` as `GOOGLE_SA_CLIENT_EMAIL` and `private_key` as `GOOGLE_SA_PRIVATE_KEY` (paste it as it is, `\\n` sequences included).',
      'Delete the downloaded JSON file once both values are in the Worker.',
    ],
    links: [
      { label: 'Enable the Analytics Data API', href: 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com' },
      { label: 'Service accounts', href: 'https://console.cloud.google.com/iam-admin/serviceaccounts' },
      { label: 'Google Analytics admin', href: 'https://analytics.google.com/analytics/web/#/admin' },
    ],
  },
  {
    id: 'sentry',
    title: 'Errors: Sentry read-only token',
    why: 'Reads unresolved and new issues and error volume for the sites Sentry already watches. With its DSN set, this dashboard reports its own server errors and the daily snapshot\'s check-ins too.',
    powers: [{ label: 'Errors', href: '/errors' }],
    check: 'env',
    vars: [
      { name: 'SENTRY_AUTH_TOKEN', where: 'Worker secret' },
      { name: 'SENTRY_ORG', where: 'Worker secret' },
      { name: 'SENTRY_PROJECTS', where: 'Worker secret' },
      { name: 'SENTRY_API_BASE', where: 'Worker secret, only for Sentry\'s EU region', optional: true },
      { name: 'SENTRY_DSN', where: 'Worker secret', optional: true },
    ],
    steps: [
      'In Sentry, User settings, Personal Tokens (User Auth Tokens), Create New Token.',
      'Scopes: only `org:read`, `project:read` and `event:read`; leave everything else at "No access".',
      'Set it as `SENTRY_AUTH_TOKEN`.',
      'Set your org slug (from the Sentry URL) as `SENTRY_ORG`.',
      'Set the project slugs to watch, comma-separated (`n8builds,portfolio,n8builds-admin`), as `SENTRY_PROJECTS`.',
      'Only if your org lives in Sentry\'s EU region, also set `SENTRY_API_BASE` to `https://de.sentry.io`.',
      'For this dashboard\'s own errors: in the `n8builds-admin` Sentry project, Settings, Client Keys (DSN), copy the DSN and set it as `SENTRY_DSN`. A missed or failed daily snapshot then emails you (cron monitor `admin-daily-snapshot`).',
    ],
    links: [{ label: 'Sentry auth tokens', href: 'https://sentry.io/settings/account/api/auth-tokens/' }],
  },
  {
    id: 'databases',
    title: 'Counters, trends, the waitlist and the newsletter: the D1 databases',
    why: 'Reads the referral, contact and dino game counts, the waitlist and the newsletter from the databases n8builds-web writes, and keeps the daily stars and minutes snapshot in the dashboard\'s own database.',
    powers: [
      { label: 'Stars trend', href: '/repos' },
      { label: 'Referrals', href: '/referrals' },
      { label: 'Contact messages', href: '/contact' },
      { label: 'Dino game', href: '/game' },
      { label: 'Waitlist', href: '/waitlist' },
      { label: 'Newsletter', href: '/newsletter' },
    ],
    check: 'bindings',
    vars: [
      { name: 'WAITLIST_DB', where: 'D1 binding (wrangler.jsonc)' },
      { name: 'ANALYTICS_DB', where: 'D1 binding (wrangler.jsonc)' },
      { name: 'ADMIN_DB', where: 'D1 binding (wrangler.jsonc)' },
      { name: 'CRON_SECRET', where: 'Worker secret' },
    ],
    steps: [
      'The three databases already exist and are bound in `wrangler.jsonc`: `n8builds-waitlist` and `n8builds-analytics` (owned by n8builds-web, read only here) and `n8builds-admin` (this dashboard\'s own).',
      'The deploy from `main` applies new files in `migrations/admin/` (`npm run db:migrate`) before the code goes live; run it by hand only for a local or manual deploy.',
      'Make a cron secret with `openssl rand -hex 32` and set it as `CRON_SECRET` (the Worker\'s Cron Trigger sends it to the snapshot route).',
      'The daily snapshot (`/api/cron/snapshot`, 06:15 UTC, a Cron Trigger in `wrangler.jsonc`) starts on the first deploy, and trends fill in from the next day.',
      'docs/DATABASE.md has the tables, who owns each database, retention and backups.',
    ],
    links: [{ label: 'D1 in Cloudflare', href: 'https://dash.cloudflare.com/?to=/:account/workers/d1' }],
  },
  {
    id: 'cloudflare-deploys',
    title: 'Deploys: a read-only Cloudflare API token',
    why: 'Shows each project\'s latest Cloudflare Workers deploy on the Releases page, the way it showed Vercel\'s.',
    powers: [{ label: 'Releases and deploys', href: '/releases' }],
    check: 'env',
    vars: [{ name: 'CLOUDFLARE_DEPLOYS_TOKEN', where: 'Worker secret' }],
    steps: [
      'In Cloudflare, My Profile, API Tokens, Create Token, Create Custom Token.',
      'Name `n8builds-admin deploys read`; permissions: Account, Workers Scripts, Read; account resources: the owner\'s account only.',
      'Set it as `CLOUDFLARE_DEPLOYS_TOKEN` (a read token, separate from the deploy token GitHub Actions uses).',
    ],
    links: [{ label: 'Cloudflare API tokens', href: 'https://dash.cloudflare.com/profile/api-tokens' }],
  },
  {
    id: 'cloudflare-analytics',
    title: 'Cloudflare usage: a read-only Analytics token',
    why: 'Shows Workers requests and CPU time this month and Workers AI neurons today against what the plan includes, and raises a chip on the Overview before anything would be billed.',
    powers: [{ label: 'Cloudflare usage', href: '/cloudflare' }],
    check: 'env',
    vars: [{ name: 'CF_ANALYTICS_TOKEN', where: 'Worker secret (locally: `pass-env run -- npm run dev`, entry `n8builds-admin/CF_ANALYTICS_TOKEN`)' }],
    steps: [
      'In Cloudflare, Manage account, Account API tokens (or My Profile, API Tokens), Create Token, Create Custom Token.',
      'Name `n8builds-admin analytics read`; permissions: Account, Account Analytics, Read, and nothing else; account resources: the owner\'s account only; an expiry date is fine (add a reminder).',
      'Account Analytics Read covers both datasets the page reads, `workersInvocationsAdaptive` (Workers) and `aiInferenceAdaptiveGroups` (Workers AI); if the Workers AI part says it needs a permission, add Account, Workers AI, Read to the same token.',
      'Store it with `pass-env set n8builds-admin/CF_ANALYTICS_TOKEN`, then set it on the Worker with `pass-env pipe n8builds-admin/CF_ANALYTICS_TOKEN -- npx wrangler secret put CF_ANALYTICS_TOKEN`.',
      'The page reads it at most every 10 minutes; the included amounts it compares against are in `lib/cloudflare-usage.ts`.',
    ],
    links: [
      { label: 'Account API tokens', href: 'https://dash.cloudflare.com/?to=/:account/api-tokens' },
      { label: 'Workers usage in Cloudflare', href: 'https://dash.cloudflare.com/b2c564cf83cb9184dd6d7cc4ff8b38bf/workers-and-pages' },
    ],
  },
  {
    id: 'hosting',
    title: 'Hosting: the Cloudflare Worker and admin.n8builds.dev',
    why: 'Puts the dashboard online at admin.n8builds.dev, behind GitHub sign-in.',
    powers: [],
    check: 'deployed',
    vars: [],
    steps: [
      'The dashboard runs as the `n8builds-admin` Cloudflare Worker (DEPLOY.md), at `https://n8builds-admin.nathancwatkins23.workers.dev` until the domain moves.',
      'Before the first deploy, set every secret on this page with `npx wrangler secret put <NAME>`.',
      'Never set `ADMIN_DEV_BYPASS` or `ADMIN_TEST_AUTH` on the Worker; production builds compile both out, the build fails if either survives, and `APP_ENV=production` switches them off again at runtime.',
      'Add `CLOUDFLARE_API_TOKEN` (a custom token with Workers Scripts, D1 and Workers R2 Storage Edit on the owner\'s account only, DEPLOY.md) as a secret of the repo\'s `production` environment, so every push to `main` deploys.',
      'To move the domain, delete the `admin` CNAME to Vercel in Cloudflare DNS, then add `admin.n8builds.dev` as a custom domain of the Worker.',
      'Open `https://admin.n8builds.dev`, sign in with GitHub, and check that this page shows everything connected.',
      'Optional check: sign in with any other GitHub account and see "This dashboard is private to its owner".',
    ],
    links: [
      { label: 'Workers and Pages', href: 'https://dash.cloudflare.com/b2c564cf83cb9184dd6d7cc4ff8b38bf/workers-and-pages' },
      { label: 'n8builds.dev DNS', href: 'https://dash.cloudflare.com/b2c564cf83cb9184dd6d7cc4ff8b38bf/n8builds.dev/dns/records' },
    ],
  },
  {
    id: 'ai-bots',
    title: 'AI crawlers: Cloudflare AI Crawl Control',
    why: 'Shows AI crawler traffic to n8builds.dev in Cloudflare without blocking it or adding a counter of our own.',
    powers: [{ label: 'Website traffic', href: '/traffic' }],
    check: 'manual',
    vars: [],
    steps: [
      'It counts requests that pass through Cloudflare\'s proxy, so it fills in once n8builds.dev is served by its Worker (or its DNS record is proxied).',
      'In Cloudflare, open the n8builds.dev zone, AI Crawl Control, and leave each crawler on Allow, so they are logged and not blocked.',
      'The portfolio (portfolio.n8builds.dev) is in the same zone, so its crawlers show up there too.',
    ],
    links: [{ label: 'AI Crawl Control', href: 'https://dash.cloudflare.com/b2c564cf83cb9184dd6d7cc4ff8b38bf/n8builds.dev/ai' }],
  },
]

export const LOCAL_ONLY_VARS: SetupVar[] = [
  { name: 'ADMIN_DEV_BYPASS', where: '`.env.local` only, value `1`, for the local preview before sign-in is set up' },
]
