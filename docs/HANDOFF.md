# HANDOFF - n8builds-admin

## Current state and open work (2026-10-27): start here

### What this is

The owner-only dashboard at https://admin.n8builds.dev (Next.js, GitHub sign-in).
It runs on Cloudflare Workers (DEPLOY.md) at https://n8builds-admin.nathancwatkins23.workers.dev; admin.n8builds.dev still points at Vercel until the owner moves the domain and sets the Worker's secrets (OWNER-TODO.md).
It isn't listed publicly.
Setup details: `docs/SETUP.md`.

### State

- Merged: release-kit 2 as a dev dependency (#1), the "Dino game" page with rounds, players, tries, scores, countries and high scores (#2), skipping Vercel builds for Dependabot and docs-only changes (#3).
- 2026-11-03: moved to Cloudflare Workers with OpenNext: the daily snapshot is a Cron Trigger, the data cache is in R2, `APP_ENV` replaces `VERCEL_ENV`, and the Releases page reads Worker deploys from the Cloudflare API. Vercel still deploys `main` (`vercel.json`) until the owner deletes the project.
- 2026-11-04: Upstash is gone. The counters, game and waitlist pages read n8builds-web's D1 databases read-only, and the daily snapshot is in the dashboard's own D1 database (docs/DATABASE.md). On Vercel those pages show "not connected".
- The Security page shows live Dependabot counts for the build repos.
- `GITHUB_TOKEN` (used for the GitHub data) expires on 2027-10-27, and `GITHUB_ORG_TOKEN` (`n8builds-admin billing`: Appturnity, Administration read-only, for the Actions minutes card) on 2027-10-28; renew both before then.
- CI (`.github/workflows/ci.yml`, 2026-10-28) runs lint, types, unit tests, both builds and the E2E specs on every PR and push to `main`, without secrets. "CI result" is the check to require if the repo ever gets rulesets (private repos need GitHub Pro).

### Next

1. Done 2026-10-28: the Sentry panel has its token.

### Blocked on the owner

Nothing blocks the code.
The owner's open steps are in the local, gitignored `OWNER-TODO.md` in the main checkout (the repo is public, so it never goes in git); keep that file current instead of listing them here.

The cross-project backlog lives in n8builds-web: `PROJECT_BACKLOG.md`.
