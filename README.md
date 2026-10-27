# n8builds admin

The private owner dashboard for n8builds.dev, served at admin.n8builds.dev.
An Overview that puts what needs attention first, a detail page per area (CI, Actions minutes, stars and traffic, releases and deploys, security alerts, live demos, errors, website traffic, Appturnity referrals, contact messages), and a Setup page with each account resource's live status.

- Next.js 16 App Router, TypeScript, Tailwind 4, server components only; each panel fetches on the server (cached 5 minutes) in its own Suspense and error boundary.
- Sign-in is hand-rolled GitHub OAuth (state and PKCE) that admits only the owner's GitHub user ID, with a signed, HttpOnly `__Host-` cookie that lasts 7 days, checked in the proxy, the layout and every route handler.
- Never indexed, no analytics on the admin itself.

Setting up the accounts it reads from: the in-app Setup page, or [docs/SETUP.md](docs/SETUP.md).
Both come from `lib/setup.ts`; after changing it, run `npm run setup:docs` (a unit test fails if the doc drifts).

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

## Lighthouse

Lighthouse runs against a real production build with a test-only sign-in stub (`lib/auth/test-auth.ts`).
That stub exists only in an E2E build (`ADMIN_E2E_BUILD=1`, written to `.next-e2e`), which Vercel refuses to build, and the postbuild check fails a normal build if it ever survives.

```sh
npm run build:e2e
CHROME_PATH=~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome GITHUB_TOKEN=$(gh auth token) npm run lighthouse
```

Budgets (median of 3 runs): desktop performance 0.9 and accessibility 0.95 on nine pages, mobile performance 0.8 on three; reports go to `.lighthouse/`.

## Speed

`ADMIN_TRACE=1` logs every upstream request with its duration.
Every read is cached for 5 minutes; the Overview reads only its headlines (each cached separately, never the detail data) and caps a slow source at 6 seconds.
