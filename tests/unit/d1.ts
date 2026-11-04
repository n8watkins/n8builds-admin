import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import type { D1Database } from '@/lib/db'

/**
 * Real local D1 databases for unit tests: wrangler's own simulation, in
 * memory. n8builds-waitlist and n8builds-analytics get n8builds-web's schema
 * (tests/fixtures/web-schema, a copy: that repository owns them); n8builds-admin
 * gets this repository's migrations. reset() empties every table.
 */

const ROOT = join(import.meta.dirname, '..', '..')

/** The statements of a migration file, in order. */
function statements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean)
}

async function apply(db: D1Database, files: string[]) {
  for (const file of files) for (const statement of statements(readFileSync(file, 'utf8'))) await db.prepare(statement).run()
}

const migrations = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(dir, f))

export type TestDatabases = {
  waitlist: D1Database
  analytics: D1Database
  admin: D1Database
  env: { WAITLIST_DB: D1Database; ANALYTICS_DB: D1Database; ADMIN_DB: D1Database }
  reset(): Promise<void>
  dispose(): Promise<void>
}

export async function testDatabases(): Promise<TestDatabases> {
  const proxy = await getPlatformProxy<{ WAITLIST_DB: D1Database; ANALYTICS_DB: D1Database; ADMIN_DB: D1Database }>({
    configPath: join(ROOT, 'tests', 'unit', 'd1', 'wrangler.jsonc'),
    persist: false,
  })
  const env = proxy.env
  await apply(env.WAITLIST_DB, [join(ROOT, 'tests', 'fixtures', 'web-schema', 'waitlist.sql')])
  await apply(env.ANALYTICS_DB, [join(ROOT, 'tests', 'fixtures', 'web-schema', 'analytics.sql')])
  await apply(env.ADMIN_DB, migrations(join(ROOT, 'migrations', 'admin')))
  const all = [env.WAITLIST_DB, env.ANALYTICS_DB, env.ADMIN_DB]
  return {
    waitlist: env.WAITLIST_DB,
    analytics: env.ANALYTICS_DB,
    admin: env.ADMIN_DB,
    env,
    async reset() {
      for (const db of all) {
        const { results } = await db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name <> 'd1_migrations'")
          .all<{ name: string }>()
        // Table names from sqlite_master, not input (identifiers can't be bound).
        for (const { name } of results) await db.prepare(`DELETE FROM "${name}"`).run()
      }
    },
    dispose: () => proxy.dispose(),
  }
}
