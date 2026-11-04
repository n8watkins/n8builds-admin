import 'server-only'
import { signInSkipped } from './auth/bypass'
import { adminDb, analyticsDb, waitlistDb } from './db'
import { getPersonalMinutes } from './github'
import { SETUP_ITEMS, type SetupItem } from './setup'

export type SetupState = 'done' | 'partial' | 'missing' | 'manual'

export type ItemStatus = {
  state: SetupState
  label: string
  /** Required variables that aren't set (names only). */
  missing: string[]
  note?: string
}

function isSet(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

const BINDINGS: Record<string, () => Promise<unknown>> = { WAITLIST_DB: waitlistDb, ANALYTICS_DB: analyticsDb, ADMIN_DB: adminDb }

/** A required name that isn't there: a D1 binding that isn't bound, or a variable that isn't set. */
async function isMissing(item: SetupItem, name: string): Promise<boolean> {
  if (item.check === 'bindings' && BINDINGS[name]) return (await BINDINGS[name]()) === null
  return !isSet(name)
}

export async function itemStatus(item: SetupItem): Promise<ItemStatus> {
  if (item.check === 'manual') return { state: 'manual', label: 'Check in Cloudflare', missing: [], note: 'The dashboard can\'t see this setting, so confirm it in Cloudflare.' }
  if (item.check === 'deployed') {
    // APP_ENV is set by wrangler.jsonc on the Worker; VERCEL_ENV covers the
    // Vercel deployment until that project is deleted.
    return (process.env.APP_ENV ?? process.env.VERCEL_ENV) === 'production'
      ? { state: 'done', label: 'Live', missing: [] }
      : { state: 'missing', label: 'Not deployed yet', missing: [], note: 'This copy is running locally.' }
  }
  const required = item.vars.filter((v) => !v.optional).map((v) => v.name)
  const missing = (await Promise.all(required.map(async (name) => ((await isMissing(item, name)) ? name : null)))).filter(
    (name): name is string => name !== null
  )
  if (item.id === 'sign-in' && missing.length > 0 && signInSkipped()) {
    return { state: 'partial', label: 'Bypassed locally', missing, note: 'This local copy skips sign-in; production needs these.' }
  }
  if (item.id === 'sign-in' && missing.length === 0 && (process.env.ADMIN_SESSION_SECRET?.length ?? 0) < 32) {
    return { state: 'partial', label: 'Secret too short', missing: [], note: '`ADMIN_SESSION_SECRET` needs at least 32 characters.' }
  }
  if (missing.length === required.length) return { state: 'missing', label: 'Not connected', missing }
  if (missing.length > 0) return { state: 'partial', label: `${missing.length} missing`, missing }
  if (item.id === 'github') {
    const personal = await getPersonalMinutes()
    if (!personal.ok) {
      return { state: 'partial', label: 'Needs Plan: read', missing: [], note: 'Connected, but the token can\'t read the personal billing report (GitHub answers 404).' }
    }
  }
  return { state: 'done', label: 'Connected', missing: [] }
}

export async function allSetupStatuses() {
  return Promise.all(SETUP_ITEMS.map(async (item) => ({ item, status: await itemStatus(item) })))
}
