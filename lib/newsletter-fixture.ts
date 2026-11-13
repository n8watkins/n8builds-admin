import { announceFixtureEnabled } from './announce-fixture'
import type { NewsletterAdmin, NewsletterStatus, SwitchChange } from './newsletter'

/*
 * A made-up NewsletterAdmin entrypoint for screenshots and the E2E run, in
 * memory, never Kit. It runs where the Announcements fixture does
 * (announceFixtureEnabled: a local E2E build only): ANNOUNCE_FIXTURE=1 has the
 * Kit key set and a few confirmed readers; ANNOUNCE_FIXTURE=empty has no key,
 * as n8builds-web is until the owner sets it.
 */

type State = { on: boolean; at: string | null; by: string | null; log: SwitchChange[] }

const KEY = Symbol.for('n8builds-admin.newsletterFixture')

function state(): State {
  const global = globalThis as typeof globalThis & { [KEY]?: State }
  return (global[KEY] ??= { on: false, at: null, by: null, log: [] })
}

/** The made-up entrypoint, or null outside a local E2E build with ANNOUNCE_FIXTURE set. */
export function fixtureNewsletter(): NewsletterAdmin | null {
  if (!announceFixtureEnabled()) return null
  const keySet = process.env.ANNOUNCE_FIXTURE === '1'
  return {
    async status(): Promise<NewsletterStatus> {
      const s = state()
      return {
        on: s.on,
        at: s.at,
        by: s.by,
        live: s.on && keySet,
        log: s.log.slice(0, 10),
        kit: keySet ? { configured: true, formId: '4242', confirmed: 37, error: null } : { configured: false, formId: null, confirmed: null, error: null },
      }
    },
    async setSwitch(on, actor) {
      const s = state()
      if (s.at && s.on === on) return { on: s.on, at: s.at, by: s.by }
      s.on = on
      s.at = new Date().toISOString()
      s.by = actor
      s.log.unshift({ on, at: s.at, by: actor })
      return { on, at: s.at, by: actor }
    },
  }
}
