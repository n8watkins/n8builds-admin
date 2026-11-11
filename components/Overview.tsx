import Link from 'next/link'
import { LuCircleAlert, LuCircleCheck, LuPlug, LuTriangleAlert } from 'react-icons/lu'
import { AREAS, NAV_GROUPS, type AreaId } from '@/lib/areas'
import { getSummaries, type Summary, type Tone } from '@/lib/overview'
import { AreaIcon, Meter, cx } from './ui'

/*
 * The Overview: one row of "Needs attention" chips, then a dense grid of
 * small tiles, one per section, grouped like the sidebar. Every tile is a
 * link to its section; one not connected yet links to its Setup item.
 */

const NUMBER: Record<Tone, string> = {
  bad: 'text-rose-300',
  warn: 'text-amber-200',
  good: 'text-emerald-300',
  quiet: 'text-slate-50',
  off: 'text-slate-400',
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300'

/** The sidebar's groups, every one titled (the untitled Setup group takes its area's name). */
const GROUPS = NAV_GROUPS.filter((group) => !group.areas.includes('overview')).map((group) => ({
  title: group.title ?? AREAS[group.areas[0]].label,
  areas: group.areas,
}))

/**
 * A group spans as many columns as it has tiles (up to the row: 2 on phones,
 * 3 from md, 5 from xl), so small groups share a row. Tailwind needs the
 * class names spelled out.
 */
const SPAN: Record<number, string> = {
  1: 'col-span-1 md:col-span-1 xl:col-span-1',
  2: 'col-span-2 md:col-span-2 xl:col-span-2',
  3: 'col-span-2 md:col-span-3 xl:col-span-3',
  4: 'col-span-2 md:col-span-3 xl:col-span-4',
  5: 'col-span-2 md:col-span-3 xl:col-span-5',
}

function AttentionChip({ summary }: { summary: Summary }) {
  const area = AREAS[summary.area]
  const Icon = summary.tone === 'bad' ? LuCircleAlert : LuTriangleAlert
  return (
    <li>
      <Link
        href={area.href}
        title={summary.detail}
        className={cx(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset transition-colors',
          FOCUS,
          summary.tone === 'bad' ? 'bg-rose-400/15 text-rose-100 ring-rose-400/30 hover:bg-rose-400/25' : 'bg-amber-300/12 text-amber-100 ring-amber-300/30 hover:bg-amber-300/20',
        )}>
        <Icon aria-hidden className={cx('size-3.5', summary.tone === 'bad' ? 'text-rose-300' : 'text-amber-200')} />
        {area.label}: {summary.status}
      </Link>
    </li>
  )
}

function Attention({ summaries }: { summaries: Summary[] }) {
  const attention = summaries.filter((summary) => summary.tone === 'bad' || summary.tone === 'warn').sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1))
  if (attention.length === 0) {
    return (
      <p className="mb-6 flex items-center gap-2 text-[15px] font-medium text-emerald-300">
        <LuCircleCheck aria-hidden className="size-4" />
        All clear
      </p>
    )
  }
  return (
    <section aria-labelledby="attention-title" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 id="attention-title" className="text-[14px] font-semibold text-slate-200">
        Needs attention
      </h2>
      <ul className="flex flex-wrap gap-2">
        {attention.map((summary) => (
          <AttentionChip key={summary.key} summary={summary} />
        ))}
      </ul>
    </section>
  )
}

const TILE = 'flex min-w-0 flex-col gap-1.5 rounded-xl p-4 ring-1 ring-inset transition-colors'

function Tile({ summary }: { summary: Summary }) {
  const area = AREAS[summary.area]
  if (summary.tone === 'off') {
    // Not connected yet: dimmed, and it goes to the Setup item that connects it.
    return (
      <Link href={summary.setup ? `/setup#${summary.setup}` : '/setup'} data-testid={`tile-${area.id}`} className={cx(TILE, FOCUS, 'bg-white/[0.015] ring-white/[0.06] hover:bg-white/[0.04]')}>
        <span className="flex min-w-0 items-start gap-2 text-[14px] leading-6 font-medium text-slate-300">
          <span className="opacity-60 grayscale">
            <AreaIcon area={area} size="xs" />
          </span>
          <span className="min-w-0">{area.label}</span>
        </span>
        <span className="text-[13px] text-slate-400">{summary.detail}</span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-medium text-cyan-300">
          <LuPlug aria-hidden className="size-3.5" />
          Connect
        </span>
      </Link>
    )
  }
  return (
    <Link
      href={area.href}
      data-testid={`tile-${area.id}`}
      className={cx(
        TILE,
        FOCUS,
        'bg-[#0b1226] hover:bg-[#0e1730]',
        summary.tone === 'bad' ? 'ring-rose-400/30' : summary.tone === 'warn' ? 'ring-amber-300/25' : 'ring-white/[0.06]',
      )}>
      <span className="flex min-w-0 items-start gap-2 text-[14px] leading-6 font-medium text-slate-200">
        <AreaIcon area={area} size="xs" />
        <span className="min-w-0">{area.label}</span>
      </span>
      {/* A number reads large; a word state ("Unavailable") a size down, so it doesn't shout. */}
      <span className={cx('truncate leading-tight font-semibold tracking-tight tabular-nums', /^[\d\s,./%+-]+$/.test(summary.headline) ? 'text-[24px]' : 'text-[19px]', NUMBER[summary.tone])}>{summary.headline}</span>
      {summary.meter && <Meter size="sm" value={summary.meter.value} max={summary.meter.max} label={`${area.label}: ${summary.meter.value} of ${summary.meter.max}`} />}
      <span className="line-clamp-2 text-[13px] text-slate-400">{summary.detail}</span>
    </Link>
  )
}

function Grid({ summaries }: { summaries: Summary[] }) {
  const byArea = new Map<AreaId, Summary>(summaries.map((summary) => [summary.area, summary]))
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 xl:grid-cols-5">
      {GROUPS.map((group) => {
        const tiles = group.areas.flatMap((id) => byArea.get(id) ?? [])
        if (tiles.length === 0) return null
        const id = `group-${group.title.toLowerCase()}`
        return (
          <section key={group.title} aria-labelledby={id} className={cx('grid grid-cols-subgrid content-start gap-y-3', SPAN[Math.min(tiles.length, 5)])}>
            <h2 id={id} className="col-span-full text-[13px] font-semibold text-slate-400">
              {group.title}
            </h2>
            {tiles.map((summary) => (
              <Tile key={summary.key} summary={summary} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

export async function OverviewTiles() {
  const summaries = await getSummaries()
  return (
    <>
      <Attention summaries={summaries} />
      <Grid summaries={summaries} />
    </>
  )
}

export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 h-8 w-72 max-w-full animate-pulse rounded-full bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 14 }, (_, index) => (
          <div key={index} className="h-[124px] animate-pulse rounded-xl bg-white/[0.03]" />
        ))}
      </div>
    </div>
  )
}
