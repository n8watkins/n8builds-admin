# Owner to-do

Things only the owner can do for the admin dashboard: tokens and accounts.
Agents keep this list current; tick an item by changing `[ ]` to `[x]` and adding the date.
No secrets go in this file: keys live in pass-env (entries `n8builds-admin/<NAME>`) and in Vercel, and this file names only the entries.
The cross-project list of keys to rotate is `SECURITY-TODO.md` in the private [secret-handling-review](https://github.com/n8watkins/secret-handling-review/blob/main/SECURITY-TODO.md) repo.
How each account resource is set up: [docs/SETUP.md](docs/SETUP.md) (generated from `lib/setup.ts`), and its live status on the dashboard's Setup page.

Last checked: 2026-11-02.
Done 2026-10-28: the first sign-in, the Sentry token, the analytics Upstash database and `GITHUB_ORG_TOKEN`.

## 1. Rotate both GitHub tokens now (and yearly after that)

- [ ] `GITHUB_TOKEN` (`n8builds-admin read`) regenerated and replaced.
- [ ] `GITHUB_ORG_TOKEN` (`n8builds-admin billing`) regenerated and replaced.

**What.**
Regenerate the two fine-grained tokens and replace them in Vercel.

**Steps.**

1. GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens: open `n8builds-admin read` and choose **Regenerate token**, with a 1-year expiry and the same access (listed in [docs/SETUP.md](docs/SETUP.md) section 2).
   Before saving, check two settings: **Account permissions, Plan: Read-only** (the Actions minutes page shows nothing without it; the current token was made before this was added), and **Repository access**: keep the selected repos, or choose All repositories if you want the planned Projects page to cover every repo.
   Never paste the new token into a chat with an agent: step 2 puts it in `pass` and pipes it straight into Vercel.
2. In your own terminal, from the repo folder:

   ```sh
   pass-env set n8builds-admin/GITHUB_TOKEN
   vercel env rm GITHUB_TOKEN production
   pass-env pipe n8builds-admin/GITHUB_TOKEN -- vercel env add GITHUB_TOKEN production
   ```

3. Do the same for `n8builds-admin billing` (resource owner Appturnity) with the entry `n8builds-admin/GITHUB_ORG_TOKEN` and the variable `GITHUB_ORG_TOKEN`.
4. Redeploy (`vercel deploy --prod`, or ask Claude) and check that the CI, Actions minutes and Security panels load.
5. Tell Claude the new expiry dates, so the handoff and the reminder notes move to them.

**Why.**
Both tokens appeared in agent logs (2026-10-27 to 2026-10-29) and still work, so they count as exposed.
Rotating now also resets their expiry; otherwise they stop working on 2027-10-27 (`GITHUB_TOKEN`) and 2027-10-28 (`GITHUB_ORG_TOKEN`) and the GitHub panels go blank.

**Unblocks.**
Closes two entries in SECURITY-TODO.md and keeps the GitHub data on the dashboard working for another year.
