import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Announcement, AnnounceAdmin } from '@/lib/announcements'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const requireOwner = vi.fn()
vi.mock('@/lib/auth/owner', () => ({ requireOwner: () => requireOwner() }))

let admin: AnnounceAdmin | null = null
vi.mock('@/lib/announcements', () => ({ announceAdmin: async () => admin }))

const { cancelAnnouncement, previewAnnouncement, sendTestAnnouncement, startAnnouncement } = await import('@/app/(dashboard)/announcements/actions')
const { announceFixtureEnabled } = await import('@/lib/announce-fixture')
const { isUnreachableBinding } = await import('@/lib/db')

const ID = 'ab'.repeat(16)

const status = (over: Partial<Announcement> = {}): Announcement => ({
  id: ID,
  project: 'feelium',
  subject: 'Feelium is open',
  total: 10,
  sent: 4,
  failed: 1,
  skipped: 5,
  state: 'cancelled',
  lastError: null,
  nextRunAt: null,
  ...over,
})

function fakeAdmin(): AnnounceAdmin {
  return {
    projects: vi.fn(async () => []),
    templates: vi.fn(async () => [
      {
        id: 'launched' as const,
        name: 'It launched',
        fields: [
          { key: 'title', label: 'Title', max: 20, required: true },
          { key: 'body', label: 'Body', max: 200, required: true },
          { key: 'perk', label: 'Perk (optional)', max: 50, required: false },
          { key: 'buttonUrl', label: 'Button link (https)', max: 300, required: true },
        ],
      },
    ]),
    preview: vi.fn(async () => ({ subject: 'Feelium is open', html: '<p>hi</p>', text: 'hi', recipients: 3, fields: {} })),
    sendTest: vi.fn(async () => ({ ok: true, messageId: 'm1' })),
    start: vi.fn(async () => ({ id: ID })),
    status: vi.fn(async () => null),
    list: vi.fn(async () => []),
    cancel: vi.fn(async () => status()),
  }
}

const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}
const fields = { title: ' Open now ', body: 'Try it today', perk: '', buttonUrl: 'https://n8builds.dev/upcoming/feelium', extra: 'dropped' }
const good = { project: 'feelium', template: 'launched', fields: JSON.stringify(fields) }
const withFields = (over: Record<string, string>) => ({ ...good, fields: JSON.stringify({ ...fields, ...over }) })

beforeEach(() => {
  admin = fakeAdmin()
  requireOwner.mockReset().mockResolvedValue({ login: 'owner-login', githubId: 1, expiresAt: 0, devBypass: false })
})

