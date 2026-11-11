# App stats: one shape for every app's admin numbers

Each app that has its own admin (NetTrailers today; PortfolioRank and the mailroom next) reports a small set of totals to this dashboard in one shared shape.
The Overview shows one card per app, and every action stays in the app's own admin, which the card links to.
The TypeScript source of truth is `lib/app-stats.ts` (`AppStats`); keep this page and that file in step.

## How it connects

- The app's Worker exports a `WorkerEntrypoint` class named `AdminStats` with one RPC method, `stats(): Promise<AppStats>`.
- This Worker binds to it in `wrangler.jsonc` under `services`, for example `{ "binding": "NETTRAILERS_ADMIN", "service": "net-trailers", "entrypoint": "AdminStats" }`.
- A named entrypoint is reachable only through a service binding on the same Cloudflare account: it has no URL, so there is no token to store or rotate, and the public site cannot call it.
- `APP_SOURCES` in `lib/app-stats.ts` lists each binding with the app's name and admin URL.
- Before the app has deployed the entrypoint, the card says "Unreachable" with the error, and the rest of the Overview is unaffected.
  A binding missing from this Worker (a local server) shows "Not connected".
  A call that takes over 5 seconds, throws, or answers in another shape shows "Unreachable" too.

## Rules for the answer

- Totals only.
  Never an email address, a name, a user id or any per-user row: this dashboard is a second place the data would live, so it gets none.
- Read-only.
  The entrypoint has no method that writes, and this dashboard never asks for one.
- Cheap: a handful of aggregate queries, under a second.
  This dashboard caches nothing extra for it, so keep it fast enough to call on every Overview load.

## The shape (schema 1)

```ts
type AppStats = {
  schema: 1                 // bumped only for a breaking change
  app: string               // stable lowercase id: "nettrailers"
  name: string              // "NetTrailers"
  generatedAt: string       // ISO time the app built this answer
  adminUrl: string          // the app's own admin, where actions live
  tile: {                   // what a compact home tile shows
    headline: { value: number; label: string }            // 5 "users"
    meter?: { value: number; limit: number; label: string } // emails this month vs the cap
    note: string                                          // "3 new this week"
    tone: 'good' | 'warn' | 'bad' | 'quiet'               // bad: something failed; warn: needs a look
  }
  totals: { key: string; label: string; value: number }[]
  quotas: { key: string; label: string; used: number; limit: number; period: 'day' | 'month' }[]
  jobs: { key: string; label: string; schedule: string; lastRunAt: string | null; status: 'ok' | 'failed' | 'running' | 'never' }[]
  errors: { count: number; windowHours: number }
  deploy: { version: string; deployedAt: string | null }
}
```

- `tile` is the summary for a small tile; the card shows it first, then the fuller `totals`, `jobs`, `errors` and `deploy`.
- `tone` is the app's own judgement: `bad` when a job failed or a cap is reached, `warn` for errors or a cap at 70% or more, otherwise `quiet` (or `good` for an explicit all-clear).
- Keys are stable ids for code (`users`, `email-month`); labels are what people read.
- Add fields only in a way old readers can ignore; change or remove one only with `schema: 2`.

## Adding an app

1. In the app, export `class AdminStats extends WorkerEntrypoint` from its Worker entry with `async stats()` returning this shape, and test that it carries no per-user data.
2. Deploy the app first.
3. Here, add the service binding to `wrangler.jsonc`, run `npm run cf-typegen`, and add the app to `APP_SOURCES`.

| App | Binding | Service and entrypoint | Notes |
| --- | --- | --- | --- |
| NetTrailers | `NETTRAILERS_ADMIN` | `net-trailers`, `AdminStats` | users, new and active this week, emails today and this month vs caps, the three weekly crons |
| PortfolioRank | (planned) | | its `/api/admin/quota` numbers become `quotas` |
| mailroom | (planned) | | already bound as `MAILROOM` for the Mailroom page; can add `stats()` for a tile in this shape |
