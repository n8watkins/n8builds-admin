import { describe, expect, it } from 'vitest'
import { releaseSummary } from '@/lib/release-notes'

describe('releaseSummary', () => {
  it('skips headings and empty lines and strips list markers, bold and links', () => {
    expect(releaseSummary('## What changed\n\n- **Faster** builds, see [the PR](https://x.test/1)\n- more')).toBe('Faster builds, see the PR')
  })

  it('skips the Full Changelog line and returns null when nothing is left', () => {
    expect(releaseSummary('**Full Changelog**: https://github.com/a/b/compare/v1...v2')).toBeNull()
    expect(releaseSummary(null)).toBeNull()
    expect(releaseSummary('')).toBeNull()
  })

  it('shortens long lines', () => {
    const line = releaseSummary('x'.repeat(200))
    expect(line).toHaveLength(140)
    expect(line?.endsWith('...')).toBe(true)
  })
})
