-- The admin dashboard's own state (docs/DATABASE.md): n8builds-admin owns
-- this database and is its only reader and writer.

-- One snapshot a day (app/api/cron/snapshot/route.ts): stars per repo and the
-- month's Actions minutes, as JSON. Kept 400 days; the cron prunes older ones.
CREATE TABLE admin_snapshots (
  day TEXT PRIMARY KEY CHECK (length(day) = 10),
  data TEXT NOT NULL CHECK (json_valid(data)),
  created_at TEXT NOT NULL
) WITHOUT ROWID;
