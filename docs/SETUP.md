<!-- Generated from lib/setup.ts by `npm run setup:docs`. Edit lib/setup.ts, not this file. -->

# Setup: the owner's checklist

Everything here is an account resource only the owner can create.
The code is ready for each one: a page switches from "Not connected yet" to live data as soon as its variables exist.
Secrets go straight into Vercel (Project, Settings, Environment Variables) or your local `.env.local`.
Never paste a secret, token or key into a chat, an issue, a commit or a doc.
Agents only ever need the variable names, never the values.
The dashboard's Setup page shows the same list with each item's live status.

## 1. Sign-in: a GitHub OAuth App

Lets you sign in with GitHub; only your account (user ID 8055935) gets in.

1. Open GitHub, Settings, Developer settings, OAuth Apps, New OAuth App.
2. Name `n8builds admin`, homepage `https://admin.n8builds.dev`, redirect URI `https://admin.n8builds.dev/api/auth/callback`; wildcard matching and Device Flow off; "Expire user access tokens" can stay on.
3. Register it, click "Generate a new client secret", and put the Client ID and secret in Vercel as `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.
4. Optional, for real GitHub sign-in on your machine: add a second redirect URI `http://localhost:3831/api/auth/callback` to the same app and put the same two values in `.env.local`. Without it, the local preview runs on `ADMIN_DEV_BYPASS`.
5. Make a session secret with `openssl rand -base64 48` and set it as `ADMIN_SESSION_SECRET` (a different value in Vercel and in `.env.local`).
6. No scopes are requested: the app only learns which account signed in, and the dashboard revokes that token straight away.
7. Rotating `ADMIN_SESSION_SECRET` signs every session out.

