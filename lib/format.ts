const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' })

/** "3 hr. ago", "yesterday". */
export function timeAgo(iso: string | number, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

const integer = new Intl.NumberFormat('en-US')

export function formatNumber(value: number): string {
  return integer.format(Math.round(value))
}

export function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return minutes > 0 ? `${minutes}m ${rest.toString().padStart(2, '0')}s` : `${rest}s`
}
