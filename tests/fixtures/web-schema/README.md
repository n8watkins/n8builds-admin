# n8builds-web's schema, for tests and local development only

`waitlist.sql` and `analytics.sql` are copies of n8builds-web's migrations (`migrations/waitlist/` and `migrations/analytics/` there).
n8builds-web owns those two databases and is the only repository that applies migrations to them; these copies are never applied to a real database.
The admin's unit tests load them into in-memory D1 databases, and `npm run db:local` loads them into the local simulation for `next dev`.
When n8builds-web adds a migration, copy it here in the admin pull request that reads the new tables.
