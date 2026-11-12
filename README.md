# n8builds admin

The owner-only dashboard for n8builds.dev, served at admin.n8builds.dev: the source is public, the dashboard needs the owner's GitHub sign-in.
An Overview with what needs attention as one row of chips and a small tile per section, grouped like the sidebar; a compact page per area (CI, Actions minutes, stars and traffic, releases and deploys, security alerts, live demos, errors, website traffic, mailroom, Tech for Pros referrals, contact messages, the dino game, the waitlist, the newsletter, announcements to a project's waitlist, Cloudflare usage against the plan's included amounts), with tabs where a page has several sections; and a Setup page with each account resource's live status.

- Next.js 16 App Router, TypeScript, Tailwind 4, server components only; each panel fetches on the server (cached 5 minutes) in its own Suspense and error boundary.
- Sign-in is hand-rolled GitHub OAuth (state and PKCE) that admits only the owner's GitHub user ID, with a signed, HttpOnly `__Host-` cookie that lasts 7 days, checked in the proxy, the layout and every route handler.
- Never indexed, no analytics on the admin itself.
- Runs on Cloudflare Workers through OpenNext, with the daily snapshot as a Cron Trigger: see [DEPLOY.md](DEPLOY.md).
- Reads n8builds.dev's D1 databases (the waitlist and newsletter, the anonymous counters) read-only, and keeps its own snapshot in its own: see [docs/DATABASE.md](docs/DATABASE.md).
- Announcements email a project's confirmed waitlist people through n8builds-web's `Announcements` entrypoint (the `ANNOUNCE` service binding), which holds the addresses, templates and sending; the admin never sees an address.

Setting up the accounts it reads from: the in-app Setup page, or [docs/SETUP.md](docs/SETUP.md).
Both come from `lib/setup.ts`; after changing it, run `npm run setup:docs` (a unit test fails if the doc drifts).
The owner's open steps (accounts and keys) are kept in a local, gitignored `OWNER-TODO.md`, not in this public repo.

## Local preview

Before the OAuth App exists, the dev-only bypass admits you without signing in.
It works only under `next dev` with `ADMIN_DEV_BYPASS=1` in `.env.local`; production builds compile it out (`tests/unit/dev-bypass.test.ts`, and `npm run build` fails if it survives).

```sh
npm install
echo 'ADMIN_DEV_BYPASS=1' > .env.local
GITHUB_TOKEN=$(gh auth token) npm run dev   # http://localhost:3831
```

## Checks

```sh
npm run lint && npm run type-check && npm test
```

## End-to-end tests

Playwright runs against two production servers, so it tests what actually ships:

- **gate**: the normal build (`.next`, what the Worker is built from), started with `ADMIN_DEV_BYPASS=1` and `ADMIN_TEST_AUTH=1` to prove both are ignored. Every page redirects to `/login`, API routes answer 401, forged cookies are refused, responses are `noindex`.
- **app**: the E2E build (`.next-e2e`) with the test-only sign-in stub. Every page renders with no errors and no axe (WCAG 2.1 AA) violations, the sidebar and phone menu navigate, links to other sites open in a new tab and say so, and no page scrolls sideways at 375 or 320 pixels.

```sh
npx playwright install chromium   # once
GITHUB_TOKEN=$(gh auth token) npm run test:e2e   # builds both, then runs the specs
npm run test:e2e:only             # rerun the specs without rebuilding
```

Without `GITHUB_TOKEN` the GitHub pages show their "not connected" states; the specs pass either way.
The test servers use ports 3834 and 3835.

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`: lint, types, unit tests, both builds and the Playwright specs, in one job inside Playwright's Docker image (its version read from `package-lock.json`), on Node 24.
It uses no secrets, so the GitHub pages are tested in their "not connected" states.
Docs-only changes skip it.
"CI result" is the single summary check: require it if the repo ever gets branch protection (rulesets on a private repo need GitHub Pro).

## Lighthouse

Lighthouse runs against a real production build with a test-only sign-in stub (`lib/auth/test-auth.ts`).
That stub exists only in an E2E build (`ADMIN_E2E_BUILD=1`, written to `.next-e2e`), which Vercel and the Cloudflare Worker build refuse, and the postbuild checks fail a normal build or the Worker bundle if it ever survives (DEPLOY.md).

```sh
npm run build:e2e
CHROME_PATH=~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome GITHUB_TOKEN=$(gh auth token) npm run lighthouse
```

Budgets (median of 3 runs): desktop performance 0.9 and accessibility 0.95 on nine pages, mobile performance 0.8 on three; reports go to `.lighthouse/`.

## Speed

`ADMIN_TRACE=1` logs every upstream request with its duration.
Every read is cached for 5 minutes; the Overview reads only its headlines (each cached separately, never the detail data) and caps a slow source at 6 seconds.
