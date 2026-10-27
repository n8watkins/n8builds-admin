import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LOCAL_ONLY_VARS, SETUP_INTRO, SETUP_ITEMS } from '@/lib/setup'
import { renderSetupMarkdown } from '@/lib/setup-markdown'

describe('docs/SETUP.md', () => {
  it('matches lib/setup.ts (run `npm run setup:docs` after changing it)', () => {
    const onDisk = readFileSync(fileURLToPath(new URL('../../docs/SETUP.md', import.meta.url)), 'utf8')
    expect(onDisk).toBe(renderSetupMarkdown(SETUP_INTRO, SETUP_ITEMS, LOCAL_ONLY_VARS))
  })

  it('never uses the em dash', () => {
    expect(renderSetupMarkdown(SETUP_INTRO, SETUP_ITEMS, LOCAL_ONLY_VARS)).not.toContain('\u2014')
  })
})
