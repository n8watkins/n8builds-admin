/** The first line of release notes worth showing: no headings, links-only lines or empty lines. */
export function releaseSummary(body: string | null | undefined): string | null {
  for (const raw of (body ?? '').split('\n')) {
    const line = raw.replace(/^[\s*>-]+/, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // GitHub's generated notes end each line with "by @user in <PR URL>".
      .replace(/\s+by @\S+ in https?:\/\/\S+$/, '')
      .trim()
    if (!line || line.startsWith('#') || /^full changelog/i.test(line)) continue
    return line.length > 140 ? `${line.slice(0, 137)}...` : line
  }
  return null
}
