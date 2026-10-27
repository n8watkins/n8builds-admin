import Link from 'next/link'
import { getSummaries, type Summary, type Tone } from '@/lib/overview'
import { allSetupStatuses } from '@/lib/setup-status'
import { cx } from './ui'

const HEADLINE: Record<Tone, string> = {
  bad: 'text-rose-300',
  warn: 'text-amber-200',
  good: 'text-slate-50',
  quiet: 'text-slate-50',
  off: 'text-slate-450',
}

const DOT: Record<Tone, string> = {
  bad: 'bg-rose-400',
  warn: 'bg-amber-300',
  good: 'bg-emerald-400',
  quiet: 'bg-transparent',
  off: 'bg-transparent',
}

/** A not-connected area: one quiet line, not a big grey headline. */
function OffCard({ summary }: { summary: Summary }) {
  return (
    <Link href={summary.href} className="group flex items-center justify-between gap-3 rounded-2xl bg-white/[0.015] px-6 py-4 transition-colors hover:bg-white/[0.04]">
      <span className="min-w-0">
        <span className="block text-[14px] text-slate-300">{summary.label}</span>
        <span className="block truncate text-[13px] text-slate-475">{summary.detail}</span>
      </span>
      <span aria-hidden className="text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300">
        →
      </span>
    </Link>
  )
}

function SummaryCard({ summary, prominent }: { summary: Summary; prominent?: boolean }) {
  return (
    <Link
      href={summary.href}
      className={cx(
        'group flex min-w-0 flex-col rounded-2xl p-5 transition-colors sm:p-6',
        prominent
          ? summary.tone === 'bad'
            ? 'bg-rose-400/[0.06] hover:bg-rose-400/[0.09]'
            : 'bg-amber-300/[0.05] hover:bg-amber-300/[0.08]'
          : 'bg-white/[0.025] hover:bg-white/[0.045]',
      )}>
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] text-slate-400">
          {(summary.tone === 'bad' || summary.tone === 'warn' || summary.tone === 'good') && (
            <span aria-hidden className={cx('size-1.5 rounded-full', DOT[summary.tone])} />
          )}
          {summary.label}
        </span>
        <span aria-hidden className="text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300">
          →
        </span>
      </span>
      <span className={cx('mt-3 font-semibold tracking-tight tabular-nums', prominent ? 'text-[28px]' : 'text-2xl', HEADLINE[summary.tone])}>{summary.headline}</span>
      {summary.detail && <span className="mt-1 truncate text-[13px] text-slate-450">{summary.detail}</span>}
    </Link>
  )
}

export async function OverviewCards() {
  const [summaries, setup] = await Promise.all([getSummaries(), allSetupStatuses()])
  const attention = summaries.filter((summary) => summary.tone === 'bad' || summary.tone === 'warn').sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1))
  const live = summaries.filter((summary) => summary.tone === 'good' || summary.tone === 'quiet')
  const off = summaries.filter((summary) => summary.tone === 'off')
  const checkable = setup.filter(({ status }) => status.state !== 'manual')
  const done = checkable.filter(({ status }) => status.state === 'done').length
  return (
    <div className="space-y-12">
      {attention.length > 0 && (
        <section aria-labelledby="attention">
          <h2 id="attention" className="mb-4 text-[13px] font-medium text-slate-300">
            Needs attention
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {attention.map((summary) => (
              <SummaryCard key={summary.label} summary={summary} prominent />
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="all-quiet">
        <h2 id="all-quiet" className="mb-4 text-[13px] font-medium text-slate-300">
          {attention.length > 0 ? 'Everything else' : 'All quiet'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {live.map((summary) => (
            <SummaryCard key={summary.label} summary={summary} />
          ))}
        </div>
      </section>
      {(off.length > 0 || done < checkable.length) && (
        <section aria-labelledby="not-connected">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="not-connected" className="text-[13px] font-medium text-slate-300">
              Not connected yet
            </h2>
            <Link href="/setup" className="text-[13px] font-medium text-cyan-300 hover:text-cyan-200">
              Setup: {done} of {checkable.length} done →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {off.map((summary) => (
              <OffCard key={summary.label} summary={summary} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 9 }, (_, index) => (
        <div key={index} className="h-[132px] animate-pulse rounded-2xl bg-white/[0.025]" />
      ))}
    </div>
  )
}
