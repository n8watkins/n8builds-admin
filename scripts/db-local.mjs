// Creates the tables in the local D1 simulation (.wrangler/state) for `next
// dev` and the E2E servers: this repository's own migrations for
// n8builds-admin, and a copy of n8builds-web's schema for the two databases it
// owns (tests/fixtures/web-schema; never applied anywhere but locally).
// Safe to run again: a file whose tables already exist is left alone, so a
// schema file added later (the newsletter's) still reaches an existing local database.
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

/** The tables a schema file creates. */
const tablesOf = (sql) => [...sql.matchAll(/^\s*CREATE TABLE\s+(\w+)/gim)].map((match) => match[1])

const proxy = await getPlatformProxy()
const files = {
  WAITLIST_DB: ['tests/fixtures/web-schema/waitlist.sql', 'tests/fixtures/web-schema/waitlist-newsletter.sql'],
  ANALYTICS_DB: ['tests/fixtures/web-schema/analytics.sql'],
  ADMIN_DB: readdirSync('migrations/admin').filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/admin/${f}`),
}
try {
  for (const [binding, paths] of Object.entries(files)) {
    const db = proxy.env[binding]
    const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
    const existing = new Set(results.map((row) => row.name))
    for (const path of paths) {
      const sql = readFileSync(path, 'utf8')
      if (tablesOf(sql).every((table) => existing.has(table))) continue
      for (const statement of statements(sql)) await db.prepare(statement).run()
      console.log(`${binding}: created the local tables from ${path}`)
    }
  }
} finally {
  await proxy.dispose()
}
