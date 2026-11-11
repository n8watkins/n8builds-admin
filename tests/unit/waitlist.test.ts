import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { countByProject, projectName, toRow } = await import('@/lib/waitlist')

const subscriber = (id: string, extra: Partial<Parameters<typeof toRow>[0]> = {}) => ({
  id,
  email: `${id}@example.com`,
  note: '42',
  requested_note: '',
  interest: 'asset-arsenal',
  referrer: 'https://example.com/',
  created_at: '2026-11-01T10:00:00.000Z',
  confirmed_at: '2026-11-01T10:05:00.000Z' as string | null,
  ...extra,
})
const project = (subscriber_id: string, slug: string, status: 'requested' | 'confirmed' = 'confirmed') => ({ subscriber_id, project: slug, status })

describe('waitlist rows', () => {
  it("reads a subscriber with its own projects, as n8builds-web writes them", () => {
    const projects = [project('a', 'asset-arsenal'), project('a', 'strollz'), project('a', 'vibelog', 'requested'), project('b', 'feelium')]
    expect(toRow(subscriber('a'), projects)).toEqual({
      id: 'a',
      email: 'a@example.com',
      projects: ['asset-arsenal', 'strollz'],
      requested: ['vibelog'],
      note: '42',
      requestedNote: '',
      createdAt: '2026-11-01T10:00:00.000Z',
      confirmedAt: '2026-11-01T10:05:00.000Z',
      interest: 'asset-arsenal',
      referrer: 'https://example.com/',
    })
    expect(toRow(subscriber('c', { confirmed_at: null }), projects)).toMatchObject({ projects: [], requested: [], confirmedAt: '' })
  })

  it('counts only confirmed sign-ups per project', () => {
    const projects = [project('a', 'asset-arsenal'), project('a', 'strollz'), project('b', 'vibelog', 'requested'), project('c', 'keysready'), project('d', 'feelium')]
    const rows = [
      toRow(subscriber('a'), projects),
      toRow(subscriber('b', { confirmed_at: null }), projects),
      toRow(subscriber('c', { interest: 'keysready' }), projects),
      toRow(subscriber('d', { interest: 'feelium' }), projects),
    ]
    expect(countByProject(rows).map((c) => [c.slug, c.confirmed, c.emails])).toEqual([
      ['strollz', 1, ['a@example.com']],
      ['vibelog', 0, []],
      ['keysready', 1, ['c@example.com']],
      ['asset-arsenal', 1, ['a@example.com']],
      ['feelium', 1, ['d@example.com']],
    ])
  })

  it('names every n8builds.dev project, KeysReady included, and shows an unknown slug as itself', () => {
    expect(projectName('keysready')).toBe('KeysReady')
    expect(projectName('asset-arsenal')).toBe('Asset Arsenal')
    expect(projectName('vibelog')).toBe('VibeLog')
    expect(projectName('feelium')).toBe('Feelium')
    expect(projectName('someday')).toBe('someday')
  })
})
