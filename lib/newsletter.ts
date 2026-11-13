import 'server-only'
import { cloudflareEnv, isUnreachableBinding } from './db'
import { formatNumber } from './format'

/**
 * The n8builds newsletter, which runs on Kit (kit.com): Kit keeps the list,
 * sends the double opt-in confirm email and every broadcast, and handles
 * unsubscribes. n8builds-web only signs people up, and only while the owner's
 * switch is on. This page reaches n8builds-web over the NEWSLETTER service
 * binding to its NewsletterAdmin entrypoint (its worker/index.js): the switch
 * and its log, and Kit's side (key set, form, confirmed count). No address
 * ever reaches this dashboard.
 */

export const KIT_APP_URL = 'https://app.kit.com'

export type SwitchChange = { on: boolean; at: string; by: string | null }

export type NewsletterStatus = {
  /** The owner's switch. */
  on: boolean
  /** When and by whom it was last changed; null when it was never set (off). */
  at: string | null
  by: string | null
  /** On and Kit set up: the forms show on n8builds.dev. */
  live: boolean
  /** The latest changes, newest first. */
  log: SwitchChange[]
  kit: {
    /** KIT_API_KEY is set on n8builds-web. */
    configured: boolean
    formId: string | null
    /** Confirmed (active) subscribers in Kit; null when Kit couldn't say. */
    confirmed: number | null
    error: string | null
  }
}

/** n8builds-web's NewsletterAdmin entrypoint. */
export type NewsletterAdmin = {
  status(): Promise<NewsletterStatus>
  setSwitch(on: boolean, actor: string): Promise<{ on: boolean; at: string | null; by: string | null }>
}

/** The entrypoint, or null where it isn't bound (or, in a local E2E build, the made-up one). */
export async function newsletterAdmin(): Promise<NewsletterAdmin | null> {
  // ADMIN_E2E_BUILD is inlined as "" in every other build, so this block and the fixture's module are compiled out.
  if (process.env.ADMIN_E2E_BUILD === '1') {
    const fixture = (await import('./newsletter-fixture')).fixtureNewsletter()
    if (fixture) return fixture
  }
  return (await cloudflareEnv())?.NEWSLETTER ?? null
}

export type Loaded = { state: 'off' } | { state: 'error'; message: string } | { state: 'ok'; status: NewsletterStatus }

/** The status, 'off' when the binding isn't there (or n8builds-web doesn't serve the entrypoint yet). */
export async function readNewsletterStatus(): Promise<Loaded> {
  const admin = await newsletterAdmin()
  if (!admin) return { state: 'off' }
  try {
    return { state: 'ok', status: await admin.status() }
  } catch (error) {
    if (isUnreachableBinding(error)) return { state: 'off' }
    return { state: 'error', message: error instanceof Error ? error.message : 'n8builds-web did not answer' }
  }
}

const DAY_TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })

/** "Nov 13, 2026, 9:15 AM" (Pacific); empty for no date. */
export const shortDateTime = (iso: string | null) => (iso ? DAY_TIME.format(new Date(iso)) : '')

/** The switch in a few words for the page and the Overview. */
export function switchLabel(status: NewsletterStatus): { label: string; tone: 'good' | 'idle' | 'warn' } {
  if (status.live) return { label: 'On', tone: 'good' }
  if (status.on) return { label: 'On, waiting for the Kit key', tone: 'warn' }
  return { label: 'Off', tone: 'idle' }
}

/** The Overview tile. */
export function tileSummary(status: NewsletterStatus): { headline: string; detail: string; status: string; tone: 'warn' | 'quiet' } {
  const { label } = switchLabel(status)
  const confirmed = status.kit.confirmed
  const detail = !status.kit.configured
    ? 'Kit key not set on n8builds-web'
    : confirmed === null
      ? `Kit didn't answer${status.kit.error ? `: ${status.kit.error}` : ''}`
      : `${formatNumber(confirmed)} confirmed in Kit`
  return { headline: label === 'On' ? 'On' : status.on ? 'Waiting' : 'Off', detail, status: label, tone: status.on && !status.live ? 'warn' : 'quiet' }
}
