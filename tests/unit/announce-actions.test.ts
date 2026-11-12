import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnnounceAdmin } from '@/lib/announcements'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const requireOwner = vi.fn()
vi.mock('@/lib/auth/owner', () => ({ requireOwner: () => requireOwner() }))

let admin: AnnounceAdmin | null = null
vi.mock('@/lib/announcements', () => ({ announceAdmin: async () => admin }))

const { cancelAnnouncement, previewAnnouncement, sendTestAnnouncement, startAnnouncement } = await import('@/app/(dashboard)/announcements/actions')
const { announceFixtureEnabled } = await import('@/lib/announce-fixture')
const { isUnreachableBinding } = await import('@/lib/db')

function fakeAdmin(): AnnounceAdmin {
  return {
    projects: vi.fn(async () => []),
    templates: vi.fn(async () => [{ id: 'open' as const, name: 'Now open', fields: [{ key: 'headline', label: 'Headline', max: 20 }, { key: 'body', label: 'What is ready', max: 200 }] }]),
    preview: vi.fn(async () => ({ subject: 'Feelium: open', html: '<p>hi</p>', text: 'hi', recipients: 3 })),
    sendTest: vi.fn(async () => ({ ok: true, messageId: 'm1' })),
    start: vi.fn(async () => ({ id: 'a1' })),
    status: vi.fn(),
    list: vi.fn(async () => []),
    cancel: vi.fn(async () => ({ ok: true })),
  }
}

const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}
const good = { project: 'feelium', template: 'open', fields: JSON.stringify({ headline: ' Open now ', body: 'Try it today', extra: 'dropped' }) }

beforeEach(() => {
  admin = fakeAdmin()
  requireOwner.mockReset().mockResolvedValue({ login: 'owner-login', githubId: 1, expiresAt: 0, devBypass: false })
})

describe('announcement actions', () => {
  it('need the signed-in owner before anything else', async () => {
    requireOwner.mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(startAnnouncement(null, form(good))).rejects.toThrow('NEXT_REDIRECT')
    await expect(sendTestAnnouncement(null, form(good))).rejects.toThrow('NEXT_REDIRECT')
    await expect(cancelAnnouncement(null, form({ id: 'a1' }))).rejects.toThrow('NEXT_REDIRECT')
    await expect(previewAnnouncement({ project: 'feelium', template: 'open', fields: {} })).rejects.toThrow('NEXT_REDIRECT')
    expect(admin?.start).not.toHaveBeenCalled()
  })

  it('start with the owner as the actor, only the template\'s fields, trimmed', async () => {
    expect(await startAnnouncement(null, form(good))).toEqual({ ok: true, message: 'Started: it is going out now.' })
    expect(admin?.start).toHaveBeenCalledWith({ project: 'feelium', template: 'open', fields: { headline: 'Open now', body: 'Try it today' } }, 'owner-login')
  })

  it('send the test as the owner', async () => {
    expect(await sendTestAnnouncement(null, form(good))).toEqual({ ok: true, message: 'Test sent to your inbox.' })
    expect(admin?.sendTest).toHaveBeenCalledWith(expect.objectContaining({ project: 'feelium' }), 'owner-login')
    vi.mocked(admin!.sendTest).mockResolvedValue({ ok: false, code: 'day_cap', retryable: true })
    expect(await sendTestAnnouncement(null, form(good))).toEqual({ ok: false, message: 'Not sent: day cap. Try again in a moment.' })
  })

  it('refuse an empty or too-long field, an unknown template or project, before calling n8builds-web', async () => {
    expect(await startAnnouncement(null, form({ ...good, fields: JSON.stringify({ headline: 'Hi', body: ' ' }) }))).toEqual({ ok: false, message: 'What is ready is empty.' })
    expect(await startAnnouncement(null, form({ ...good, fields: JSON.stringify({ headline: 'x'.repeat(21), body: 'ok' }) }))).toEqual({ ok: false, message: 'Headline is longer than 20 characters.' })
    expect(await startAnnouncement(null, form({ ...good, template: 'launched' }))).toEqual({ ok: false, message: 'n8builds-web has no such template.' })
    expect(await startAnnouncement(null, form({ ...good, template: 'spam' }))).toEqual({ ok: false, message: 'Pick a template.' })
    expect(await startAnnouncement(null, form({ ...good, project: '../x' }))).toEqual({ ok: false, message: 'Pick a project.' })
    expect(await startAnnouncement(null, form({ ...good, fields: 'not json' }))).toEqual({ ok: false, message: 'The fields could not be read.' })
    expect(admin?.start).not.toHaveBeenCalled()
  })

  it('say when a project was announced too recently', async () => {
    vi.mocked(admin!.start).mockResolvedValue({ error: 'too_soon', nextAllowedAt: '2026-12-01T00:00:00Z' })
    expect(await startAnnouncement(null, form(good))).toEqual({ ok: false, message: 'Too soon: this project can be announced again on Dec 1.' })
  })

  it('cancel as the owner, keeping a numeric id a number', async () => {
    expect(await cancelAnnouncement(null, form({ id: '42', numeric: 'true' }))).toEqual({ ok: true, message: 'Cancelled: nothing more goes out.' })
    expect(admin?.cancel).toHaveBeenCalledWith(42, 'owner-login')
    await cancelAnnouncement(null, form({ id: 'a1', numeric: 'false' }))
    expect(admin?.cancel).toHaveBeenLastCalledWith('a1', 'owner-login')
    vi.mocked(admin!.cancel).mockResolvedValue({ ok: false, error: 'It has already finished' })
    expect(await cancelAnnouncement(null, form({ id: 'a1' }))).toEqual({ ok: false, message: 'It has already finished' })
    expect(await cancelAnnouncement(null, form({ id: 'a 1; drop' }))).toEqual({ ok: false, message: 'Unknown announcement.' })
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

  it('uses the made-up n8builds-web only in a local E2E build with ANNOUNCE_FIXTURE=1', () => {
    vi.stubEnv('ANNOUNCE_FIXTURE', '1')
    vi.stubEnv('ADMIN_E2E_BUILD', '')
    expect(announceFixtureEnabled()).toBe(false)
    vi.stubEnv('ADMIN_E2E_BUILD', '1')
    expect(announceFixtureEnabled()).toBe(true)
    vi.stubEnv('APP_ENV', 'production')
    expect(announceFixtureEnabled()).toBe(false)
  })
})
