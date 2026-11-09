# Owner to-do

Things only the owner can do for the admin dashboard: tokens and accounts.
Agents keep this list current; tick an item by changing `[ ]` to `[x]` and adding the date.
No secrets go in this file: keys live in pass-env (entries `n8builds-admin/<NAME>`) and in the Cloudflare Worker (and Vercel, until that project is deleted), and this file names only the entries.
The cross-project list of keys to rotate is kept in the owner's private key backlog, outside this repo.
How each account resource is set up: [docs/SETUP.md](docs/SETUP.md) (generated from `lib/setup.ts`), and its live status on the dashboard's Setup page.

Last checked: 2026-11-09.
Done 2026-10-28: the first sign-in, the Sentry token, the analytics Upstash database and `GITHUB_ORG_TOKEN`.

## 0. Finish the move to Cloudflare Workers (2026-11-03)

- [ ] Set the Worker's secrets.
- [x] Add the `CLOUDFLARE_API_TOKEN` repository secret (done; deploys run since 2026-11-08). Section 2 replaces it with a narrower token.
- [ ] Move admin.n8builds.dev to the Worker, then retire the Vercel project.

**What.**
The dashboard is deployed as the `n8builds-admin` Worker (DEPLOY.md), but it has only the two secrets an agent could generate (`ADMIN_SESSION_SECRET`, `CRON_SECRET`).
Vercel hides its values, so the rest come from pass-env or their source accounts: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_TOKEN`, `GITHUB_ORG_TOKEN` (both best set straight from section 1's rotation), `GA4_PROPERTY_ID`, `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECTS`, `SENTRY_DSN`, and the new `CLOUDFLARE_DEPLOYS_TOKEN` (docs/SETUP.md section 6).

**Steps.**

1. For each name above, from the repo folder: `pass-env pipe n8builds-admin/<NAME> -- npx wrangler secret put <NAME>`.
2. The deploy token: see section 2.
3. Move the domain as DEPLOY.md describes (sign-in works on the Worker only at admin.n8builds.dev, the OAuth App's callback).

**Why.**
Until then the Worker shows "Sign-in isn't set up yet", and Vercel stays the live dashboard.

## 1. Rotate both GitHub tokens now (and yearly after that)

- [ ] `GITHUB_TOKEN` (`n8builds-admin read`) regenerated and replaced.
- [ ] `GITHUB_ORG_TOKEN` (`n8builds-admin billing`) regenerated and replaced.

**What.**
Regenerate the two fine-grained tokens and put them on the Cloudflare Worker (the Worker doesn't have them yet; step 2 sets them there for the first time).

**Steps.**

1. GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens: open `n8builds-admin read` and choose **Regenerate token**, with a 1-year expiry and the same access (listed in [docs/SETUP.md](docs/SETUP.md) section 2).
   Before saving, check two settings: **Account permissions, Plan: Read-only** (the Actions minutes page shows nothing without it; the current token was made before this was added), and **Repository access**: keep the selected repos, or choose All repositories if you want the planned Projects page to cover every repo.
   Never paste the new token into a chat with an agent: step 2 puts it in `pass` and pipes it straight into the Worker.
2. In your own terminal, from the repo folder:

   ```sh
   pass-env set n8builds-admin/GITHUB_TOKEN
   pass-env pipe n8builds-admin/GITHUB_TOKEN -- npx wrangler secret put GITHUB_TOKEN
   ```

3. Do the same for `n8builds-admin billing` (resource owner Appturnity) with the entry `n8builds-admin/GITHUB_ORG_TOKEN` and the variable `GITHUB_ORG_TOKEN`.
4. While Vercel still serves admin.n8builds.dev, regenerating blanks its GitHub panels until it gets the new values too.
   Either skip this (the Worker cutover in section 0 retires Vercel), or from the repo folder:

   ```sh
   pass-env pipe n8builds-admin/GITHUB_TOKEN -- vercel env add GITHUB_TOKEN production --force
   pass-env pipe n8builds-admin/GITHUB_ORG_TOKEN -- vercel env add GITHUB_ORG_TOKEN production --force
   ```

   then Vercel, the project, Deployments, the latest production one, Redeploy (Vercel applies env changes only on a new deploy).
5. A Worker secret change goes live on its own (no redeploy); check that the CI, Actions minutes and Security panels load.
6. Tell Claude the new expiry dates, so the handoff and the reminder notes move to them.

**Why.**
Both tokens appeared in agent logs (2026-10-27 to 2026-10-29), so they count as exposed until they are regenerated (regenerating revokes the old value at once).
This must be done before the repo goes public (section 3).
Rotating now also resets their expiry; otherwise they stop working on 2027-10-27 (`GITHUB_TOKEN`) and 2027-10-28 (`GITHUB_ORG_TOKEN`) and the GitHub panels go blank.

**Unblocks.**
Closes two entries in the private key backlog, unblocks going public, and keeps the GitHub data on the dashboard working for another year.

## 2. Narrow the deploy token

- [ ] A custom Cloudflare token in the `production` environment, the old template token deleted.

**What.**
`deploy.yml` now takes `CLOUDFLARE_API_TOKEN` from the repo's `production` environment (deployment branches: `main` only) and gives it only to the migrate and deploy steps.
The current repository secret came from the "Edit Cloudflare Workers" template, which reaches far more than this Worker.

**Steps.**

1. Cloudflare dashboard, My Profile, API Tokens, Create Token, Create Custom Token. Name `n8builds-admin deploy`.
   Permissions: Account, Workers Scripts, Edit; Account, D1, Edit; Account, Workers R2 Storage, Edit. Account resources: Include, the owner's account only. No zone permissions for now (DEPLOY.md says when to add Workers Routes).
2. In your own terminal, from the repo folder:

   ```sh
   pass-env set n8builds-admin/CLOUDFLARE_API_TOKEN
   pass-env pipe n8builds-admin/CLOUDFLARE_API_TOKEN -- gh secret set CLOUDFLARE_API_TOKEN --env production --repo n8watkins/n8builds-admin
   ```

3. Remove the old one: `gh secret delete CLOUDFLARE_API_TOKEN --repo n8watkins/n8builds-admin`, then delete the old template token in Cloudflare, API Tokens.
4. The next push to `main` (or Actions, Deploy, Run workflow) checks it.

## 3. Before the repo goes public

The 2026-11-09 audit (https://claude.ai/artifact/G3uSFHiNot2a88hDGuRfwZ) found no secret in the history; these are what's left.

- [ ] Section 1 done: both GitHub tokens regenerated.
- [ ] Section 2 done (recommended first, not blocking).
- [ ] License chosen (the agent can add it).
- [ ] Flip it: `gh repo edit n8watkins/n8builds-admin --visibility public --accept-visibility-change-consequences`.
- [ ] Right after, settings that only exist for public repos (an agent can do these with `gh` once it's public): a `main` ruleset (pull request required, required check "CI result", no force pushes or deletion); Settings, Actions, fork pull request workflows: require approval for all external contributors; allow auto-merge; secret scanning with push protection; private vulnerability reporting; and `npx release-kit apply .` so the kit switches to its public-repo defaults.

## Keys

Checked 2026-11-09 against the secret names on the Worker and in GitHub Actions (names only, no values).
New values go into the owner's pass-env store and are sent with `pass-env pipe <entry> -- <command>`; never commit or paste a value.

- [ ] `GITHUB_TOKEN` ("n8builds-admin read") and `GITHUB_ORG_TOKEN` ("n8builds-admin billing"): appeared in chats Oct 27 to 29. Regenerate both (section 1), set them on the Worker (neither is there yet) and on Vercel while it serves the domain.
- [ ] `GITHUB_OAUTH_CLIENT_SECRET`, `CLOUDFLARE_DEPLOYS_TOKEN`, `GOOGLE_SA_PRIVATE_KEY` (missing): the code reads them; the Worker lacks them (admin cutover).
- [x] `ANALYTICS_REDIS_REST_TOKEN`: nothing in the code reads it any more (checked 2026-11-09); its Vercel variable goes with the Vercel project.
- [ ] `CLOUDFLARE_API_TOKEN` (GitHub Actions): move to the `production` environment as a narrower token (section 2).
- [x] `ADMIN_SESSION_SECRET`, `CRON_SECRET`: set on the Worker.
