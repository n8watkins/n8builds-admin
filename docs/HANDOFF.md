# HANDOFF - n8builds-admin

## Current state and open work (2026-10-27): start here

### What this is

The owner's private dashboard at https://admin.n8builds.dev (Next.js on Vercel, GitHub sign-in).
It isn't listed publicly.
Setup details: `docs/SETUP.md`.

### State

- Merged: release-kit 2 as a dev dependency (#1), the "Dino game" page with rounds, players, tries, scores, countries and high scores (#2), skipping Vercel builds for Dependabot and docs-only changes (#3).
- Vercel deploys `main` only (2026-10-28, `git.deploymentEnabled` in `vercel.json`): other branches get no automatic preview, to stay under the 100 deployments a day the account shares. Run `vercel deploy` from a branch for one.
- The Dino game page reads the analytics Redis that n8builds.dev's `POST /api/game` writes to; it shows "not connected" until that Redis exists.
- The Security page shows live Dependabot counts for the build repos.
- `GITHUB_TOKEN` (used for the GitHub data) expires on 2027-10-27; renew it before then.
- CI (`.github/workflows/ci.yml`, 2026-10-28) runs lint, types, unit tests, both builds and the E2E specs on every PR and push to `main`, without secrets. "CI result" is the check to require if the repo ever gets rulesets (private repos need GitHub Pro).

### Next

1. Once the owner adds the Redis variables, check the Dino game page shows real numbers after a few games on n8builds.dev and the portfolio.
2. Once the Sentry token is set, check the Sentry panel loads.

### Blocked on the owner

- A second Upstash Redis database, with `ANALYTICS_REDIS_REST_URL` and `ANALYTICS_REDIS_REST_TOKEN` set on both this Vercel project and n8builds-web's.
- A read-only Sentry token.
- The first sign-in.

The cross-project backlog lives in n8builds-web: `PROJECT_BACKLOG.md`.
