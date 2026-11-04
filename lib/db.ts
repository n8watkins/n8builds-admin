import 'server-only'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * The dashboard's D1 databases (docs/DATABASE.md):
 * - WAITLIST_DB  n8builds-waitlist, owned by n8builds-web: read only here
 * - ANALYTICS_DB n8builds-analytics, owned by n8builds-web: read only here
 * - ADMIN_DB     n8builds-admin, this dashboard's own (the daily snapshot)
 *
 * D1 can't make a binding read-only, so this file does: the two shared
 * databases are only ever handed out wrapped in `readOnly`, which refuses any
 * statement that isn't a single SELECT. tests/unit/db-read-only.test.ts fails
 * if any other file touches the raw bindings, or if any reader writes.
 *
 * On the Worker the bindings come from the request's context; under `next
 * dev` from wrangler's local simulation (`npm run db:local` loads the tables).
 * On Vercel there are none, and every panel shows "not connected".
 */

/**
 * The part of D1's API this dashboard uses. The app's tsconfig leaves out the
 * generated Workers types (cloudflare-env.d.ts, the worker's own tsconfig has
 * them), so the bindings are described here.
 */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes: number } }>
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<{ results: unknown[] }[]>
}

/** n8builds-web's WaitlistAdmin entrypoint (its worker/index.js), over the service binding. */
export type WaitlistWriter = { deleteSubscriber(id: string): Promise<boolean> }

type Env = { WAITLIST_DB?: D1Database; ANALYTICS_DB?: D1Database; ADMIN_DB?: D1Database; WAITLIST_ADMIN?: WaitlistWriter }

const LOCAL = Symbol.for('n8builds-admin.localCloudflareEnv')
type WithLocal = typeof globalThis & { [LOCAL]?: Promise<Env> }

async function cloudflareEnv(): Promise<Env | null> {
  try {
    return getCloudflareContext().env as Env
  } catch {
    // Vercel has no bindings, and no wrangler to simulate them.
    if (process.env.VERCEL) return null
    // Off Workers, one local simulation per process: two would fight over the same SQLite files.
    const global = globalThis as WithLocal
    global[LOCAL] ??= getCloudflareContext({ async: true })
      .then((context) => context.env as Env)
      .catch((error) => {
        global[LOCAL] = undefined
        throw error
      })
    try {
      return await global[LOCAL]
    } catch {
      return null
    }
  }
}

/** The only statements a reader may run: one SELECT (or WITH ... SELECT), nothing that writes. */
const READ = /^\s*(SELECT|WITH)\b/i
const WRITE = /\b(INSERT|UPDATE|DELETE|REPLACE|UPSERT|DROP|ALTER|CREATE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX|ANALYZE)\b/i

export function assertReadOnly(sql: string): void {
  // A statement ending in ";" followed by another one is two statements.
  const single = sql.trim().replace(/;$/, '')
  if (!READ.test(single) || WRITE.test(single) || single.includes(';')) {
    throw new Error('n8builds-admin reads this database and never writes to it: only a single SELECT is allowed')
  }
}

/** A read-only view of a database: parameterized SELECTs, nothing else. */
export type ReadOnlyDb = {
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>
  first<T>(sql: string, ...params: unknown[]): Promise<T | null>
}

export function readOnly(db: D1Database): ReadOnlyDb {
  return {
    async all<T>(sql: string, ...params: unknown[]) {
      assertReadOnly(sql)
      return (await db.prepare(sql).bind(...params).all<T>()).results
    },
    async first<T>(sql: string, ...params: unknown[]) {
      assertReadOnly(sql)
      return db.prepare(sql).bind(...params).first<T>()
    },
  }
}

/** n8builds-waitlist, read only; null where it isn't bound. */
export async function waitlistDb(): Promise<ReadOnlyDb | null> {
  const env = await cloudflareEnv()
  return env?.WAITLIST_DB ? readOnly(env.WAITLIST_DB) : null
}

/** n8builds-analytics, read only; null where it isn't bound. */
export async function analyticsDb(): Promise<ReadOnlyDb | null> {
  const env = await cloudflareEnv()
  return env?.ANALYTICS_DB ? readOnly(env.ANALYTICS_DB) : null
}

/** n8builds-admin, the dashboard's own database (read and write); null where it isn't bound. */
export async function adminDb(): Promise<D1Database | null> {
  return (await cloudflareEnv())?.ADMIN_DB ?? null
}

export async function waitlistWriter(): Promise<WaitlistWriter | null> {
  return (await cloudflareEnv())?.WAITLIST_ADMIN ?? null
}
