# Setup: the owner's checklist

Everything here is an account resource only the owner can create.
The code is ready for each one: a panel switches from "Not connected yet" to live data as soon as its variables exist.

**Secrets go straight into Vercel (Project, Settings, Environment Variables) or your local `.env.local`.**
**Never paste a secret, token or key into a chat, an issue, a commit or a doc.**
Agents only ever need the variable names, never the values.

Each step says which variables it produces.
The full list is at the end.

## 1. Sign-in: GitHub OAuth Apps

GitHub OAuth Apps take exactly one callback URL, so make two apps: one for production and one for local use.

1. Open GitHub, Settings, Developer settings, OAuth Apps, New OAuth App.
2. Production app: name `n8builds admin`, homepage `https://admin.n8builds.dev`, callback URL `https://admin.n8builds.dev/api/auth/callback`.
3. Leave "Enable Device Flow" off.
4. Register it, then click "Generate a new client secret".
5. Put the Client ID in Vercel as `GITHUB_OAUTH_CLIENT_ID` and the secret as `GITHUB_OAUTH_CLIENT_SECRET` (Production environment).
6. Local app: name `n8builds admin (local)`, homepage `http://localhost:3831`, callback URL `http://localhost:3831/api/auth/callback`.
7. Put the local app's Client ID and secret in `.env.local` under the same two names.
8. Make a session secret with `openssl rand -base64 48` and set it as `ADMIN_SESSION_SECRET` (a different value in Vercel and in `.env.local`).
9. No scopes are requested: the app only learns which account signed in, and the dashboard revokes that token straight away.

Only GitHub user ID 8055935 (n8watkins) is admitted; the ID is in the code (`lib/auth/config.ts`), not in a variable.
Rotating `ADMIN_SESSION_SECRET` signs every session out.

## 2. GitHub data: fine-grained tokens

A fine-grained token covers one resource owner, so the personal repos and the Appturnity org each get their own token.

1. Open GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token.
2. Token one: name `n8builds-admin read`, resource owner `n8watkins`, expiration 1 year (add a calendar reminder to renew it).
3. Repository access: "Only select repositories", and pick n8builds-web, dev-portfolio, portfolio-rank, open-ping, scribe, solara, piper-tts, tl-dw and tube-vault.
4. Repository permissions, all read-only: Actions, Administration (needed for views and clones), Contents, Deployments, Dependabot alerts, and Metadata (added automatically).
5. Account permissions: Plan, read-only (needed for the personal Actions minutes report).
6. Set it as `GITHUB_TOKEN`.
7. Token two: name `n8builds-admin billing`, resource owner `Appturnity` (the org must allow fine-grained tokens: Appturnity, Settings, Personal access tokens).
8. Repository access: none needed ("Public repositories" is fine); organization permissions: Administration, read-only (the org billing usage report).
9. Set it as `GITHUB_ORG_TOKEN`.
10. If GitHub refuses the org billing report with the fine-grained token, a classic token with only `read:org` works for it instead (that is what the local preview uses today, through the gh CLI).
11. While you are in the repos: Dependabot alerts are turned off for most of them (the Security alerts card lists which); turn them on in each repo's Settings, Code security.

## 3. Traffic: Google Analytics Data API

One GA4 property (`G-JZQGKY9Q37`) covers all of n8builds.dev, subdomains included, so one property is enough.

1. In Google Cloud Console, create a project (or reuse one) named `n8builds-admin`.
2. APIs and Services, Library: enable "Google Analytics Data API".
3. IAM and Admin, Service accounts, Create service account: name `n8builds-admin-ga`, no project roles.
4. Open it, Keys, Add key, Create new key, JSON, and download it.
5. In Google Analytics, Admin, Property access management, add the service account's email as a Viewer.
6. Copy the numeric Property ID from Admin, Property details (a number, not the `G-` measurement ID) and set it as `GA4_PROPERTY_ID`.
7. From the JSON file, set `client_email` as `GOOGLE_SA_CLIENT_EMAIL` and `private_key` as `GOOGLE_SA_PRIVATE_KEY` (paste it as it is, `\n` sequences included).
8. Delete the downloaded JSON file once both values are in Vercel.
9. If you later want Appturnity's own property too, repeat step 5 on that property and tell the agent its ID (not a secret).

