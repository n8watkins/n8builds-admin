import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewsletterAdmin, NewsletterStatus } from '@/lib/newsletter'

vi.mock('server-only', () => ({}))

/** What the NEWSLETTER binding is in each test: a stand-in for n8builds-web's NewsletterAdmin, or nothing. */
let binding: NewsletterAdmin | undefined
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({ env: { NEWSLETTER: binding } }),
}))
const owner = { login: 'n8watkins', devBypass: false }
vi.mock('@/lib/auth/owner', () => ({ requireOwner: async () => owner }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { readNewsletterStatus, switchLabel, tileSummary } = await import('@/lib/newsletter')
const { setNewsletter } = await import('@/app/(dashboard)/newsletter/actions')

const status = (extra: Partial<NewsletterStatus> = {}): NewsletterStatus => ({
  on: false,
  at: null,
  by: null,
  live: false,
  log: [],
  kit: { configured: true, formId: '4242', confirmed: 12, error: null },
  ...extra,
})

const form = (on: string) => {
  const data = new FormData()
  data.set('on', on)
  return data
}

beforeEach(() => {
  binding = undefined
})

describe('readNewsletterStatus', () => {
  it("is 'off' without the binding", async () => {
    expect(await readNewsletterStatus()).toEqual({ state: 'off' })
  })

  it("is 'off' while n8builds-web doesn't serve the entrypoint yet", async () => {
    binding = { status: async () => Promise.reject(new Error('Worker "n8builds-web" not found. Make sure it is running locally')), setSwitch: vi.fn() }
    expect((await readNewsletterStatus()).state).toBe('off')
  })

  it('passes n8builds-web\'s status through, and its errors as errors', async () => {
    binding = { status: async () => status({ on: true, live: true }), setSwitch: vi.fn() }
    expect(await readNewsletterStatus()).toEqual({ state: 'ok', status: status({ on: true, live: true }) })
    binding = { status: async () => Promise.reject(new Error('D1 is down')), setSwitch: vi.fn() }
    expect(await readNewsletterStatus()).toEqual({ state: 'error', message: 'D1 is down' })
  })
})

describe('switchLabel and the Overview tile', () => {
  it('says plainly when the switch is on but the Kit key is missing', () => {
    const waiting = status({ on: true, live: false, kit: { configured: false, formId: null, confirmed: null, error: null } })
    expect(switchLabel(waiting)).toEqual({ label: 'On, waiting for the Kit key', tone: 'warn' })
    expect(tileSummary(waiting)).toEqual({ headline: 'Waiting', detail: 'Kit key not set on n8builds-web', status: 'On, waiting for the Kit key', tone: 'warn' })
  })

  it('shows Kit\'s confirmed count when live, and Off by default', () => {
    expect(tileSummary(status({ on: true, live: true }))).toMatchObject({ headline: 'On', detail: '12 confirmed in Kit', tone: 'quiet' })
    expect(tileSummary(status())).toMatchObject({ headline: 'Off', status: 'Off' })
  })
})

describe('setNewsletter (Turn newsletter on/off)', () => {
  it("passes the choice and the owner's login to n8builds-web", async () => {
    const setSwitch = vi.fn(async (on: boolean, by: string) => ({ on, at: '2026-11-13T17:00:00.000Z', by }))
    binding = { status: async () => status(), setSwitch }
    expect(await setNewsletter(null, form('true'))).toEqual({ ok: true, message: 'The newsletter is on.' })
    expect(await setNewsletter(null, form('false'))).toEqual({ ok: true, message: 'The newsletter is off.' })
    expect(setSwitch.mock.calls).toEqual([
      [true, 'n8watkins'],
      [false, 'n8watkins'],
    ])
  })

  it('refuses anything but true or false, and says when n8builds-web is missing or refuses', async () => {
    expect(await setNewsletter(null, form('yes'))).toEqual({ ok: false, message: 'Unknown setting.' })
    expect(await setNewsletter(null, form('true'))).toEqual({ ok: false, message: 'n8builds-web is not connected to this server.' })
    binding = { status: async () => status(), setSwitch: async () => Promise.reject(new Error('actor required')) }
    expect(await setNewsletter(null, form('true'))).toEqual({ ok: false, message: 'actor required' })
  })
})
