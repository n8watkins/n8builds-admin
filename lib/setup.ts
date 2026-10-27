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
   * `deployed` (running on Vercel production) or `manual` (only visible in
   * another dashboard, so the page can only say what to check).
   */
  check: 'env' | 'deployed' | 'manual'
  vars: SetupVar[]
  steps: string[]
}

export const SETUP_INTRO = [
  'Everything here is an account resource only the owner can create.',
  'The code is ready for each one: a page switches from "Not connected yet" to live data as soon as its variables exist.',
  'Secrets go straight into Vercel (Project, Settings, Environment Variables) or your local `.env.local`.',
  'Never paste a secret, token or key into a chat, an issue, a commit or a doc.',
  'Agents only ever need the variable names, never the values.',
]

export const SETUP_ITEMS: SetupItem[] = [
  {
    id: 'sign-in',
    title: 'Sign-in: GitHub OAuth Apps',
    why: 'Lets you sign in with GitHub; only your account (user ID 8055935) gets in.',
    powers: [{ label: 'Sign-in', href: '/login' }],
    check: 'env',
    vars: [
      { name: 'GITHUB_OAUTH_CLIENT_ID', where: 'Vercel and `.env.local` (different apps)' },
      { name: 'GITHUB_OAUTH_CLIENT_SECRET', where: 'Vercel and `.env.local` (different apps)' },
      { name: 'ADMIN_SESSION_SECRET', where: 'Vercel and `.env.local` (different values)' },
    ],
    steps: [
      'GitHub OAuth Apps take exactly one callback URL, so make two apps: one for production and one for local use.',
      'Open GitHub, Settings, Developer settings, OAuth Apps, New OAuth App.',
      'Production app: name `n8builds admin`, homepage `https://admin.n8builds.dev`, callback URL `https://admin.n8builds.dev/api/auth/callback`, Device Flow off.',
      'Register it, click "Generate a new client secret", and put the Client ID and secret in Vercel as `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.',
      'Local app: name `n8builds admin (local)`, homepage `http://localhost:3831`, callback URL `http://localhost:3831/api/auth/callback`.',
      'Put the local app\'s Client ID and secret in `.env.local` under the same two names.',
      'Make a session secret with `openssl rand -base64 48` and set it as `ADMIN_SESSION_SECRET` (a different value in Vercel and in `.env.local`).',
      'No scopes are requested: the app only learns which account signed in, and the dashboard revokes that token straight away.',
      'Rotating `ADMIN_SESSION_SECRET` signs every session out.',
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
      { name: 'GITHUB_TOKEN', where: 'Vercel (locally: `GITHUB_TOKEN=$(gh auth token)` when starting the server)' },
      { name: 'GITHUB_ORG_TOKEN', where: 'Vercel (optional locally: the gh token reads the org)', optional: true },
    ],
    steps: [
      'A fine-grained token covers one resource owner, so the personal repos and the Appturnity org each get their own token.',
      'Open GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token.',
      'Token one: name `n8builds-admin read`, resource owner `n8watkins`, expiration 1 year (add a calendar reminder to renew it).',
      'Repository access: "Only select repositories": n8builds-web, dev-portfolio, portfolio-rank, open-ping, scribe, solara, piper-tts, tl-dw and tube-vault.',
      'Repository permissions, all read-only: Actions, Administration (for views and clones), Contents, Deployments, Dependabot alerts, and Metadata (added automatically).',
      'Account permissions: Plan, read-only (for the personal Actions minutes report).',
      'Set it as `GITHUB_TOKEN`.',
      'Token two: name `n8builds-admin billing`, resource owner `Appturnity` (the org must allow fine-grained tokens: Appturnity, Settings, Personal access tokens).',
      'Repository access: "Public repositories"; organization permissions: Administration, read-only (the org billing report).',
      'Set it as `GITHUB_ORG_TOKEN`.',
      'If GitHub refuses the org billing report with the fine-grained token, a classic token with only `read:org` works for it instead.',
      'While you are there, turn on Dependabot alerts in each repo\'s Settings, Code security (the Security alerts page lists the repos that have them off).',
    ],
  },
  {
    id: 'ga4',
    title: 'Website traffic: Google Analytics Data API',
    why: 'Reads visitors, countries, top pages, referrers, time on site and scroll depth from the GA4 property n8builds.dev already uses.',
    powers: [{ label: 'Website traffic', href: '/traffic' }],
    check: 'env',
    vars: [
      { name: 'GA4_PROPERTY_ID', where: 'Vercel' },
      { name: 'GOOGLE_SA_CLIENT_EMAIL', where: 'Vercel' },
      { name: 'GOOGLE_SA_PRIVATE_KEY', where: 'Vercel' },
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
      'Delete the downloaded JSON file once both values are in Vercel.',
    ],
  },
  {
    id: 'sentry',
    title: 'Errors: Sentry read-only token',
    why: 'Reads unresolved and new issues and error volume for the sites Sentry already watches.',
    powers: [{ label: 'Errors', href: '/errors' }],
    check: 'env',
    vars: [
      { name: 'SENTRY_AUTH_TOKEN', where: 'Vercel' },
      { name: 'SENTRY_ORG', where: 'Vercel' },
      { name: 'SENTRY_PROJECTS', where: 'Vercel' },
      { name: 'SENTRY_API_BASE', where: 'Vercel, only for Sentry\'s EU region', optional: true },
    ],
    steps: [
      'In Sentry, User settings, Personal Tokens (User Auth Tokens), Create New Token.',
      'Scopes: only `org:read`, `project:read` and `event:read`; leave everything else at "No access".',
      'Set it as `SENTRY_AUTH_TOKEN`.',
      'Set your org slug (from the Sentry URL) as `SENTRY_ORG`.',
      'Set the project slugs to watch, comma-separated (the n8builds-web and portfolio projects), as `SENTRY_PROJECTS`.',
      'Only if your org lives in Sentry\'s EU region, also set `SENTRY_API_BASE` to `https://de.sentry.io`.',
    ],
  },
  {
    id: 'upstash',
    title: 'Counters and trends: a second Upstash database',
    why: 'Stores the daily snapshot (stars and minutes trends) and the Appturnity referral and contact message counts.',
    powers: [
      { label: 'Stars trend', href: '/repos' },
      { label: 'Referrals', href: '/referrals' },
      { label: 'Contact messages', href: '/contact' },
    ],
    check: 'env',
    vars: [
      { name: 'ANALYTICS_REDIS_REST_URL', where: 'Vercel' },
      { name: 'ANALYTICS_REDIS_REST_TOKEN', where: 'Vercel' },
      { name: 'CRON_SECRET', where: 'Vercel' },
    ],
    steps: [
      'Keep it separate from the contact form\'s database, so counters can never use up the form\'s quota and switch it off.',
      'In Upstash, Create Database: name `n8builds-analytics`, type Redis, plan Free, region close to Vercel\'s (US East).',
      'Copy the REST URL and REST token and set them as `ANALYTICS_REDIS_REST_URL` and `ANALYTICS_REDIS_REST_TOKEN`.',
      'Make a cron secret with `openssl rand -hex 32` and set it as `CRON_SECRET`.',
      'The daily snapshot (`/api/cron/snapshot`, 06:15 UTC, in `vercel.json`) starts on the first deploy, and trends fill in from the next day.',
      'The referral and contact counters also need a small change in n8builds-web (an agent task, not yet done), using the same two Upstash variables there.',
    ],
  },
  {
    id: 'vercel',
    title: 'Hosting: Vercel project and admin.n8builds.dev',
    why: 'Puts the dashboard online at admin.n8builds.dev, behind GitHub sign-in.',
    powers: [],
    check: 'deployed',
    vars: [],
    steps: [
      'Create a private GitHub repo `n8watkins/n8builds-admin` and push this local repo\'s `main` to it.',
      'In Vercel (team natkins23s-projects), Add New, Project, import `n8builds-admin`; the Next.js preset and defaults are right.',
      'Before the first deploy, add every variable on this page to the Production environment.',
      'Never set `ADMIN_DEV_BYPASS` in Vercel; production builds ignore it, and the build fails if the bypass is ever compiled in.',
      'Settings, Domains: add `admin.n8builds.dev`, then add the CNAME record Vercel shows wherever n8builds.dev\'s DNS lives ("DNS only" if that is Cloudflare).',
      'Open `https://admin.n8builds.dev`, sign in with GitHub, and check that this page shows everything connected.',
      'Optional check: sign in with any other GitHub account and see "This dashboard is private to its owner".',
    ],
  },
  {
    id: 'ai-bots',
    title: 'AI crawlers: Vercel AI Bots ruleset in Log mode',
    why: 'Shows AI crawler traffic in Vercel\'s Firewall without blocking it or adding a counter of our own.',
    powers: [{ label: 'Website traffic', href: '/traffic' }],
    check: 'manual',
    vars: [],
    steps: [
      'In Vercel, open the n8builds-web project, Firewall.',
      'Under Bot Management (managed rulesets), turn on "AI Bots" and set its action to Log, not Deny.',
      'Repeat for the portfolio project if you want its crawlers logged too.',
    ],
  },
]

export const LOCAL_ONLY_VARS: SetupVar[] = [
  { name: 'ADMIN_DEV_BYPASS', where: '`.env.local` only, value `1`, for the local preview before sign-in is set up' },
]