## 4. Errors: Sentry read-only token

1. In Sentry, User settings, Personal Tokens (User Auth Tokens), Create New Token.
2. Scopes: only `org:read`, `project:read` and `event:read`; leave everything else at "No access".
3. Set it as `SENTRY_AUTH_TOKEN`.
4. Set your org slug (from the Sentry URL) as `SENTRY_ORG`.
5. Set the project slugs to watch, comma-separated (for example the n8builds-web and portfolio projects), as `SENTRY_PROJECTS`.
6. Only if your org lives in Sentry's EU region, also set `SENTRY_API_BASE` to `https://de.sentry.io`.

## 5. Counters and trends: a second Upstash database

Keep it separate from the contact form's database, so counters can never use up the form's quota and switch it off.

1. In Upstash, Create Database: name `n8builds-analytics`, type Redis, plan Free, region close to Vercel's (US East).
2. Copy the REST URL and REST token and set them as `ANALYTICS_REDIS_REST_URL` and `ANALYTICS_REDIS_REST_TOKEN`.
3. Make a cron secret with `openssl rand -hex 32` and set it as `CRON_SECRET`.
4. The daily snapshot (`/api/cron/snapshot`, 06:15 UTC, in `vercel.json`) starts on the first deploy; the trend card fills in from the next day.
5. The referral and contact counters also need a small change in n8builds-web (a separate task, not done yet), which will use the same two Upstash variables there.

## 6. Hosting: Vercel project and admin.n8builds.dev

1. Create a private GitHub repo `n8watkins/n8builds-admin` and push this local repo's `main` to it.
2. In Vercel (team natkins23s-projects), Add New, Project, import `n8builds-admin`; the framework preset is Next.js and the defaults are right.
3. Before the first deploy, add every variable from the table below to the Production environment.
4. Never set `ADMIN_DEV_BYPASS` in Vercel; production builds ignore it anyway, and the build fails if the bypass is ever compiled in.
5. Settings, Domains: add `admin.n8builds.dev`.
6. Add the DNS record Vercel shows (a CNAME for `admin`) wherever n8builds.dev's DNS lives; if that is Cloudflare, keep it "DNS only" (grey cloud).
7. Open `https://admin.n8builds.dev`, sign in with GitHub, and check that each panel shows data.
8. Optional check: sign in with any other GitHub account and see "This dashboard is private to its owner".

## 7. AI crawlers: Vercel's AI Bots ruleset in Log mode

1. In Vercel, open the n8builds-web project, Firewall.
2. Under Bot Management (managed rulesets), turn on "AI Bots" and set its action to Log, not Deny.
3. Repeat for the portfolio project if you want its crawlers logged too.
4. The dashboard's AI crawlers card links straight to that Firewall view.

## Environment variables

| Variable | Step | Where |
| --- | --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | 1 | Vercel and `.env.local` (different apps) |
| `GITHUB_OAUTH_CLIENT_SECRET` | 1 | Vercel and `.env.local` (different apps) |
| `ADMIN_SESSION_SECRET` | 1 | Vercel and `.env.local` (different values) |
| `GITHUB_TOKEN` | 2 | Vercel (locally: `GITHUB_TOKEN=$(gh auth token)` when starting the server) |
| `GITHUB_ORG_TOKEN` | 2 | Vercel (optional locally: the gh token reads the org) |
| `GA4_PROPERTY_ID` | 3 | Vercel |
| `GOOGLE_SA_CLIENT_EMAIL` | 3 | Vercel |
| `GOOGLE_SA_PRIVATE_KEY` | 3 | Vercel |
| `SENTRY_AUTH_TOKEN` | 4 | Vercel |
| `SENTRY_ORG` | 4 | Vercel |
| `SENTRY_PROJECTS` | 4 | Vercel |
| `SENTRY_API_BASE` | 4 | Vercel, only for Sentry's EU region |
| `ANALYTICS_REDIS_REST_URL` | 5 | Vercel |
| `ANALYTICS_REDIS_REST_TOKEN` | 5 | Vercel |
| `CRON_SECRET` | 5 | Vercel |
| `ADMIN_DEV_BYPASS` | - | `.env.local` only, value `1`, for the local preview before step 1 |
