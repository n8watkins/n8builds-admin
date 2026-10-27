/** A small inline trend line with a soft fill (server-rendered SVG, no chart library). */
export function Sparkline({ values, label, color = 'var(--color-cyan-400)', height = 48 }: { values: (number | null)[]; label: string; color?: string; height?: number }) {
  const points = values.map((value, index) => ({ value, index })).filter((point): point is { value: number; index: number } => point.value !== null)
  if (points.length < 2) return <p className="text-[14px] text-slate-400">Needs two days of data for a trend.</p>
  const min = Math.min(...points.map((point) => point.value))
  const max = Math.max(...points.map((point) => point.value))
  const width = 240
  const x = (index: number) => (index / Math.max(1, values.length - 1)) * width
  const y = (value: number) => height - 3 - ((value - min) / Math.max(1, max - min)) * (height - 6)
  const line = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const area = `${line} L${x(last.index).toFixed(1)},${height} L${x(first.index).toFixed(1)},${height} Z`
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
