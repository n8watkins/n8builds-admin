import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { countByProject, toRow } = await import('@/lib/waitlist')

const fields = (extra: Record<string, string> = {}) => ({
  email: 'a@example.com',
  projects: 'relink,strollz',
  requested: '',
  note: '42',
  requestedNote: '',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  confirmedAt: '2026-11-01T10:05:00.000Z',
  interest: 'relink',
  referrer: 'https://getrelink.dev/',
  token: 't',
  ...extra,
})

describe('waitlist rows', () => {
  it('reads an entry hash as written by n8builds-web', () => {
    expect(toRow('id1', fields())).toMatchObject({ id: 'id1', email: 'a@example.com', projects: ['relink', 'strollz'], requested: [], note: '42' })
    expect(toRow('id1', null)).toBeNull()
  })

  it('counts only confirmed sign-ups per project', () => {
    const rows = [toRow('1', fields())!, toRow('2', fields({ email: 'b@example.com', projects: '', requested: 'vibelog', confirmedAt: '' }))!]
    expect(countByProject(rows).map((c) => [c.slug, c.confirmed, c.emails])).toEqual([
      ['relink', 1, ['a@example.com']],
      ['strollz', 1, ['a@example.com']],
      ['vibelog', 0, []],
    ])
  })
})
