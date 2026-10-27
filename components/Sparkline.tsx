/** A small inline trend line (server-rendered SVG, no chart library). */
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const points = values.map((value, index) => ({ value, index })).filter((point): point is { value: number; index: number } => point.value !== null)
  if (points.length < 2) return <p className="text-[14px] text-slate-400">Needs two days of data for a trend.</p>
  const min = Math.min(...points.map((point) => point.value))
  const max = Math.max(...points.map((point) => point.value))
  const width = 240
  const height = 48
  const x = (index: number) => (index / Math.max(1, values.length - 1)) * width
  const y = (value: number) => height - 4 - ((value - min) / Math.max(1, max - min)) * (height - 8)
  const line = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-12 w-full">
      <path d={line} fill="none" stroke="var(--color-cyan-400)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
