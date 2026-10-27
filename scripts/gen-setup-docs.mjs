// Writes docs/SETUP.md from lib/setup.ts (Node strips the TypeScript types).
import { writeFileSync } from 'node:fs'
import { LOCAL_ONLY_VARS, SETUP_INTRO, SETUP_ITEMS } from '../lib/setup.ts'
import { renderSetupMarkdown } from '../lib/setup-markdown.ts'

writeFileSync(new URL('../docs/SETUP.md', import.meta.url), renderSetupMarkdown(SETUP_INTRO, SETUP_ITEMS, LOCAL_ONLY_VARS))
console.log('docs/SETUP.md updated from lib/setup.ts')