Where: [GitHub OAuth Apps](https://github.com/settings/developers), [New OAuth App](https://github.com/settings/applications/new).
Sets: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `ADMIN_SESSION_SECRET`.

## 2. GitHub data: fine-grained tokens

Reads CI runs, Actions minutes, stars, repo traffic, releases, deploys and Dependabot alerts.

1. A fine-grained token covers one resource owner, so the personal repos and the Appturnity org each get their own token.
2. Open GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token.
3. Token one: name `n8builds-admin read`, resource owner `n8watkins`, expiration 1 year (add a calendar reminder to renew it; the current one, made 2026-10-27, expires 2027-10-27).
4. Repository access: "Only select repositories": n8builds-web, dev-portfolio, portfolio-rank, open-ping, scribe, solara, voicedock (was piper-tts), tl-dw, tube-vault and n8builds-admin.
5. Repository permissions, all read-only: Actions, Administration (for views and clones), Contents, Deployments, Dependabot alerts, and Metadata (added automatically).
6. Account permissions: Plan, read-only (for the personal Actions minutes report).
7. Set it as `GITHUB_TOKEN`.
8. Token two: name `n8builds-admin billing`, resource owner `Appturnity` (the org must allow fine-grained tokens: Appturnity, Settings, Personal access tokens).
9. Repository access: "Public repositories"; organization permissions: Administration, read-only (the org billing report).
10. Set it as `GITHUB_ORG_TOKEN`.
11. If GitHub refuses the org billing report with the fine-grained token, a classic token with only `read:org` works for it instead.
12. While you are there, turn on Dependabot alerts in each repo's Settings, Code security (the Security alerts page lists the repos that have them off).

Where: [New fine-grained token](https://github.com/settings/personal-access-tokens/new), [Appturnity token policy](https://github.com/organizations/Appturnity/settings/personal-access-tokens).
Sets: `GITHUB_TOKEN`, `GITHUB_ORG_TOKEN` (optional).

## 3. Website traffic: Google Analytics Data API

Reads visitors, countries, top pages, referrers, time on site and scroll depth from the GA4 property n8builds.dev already uses.

1. One GA4 property (`G-JZQGKY9Q37`) covers all of n8builds.dev, subdomains included, so one property is enough.
2. In Google Cloud Console, create a project (or reuse one) named `n8builds-admin`.
3. APIs and Services, Library: enable "Google Analytics Data API".
4. IAM and Admin, Service accounts, Create service account: name `n8builds-admin-ga`, no project roles.
5. Open it, Keys, Add key, Create new key, JSON, and download it.
6. In Google Analytics, Admin, Property access management, add the service account's email as a Viewer.
7. Copy the numeric Property ID from Admin, Property details (a number, not the `G-` measurement ID) and set it as `GA4_PROPERTY_ID`.
8. From the JSON file, set `client_email` as `GOOGLE_SA_CLIENT_EMAIL` and `private_key` as `GOOGLE_SA_PRIVATE_KEY` (paste it as it is, `\n` sequences included).
9. Delete the downloaded JSON file once both values are in Vercel.

Where: [Enable the Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com), [Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts), [Google Analytics admin](https://analytics.google.com/analytics/web/#/admin).
Sets: `GA4_PROPERTY_ID`, `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`.

## 4. Errors: Sentry read-only token

Reads unresolved and new issues and error volume for the sites Sentry already watches. With its DSN set, this dashboard reports its own server errors and the daily snapshot's check-ins too.

1. In Sentry, User settings, Personal Tokens (User Auth Tokens), Create New Token.
2. Scopes: only `org:read`, `project:read` and `event:read`; leave everything else at "No access".
3. Set it as `SENTRY_AUTH_TOKEN`.
4. Set your org slug (from the Sentry URL) as `SENTRY_ORG`.
5. Set the project slugs to watch, comma-separated (`n8builds,portfolio,n8builds-admin`), as `SENTRY_PROJECTS`.
6. Only if your org lives in Sentry's EU region, also set `SENTRY_API_BASE` to `https://de.sentry.io`.
7. For this dashboard's own errors: in the `n8builds-admin` Sentry project, Settings, Client Keys (DSN), copy the DSN and set it as `SENTRY_DSN`. A missed or failed daily snapshot then emails you (cron monitor `admin-daily-snapshot`).

Where: [Sentry auth tokens](https://sentry.io/settings/account/api/auth-tokens/).
Sets: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECTS`, `SENTRY_API_BASE` (optional), `SENTRY_DSN` (optional).

## 5. Counters and trends: a second Upstash database

Stores the daily snapshot (stars and minutes trends), the Appturnity referral and contact message counts, and the dino game stats. Set the two database variables on the n8builds-web project as well: it writes the counts.

1. Keep it separate from the contact form's database, so counters can never use up the form's quota and switch it off.
2. In Upstash, Create Database: name `n8builds-analytics`, type Redis, plan Free, region close to Vercel's (US East).
3. Copy the REST URL and REST token and set them as `ANALYTICS_REDIS_REST_URL` and `ANALYTICS_REDIS_REST_TOKEN`.
4. Make a cron secret with `openssl rand -hex 32` and set it as `CRON_SECRET`.
5. The daily snapshot (`/api/cron/snapshot`, 06:15 UTC, in `vercel.json`) starts on the first deploy, and trends fill in from the next day.
6. The referral and contact counters also need a small change in n8builds-web (an agent task, not yet done), using the same two Upstash variables there.

Where: [Upstash console](https://console.upstash.com/redis).
Sets: `ANALYTICS_REDIS_REST_URL`, `ANALYTICS_REDIS_REST_TOKEN`, `CRON_SECRET`.

## 6. Hosting: Vercel project and admin.n8builds.dev

Puts the dashboard online at admin.n8builds.dev, behind GitHub sign-in.

1. Create a private GitHub repo `n8watkins/n8builds-admin` and push this local repo's `main` to it.
2. In Vercel (team natkins23s-projects), Add New, Project, import `n8builds-admin`; the Next.js preset and defaults are right.
3. Before the first deploy, add every variable on this page to the Production environment.
4. Never set `ADMIN_DEV_BYPASS` in Vercel; production builds ignore it, and the build fails if the bypass is ever compiled in.
5. Settings, Domains: add `admin.n8builds.dev`, then add the CNAME record Vercel shows wherever n8builds.dev's DNS lives ("DNS only" if that is Cloudflare).
6. Open `https://admin.n8builds.dev`, sign in with GitHub, and check that this page shows everything connected.
7. Optional check: sign in with any other GitHub account and see "This dashboard is private to its owner".

Where: [New Vercel project](https://vercel.com/new), [New GitHub repo](https://github.com/new).

## 7. AI crawlers: Vercel AI Bots ruleset in Log mode

Shows AI crawler traffic in Vercel's Firewall without blocking it or adding a counter of our own.

1. In Vercel, open the n8builds-web project, Firewall.
2. Under Bot Management (managed rulesets), turn on "AI Bots" and set its action to Log, not Deny.
3. Repeat for the portfolio project if you want its crawlers logged too.

Where: [n8builds-web Firewall](https://vercel.com/natkins23s-projects/n8builds-web/firewall).

## Environment variables

| Variable | Step | Where |
| --- | --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | 1 | Vercel (and `.env.local` for real sign-in locally) |
| `GITHUB_OAUTH_CLIENT_SECRET` | 1 | Vercel (and `.env.local` for real sign-in locally) |
| `ADMIN_SESSION_SECRET` | 1 | Vercel and `.env.local` (different values) |
| `GITHUB_TOKEN` | 2 | Vercel (locally: `GITHUB_TOKEN=$(gh auth token)` when starting the server) |
| `GITHUB_ORG_TOKEN` (optional) | 2 | Vercel (optional locally: the gh token reads the org) |
| `GA4_PROPERTY_ID` | 3 | Vercel |
| `GOOGLE_SA_CLIENT_EMAIL` | 3 | Vercel |
| `GOOGLE_SA_PRIVATE_KEY` | 3 | Vercel |
| `SENTRY_AUTH_TOKEN` | 4 | Vercel |
| `SENTRY_ORG` | 4 | Vercel |
| `SENTRY_PROJECTS` | 4 | Vercel |
| `SENTRY_API_BASE` (optional) | 4 | Vercel, only for Sentry's EU region |
| `SENTRY_DSN` (optional) | 4 | Vercel |
| `ANALYTICS_REDIS_REST_URL` | 5 | Vercel |
| `ANALYTICS_REDIS_REST_TOKEN` | 5 | Vercel |
| `CRON_SECRET` | 5 | Vercel |
| `ADMIN_DEV_BYPASS` | - | `.env.local` only, value `1`, for the local preview before sign-in is set up |
