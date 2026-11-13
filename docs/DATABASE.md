# Databases

The dashboard's data is in Cloudflare D1.
The full design (every table, retention, backups, threats) lives in n8builds-web's [docs/DATABASE.md](https://github.com/n8watkins/n8builds-web/blob/main/docs/DATABASE.md); this is the admin's side of it.
Keep both current with the code.

## Owners and readers

- The **owner** of a database is the one app whose repository defines its tables (holds and applies its migrations) and whose code writes to it.
- A **reader** only queries a database: it never writes and never changes the schema.

| Database | Binding here | Owner | This dashboard |
| --- | --- | --- | --- |
| `n8builds-waitlist` | `WAITLIST_DB` | n8builds-web | reader: the Waitlist page (sign-ups, per-project confirmed counts) and the Newsletter page (subscriber counts, digests, skipped weeks) |
| `n8builds-analytics` | `ANALYTICS_DB` | n8builds-web | reader: referrals, contact messages, the dino game, the Overview |
| `n8builds-admin` | `ADMIN_DB` | n8builds-admin (this repository, `migrations/admin/`) | owner: the daily snapshot of stars and Actions minutes |

## Architecture decision (owner-approved, 2026-11-04)

- One owner per database is the hard rule.
  The daily snapshot is the dashboard's own state, so it has its own database, `n8builds-admin`, and n8builds-web's two databases have a single writer each.
- The waitlist is apart from the counters so each can be restored, exported, deleted and kept on its own terms; the waitlist is shared product infrastructure (Feelium, KeysReady and later products), not just n8builds.dev's data.
- No copies: the dashboard reads n8builds-web's tables directly.
- Cost is near zero: D1 bills by use, not per database.
- What it doesn't buy: D1 can't make a binding read-only, so the read-only rule is enforced here in code and tests.

## How read-only is enforced

- `lib/db.ts` is the only file that touches the bindings; it hands out `WAITLIST_DB` and `ANALYTICS_DB` only wrapped in `readOnly`, which refuses anything but a single `SELECT` (or `WITH ... SELECT`).
- `tests/unit/db-read-only.test.ts` fails if any other file reaches those bindings, if any reader issues a write, or if reading changes a single row.
- The one write the dashboard needs, deleting an address on request, is n8builds-web's: the Waitlist page calls its `WaitlistAdmin.deleteSubscriber` over the `WAITLIST_ADMIN` service binding (RPC, never reachable from the internet).
- Every page is behind the owner's GitHub sign-in.

## The newsletter

The newsletter runs on Kit, so no database here or in n8builds-waitlist holds its readers.
The Newsletter page and its Overview tile ask n8builds-web over the `NEWSLETTER` service binding (its `NewsletterAdmin` entrypoint) for the on/off switch, its log and Kit's side (key set, form, confirmed count), in `lib/newsletter.ts`; "Turn newsletter on/off" is that entrypoint's `setSwitch`, with the owner's login.
The self-sent newsletter's old tables (n8builds-web's `migrations/waitlist/0002_newsletter.sql`) are no longer read; their schema copy stays in `tests/fixtures/web-schema/` until n8builds-web drops them.

## n8builds-admin

`admin_snapshots (day TEXT PRIMARY KEY, data TEXT NOT NULL CHECK (json_valid(data)), created_at TEXT NOT NULL)`: one JSON snapshot a day, written by `/api/cron/snapshot` (the 06:15 UTC Cron Trigger).
Kept 400 days: each run deletes the ones older than that.
No visitor data.

## Migrations, local development and tests

- The deploy workflow runs `npm run db:migrate` before every deploy from `main`, so a new file in `migrations/admin/` reaches `n8builds-admin` before the code that reads it.
  To apply one by hand, run the same command (wrangler's logged-in account, or a token with `D1: Edit`).
  Keep migrations additive, so the previous deployment keeps working against the new schema.
  This repository never applies migrations to n8builds-web's databases.
- `npm run db:local` creates the tables in wrangler's local simulation for `next dev` and the E2E servers: this repository's migrations, and a copy of n8builds-web's schema (`tests/fixtures/web-schema/`, never applied anywhere but locally).
  When n8builds-web adds a migration, copy it there in the pull request that reads it.
- Unit tests run the readers against in-memory D1 databases from wrangler's `getPlatformProxy` (`tests/unit/d1.ts`).

## Where it runs

The Cloudflare Worker has all three bindings.
The Vercel deployment (admin.n8builds.dev until the cut-over) has none, so its counter, game, trend and waitlist pages show "not connected".
