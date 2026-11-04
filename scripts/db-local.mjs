// Creates the tables in the local D1 simulation (.wrangler/state) for `next
// dev` and the E2E servers: this repository's own migrations for
// n8builds-admin, and a copy of n8builds-web's schema for the two databases it
// owns (tests/fixtures/web-schema; never applied anywhere but locally).
// Safe to run again: a database that already has its tables is left alone.
import { readFileSync, readdirSync } from 'node:fs'
import { getPlatformProxy } from 'wrangler'

const statements = (sql) =>
  sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean)

const proxy = await getPlatformProxy()
const files = {
  WAITLIST_DB: ['tests/fixtures/web-schema/waitlist.sql'],
  ANALYTICS_DB: ['tests/fixtures/web-schema/analytics.sql'],
  ADMIN_DB: readdirSync('migrations/admin').filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/admin/${f}`),
}
try {
  for (const [binding, paths] of Object.entries(files)) {
    const db = proxy.env[binding]
    const { results } = await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'").all()
    if (results[0].n > 0) continue
    for (const path of paths) for (const statement of statements(readFileSync(path, 'utf8'))) await db.prepare(statement).run()
    console.log(`${binding}: created the local tables`)
  }
} finally {
  await proxy.dispose()
}