describe('announcement actions', () => {
  it('need the signed-in owner before anything else', async () => {
    requireOwner.mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(startAnnouncement(null, form(good))).rejects.toThrow('NEXT_REDIRECT')
    await expect(sendTestAnnouncement(null, form(good))).rejects.toThrow('NEXT_REDIRECT')
    await expect(cancelAnnouncement(null, form({ id: ID }))).rejects.toThrow('NEXT_REDIRECT')
    await expect(previewAnnouncement({ project: 'feelium', template: 'open', fields: {} })).rejects.toThrow('NEXT_REDIRECT')
    expect(admin?.start).not.toHaveBeenCalled()
  })

  it('start with the owner as the actor, every field of the template, an empty optional one too, trimmed', async () => {
    expect(await startAnnouncement(null, form(good))).toEqual({ ok: true, message: 'Started: the first emails are going out now.' })
    expect(admin?.start).toHaveBeenCalledWith(
      { project: 'feelium', template: 'launched', fields: { title: 'Open now', body: 'Try it today', perk: '', buttonUrl: 'https://n8builds.dev/upcoming/feelium' } },
      'owner-login',
    )
  })

  it('ask n8builds-web for the project\'s own copy with no fields at all', async () => {
    expect(await previewAnnouncement({ project: 'feelium', template: 'progress', fields: { title: 'ignored' } }, { defaults: true })).toMatchObject({ ok: true })
    expect(admin?.preview).toHaveBeenCalledWith({ project: 'feelium', template: 'progress', fields: {} })
    expect(admin?.templates).not.toHaveBeenCalled()
  })

  it('preview and test with the [[...]] placeholder still in, but never start with it', async () => {
    const placeholder = form(withFields({ body: 'Hi\n\n[[What changed]]' }))
    expect(await previewAnnouncement({ project: 'feelium', template: 'launched', fields: { ...fields, body: '[[What changed]]' } })).toMatchObject({ ok: true })
    expect(await sendTestAnnouncement(null, placeholder)).toEqual({ ok: true, message: 'Test sent to your inbox.' })
    expect(await startAnnouncement(null, placeholder)).toEqual({ ok: false, message: 'Body: Replace the [[...]] placeholder with your own words.' })
    expect(admin?.start).not.toHaveBeenCalled()
  })

  it('send the test as the owner, and say why mailroom refused it', async () => {
    expect(await sendTestAnnouncement(null, form(good))).toEqual({ ok: true, message: 'Test sent to your inbox.' })
    expect(admin?.sendTest).toHaveBeenCalledWith(expect.objectContaining({ project: 'feelium' }), 'owner-login')
    vi.mocked(admin!.sendTest).mockResolvedValue({ ok: false, code: 'cap_app_day', retryable: true })
    expect(await sendTestAnnouncement(null, form(good))).toEqual({ ok: false, message: 'Not sent: cap app day. Try again in a moment.' })
  })

  it('refuse what n8builds-web would refuse, by the field, before calling it', async () => {
    expect(await startAnnouncement(null, form(withFields({ body: ' ' })))).toEqual({ ok: false, message: 'Body: Required.' })
    expect(await startAnnouncement(null, form(withFields({ title: 'x'.repeat(21) })))).toEqual({ ok: false, message: 'Title: 1 over the 20 characters.' })
    expect(await startAnnouncement(null, form(withFields({ buttonUrl: 'http://n8builds.dev' })))).toEqual({ ok: false, message: 'Button link (https): Must be a full link starting with https://.' })
    expect(await startAnnouncement(null, form({ ...good, template: 'open' }))).toEqual({ ok: false, message: 'n8builds-web has no such template.' })
    expect(await startAnnouncement(null, form({ ...good, template: 'spam' }))).toEqual({ ok: false, message: 'Pick a template.' })
    expect(await startAnnouncement(null, form({ ...good, project: '../x' }))).toEqual({ ok: false, message: 'Pick a project.' })
    expect(await startAnnouncement(null, form({ ...good, fields: 'not json' }))).toEqual({ ok: false, message: 'The fields could not be read.' })
    expect(admin?.start).not.toHaveBeenCalled()
  })

  it('say when it was too soon, nobody is confirmed, or n8builds-web refused it', async () => {
    vi.mocked(admin!.start).mockResolvedValueOnce({ error: 'too_soon', nextAllowedAt: '2026-12-01T00:00:00.000Z' })
    expect(await startAnnouncement(null, form(good))).toEqual({ ok: false, message: 'Not sent: this project can be announced again on Dec 1.' })
    vi.mocked(admin!.start).mockResolvedValueOnce({ error: 'no_recipients' })
    expect(await startAnnouncement(null, form(good))).toEqual({ ok: false, message: 'Not sent: no one is confirmed on this project\'s waitlist any more.' })
    vi.mocked(admin!.start).mockRejectedValueOnce(new Error('unknown project: feelium'))
    expect(await startAnnouncement(null, form(good))).toEqual({ ok: false, message: 'Not sent: unknown project: feelium' })
  })

  it('cancel as the owner, and say what it stopped', async () => {
    expect(await cancelAnnouncement(null, form({ id: ID }))).toEqual({ ok: true, message: 'Cancelled: 4 people had it, 5 people won\'t get it.' })
    expect(admin?.cancel).toHaveBeenCalledWith(ID, 'owner-login')
    vi.mocked(admin!.cancel).mockResolvedValueOnce(status({ state: 'done' }))
    expect(await cancelAnnouncement(null, form({ id: ID }))).toEqual({ ok: false, message: 'It had already finished: nothing changed.' })
    vi.mocked(admin!.cancel).mockResolvedValueOnce(null)
    expect(await cancelAnnouncement(null, form({ id: ID }))).toEqual({ ok: false, message: 'n8builds-web has no such announcement.' })
    expect(await cancelAnnouncement(null, form({ id: 'a1; drop' }))).toEqual({ ok: false, message: 'Unknown announcement.' })
  })

  it('say so when n8builds-web isn\'t connected', async () => {
    admin = null
    expect(await startAnnouncement(null, form(good))).toEqual({ ok: false, message: 'n8builds-web is not connected to this server.' })
  })
})

describe('not connected and the fixture', () => {
  it('treats a service binding with nothing behind it as not connected', () => {
    expect(isUnreachableBinding(new Error('Worker "n8builds-web" not found. Make sure it is running locally.'))).toBe(true)
    expect(isUnreachableBinding(new Error('The RPC receiver does not implement the method "projects".'))).toBe(true)
    expect(isUnreachableBinding(new Error('D1_ERROR: no such table'))).toBe(false)
    expect(isUnreachableBinding('nope')).toBe(false)
  })

  it('uses the made-up n8builds-web only in a local E2E build with ANNOUNCE_FIXTURE set', () => {
    vi.stubEnv('ANNOUNCE_FIXTURE', '1')
    vi.stubEnv('ADMIN_E2E_BUILD', '')
    expect(announceFixtureEnabled()).toBe(false)
    vi.stubEnv('ADMIN_E2E_BUILD', '1')
    expect(announceFixtureEnabled()).toBe(true)
    vi.stubEnv('ANNOUNCE_FIXTURE', 'empty')
    expect(announceFixtureEnabled()).toBe(true)
    vi.stubEnv('ANNOUNCE_FIXTURE', 'yes')
    expect(announceFixtureEnabled()).toBe(false)
    vi.stubEnv('ANNOUNCE_FIXTURE', '1')
    vi.stubEnv('APP_ENV', 'production')
    expect(announceFixtureEnabled()).toBe(false)
  })
})
