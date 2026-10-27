import type { SetupItem, SetupVar } from './setup'

/**
 * docs/SETUP.md, rendered from lib/setup.ts (one sentence per line).
 * Pure, no imports at runtime, so scripts/gen-setup-docs.mjs can run it with Node.
 */
export function renderSetupMarkdown(intro: string[], items: SetupItem[], localOnly: SetupVar[]): string {
  const lines: string[] = [
    '<!-- Generated from lib/setup.ts by `npm run setup:docs`. Edit lib/setup.ts, not this file. -->',
    '',
    '# Setup: the owner\'s checklist',
    '',
    ...intro,
    'The dashboard\'s Setup page shows the same list with each item\'s live status.',
    '',
  ]
  items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.title}`, '', item.why, '')
    item.steps.forEach((step, stepIndex) => lines.push(`${stepIndex + 1}. ${step}`))
    if (item.vars.length > 0) {
      lines.push('', `Sets: ${item.vars.map((v) => `\`${v.name}\`${v.optional ? ' (optional)' : ''}`).join(', ')}.`)
    }
    lines.push('')
  })
  lines.push('## Environment variables', '', '| Variable | Step | Where |', '| --- | --- | --- |')
  items.forEach((item, index) => {
    for (const v of item.vars) lines.push(`| \`${v.name}\`${v.optional ? ' (optional)' : ''} | ${index + 1} | ${v.where} |`)
  })
  for (const v of localOnly) lines.push(`| \`${v.name}\` | - | ${v.where} |`)
  lines.push('')
  return lines.join('\n')
}
