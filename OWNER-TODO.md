# Owner to-do

Things only the owner can do for the admin dashboard: tokens and accounts.
Agents keep this list current; tick an item by changing `[ ]` to `[x]` and adding the date.
No secrets go in this file: keys live in pass-env (entries `n8builds-admin/<NAME>`) and in the Cloudflare Worker (and Vercel, until that project is deleted), and this file names only the entries.
The cross-project list of keys to rotate is `SECURITY-TODO.md` in the private [secret-handling-review](https://github.com/n8watkins/secret-handling-review/blob/main/SECURITY-TODO.md) repo.
How each account resource is set up: [docs/SETUP.md](docs/SETUP.md) (generated from `lib/setup.ts`), and its live status on the dashboard's Setup page.

Last checked: 2026-11-03.
Done 2026-10-28: the first sign-in, the Sentry token, the analytics Upstash database and `GITHUB_ORG_TOKEN`.

## 0. Finish the move to Cloudflare Workers (2026-11-03)

- [ ] Set the Worker's secrets.
- [ ] Add the `CLOUDFLARE_API_TOKEN` repository secret.
- [ ] Move admin.n8builds.dev to the Worker, then retire the Vercel project.

**What.**
The dashboard is deployed as the `n8builds-admin` Worker (DEPLOY.md), but it has only the two secrets an agent could generate (`ADMIN_SESSION_SECRET`, `CRON_SECRET`).
Vercel hides its values, so the rest come from pass-env or their source accounts: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_TOKEN`, `GITHUB_ORG_TOKEN` (both best set straight from section 1's rotation), `GA4_PROPERTY_ID`, `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECTS`, `SENTRY_DSN`, and the new `CLOUDFLARE_DEPLOYS_TOKEN` (docs/SETUP.md section 6).

**Steps.**

1. For each name above, from the repo folder: `pass-env pipe n8builds-admin/<NAME> -- npx wrangler secret put <NAME>`.
2. Create a Cloudflare API token from the "Edit Cloudflare Workers" template and add it as the `CLOUDFLARE_API_TOKEN` Actions secret, so pushes to `main` deploy.
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
4. A secret change goes live on its own (no redeploy); check that the CI, Actions minutes and Security panels load.
5. Tell Claude the new expiry dates, so the handoff and the reminder notes move to them.

**Why.**
Both tokens appeared in agent logs (2026-10-27 to 2026-10-29) and still work, so they count as exposed.
Rotating now also resets their expiry; otherwise they stop working on 2027-10-27 (`GITHUB_TOKEN`) and 2027-10-28 (`GITHUB_ORG_TOKEN`) and the GitHub panels go blank.

**Unblocks.**
Closes two entries in SECURITY-TODO.md and keeps the GitHub data on the dashboard working for another year.
