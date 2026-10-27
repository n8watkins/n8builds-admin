import { AREAS } from '@/lib/areas'
import { getSummaries, type Summary, type Tone } from '@/lib/overview'
import { allSetupStatuses } from '@/lib/setup-status'
import { Actions, AreaIcon, CARD, ExternalAction, InternalAction, StatusPill, cx, type Tone as PillTone } from './ui'

const HEADLINE: Record<Tone, string> = {
  bad: 'text-rose-300',
  warn: 'text-amber-200',
  good: 'text-emerald-300',
  quiet: 'text-slate-50',
  off: 'text-slate-400',
}

const PILL: Record<Tone, PillTone> = { bad: 'bad', warn: 'warn', good: 'good', quiet: 'idle', off: 'idle' }

function SummaryCard({ summary, prominent }: { summary: Summary; prominent?: boolean }) {
  const area = AREAS[summary.area]
  return (
    <article
      className={cx(
        CARD,
        'flex min-w-0 flex-col p-6 sm:p-7',
        prominent && summary.tone === 'bad' && 'bg-[#1a0f1d] ring-rose-400/25',
        prominent && summary.tone === 'warn' && 'bg-[#1a160f] ring-amber-300/20',
      )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AreaIcon area={area} />
          <h3 className="text-[17px] font-semibold text-slate-50">{summary.label ?? area.label}</h3>
        </div>
        {summary.tone !== 'quiet' && <StatusPill tone={PILL[summary.tone]}>{summary.status}</StatusPill>}
      </div>
      <p className={cx('mt-6 text-[40px] leading-none font-semibold tracking-tight tabular-nums', HEADLINE[summary.tone])}>{summary.headline}</p>
      <p className="mt-3 text-[15px] text-slate-200">{summary.detail}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{area.summary}</p>
      <Actions className="mt-auto pt-6">
        {summary.action && (
          <ExternalAction href={summary.action.href} variant={prominent ? 'primary' : 'secondary'}>
            {summary.action.label}
          </ExternalAction>
        )}
        <InternalAction href={area.href} variant={summary.action ? 'quiet' : 'secondary'}>
          Details
        </InternalAction>
      </Actions>
    </article>
  )
}

function OffCard({ summary }: { summary: Summary }) {
  const area = AREAS[summary.area]
  return (
    <article className={cx(CARD, 'flex min-w-0 flex-col p-6')}>
      <div className="flex items-center gap-3">
        <AreaIcon area={area} size="sm" />
        <h3 className="text-[16px] font-semibold text-slate-100">{area.label}</h3>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-400">{area.summary}</p>
      <p className="mt-2 text-[14px] text-slate-300">{summary.detail}.</p>
      <Actions className="mt-auto pt-5">
        <InternalAction href={area.href} variant="quiet">
          What it needs
        </InternalAction>
      </Actions>
    </article>
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
    <div className="space-y-14">
      {attention.length > 0 && (
        <section aria-labelledby="attention">
          <h2 id="attention" className="mb-5 flex items-center gap-3 text-[20px] font-semibold text-slate-50">
            Needs attention
            <span className="rounded-full bg-rose-400/15 px-2.5 py-0.5 text-[14px] font-medium text-rose-200">{attention.length}</span>
          </h2>
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {attention.map((summary) => (
              <SummaryCard key={summary.key} summary={summary} prominent />
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="all-good">
        <h2 id="all-good" className="mb-5 text-[20px] font-semibold text-slate-50">
          {attention.length > 0 ? 'Everything else' : 'All good'}
        </h2>
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {live.map((summary) => (
            <SummaryCard key={summary.key} summary={summary} />
          ))}
        </div>
      </section>
      {(off.length > 0 || done < checkable.length) && (
        <section aria-labelledby="not-connected">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="not-connected" className="text-[20px] font-semibold text-slate-50">
                Not connected yet
              </h2>
              <p className="mt-1 text-[15px] text-slate-400">These need an account or a token you create once. Setup lists every step.</p>
            </div>
            <InternalAction href="/setup" variant="primary">
              Setup: {done} of {checkable.length} done
            </InternalAction>
          </div>
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
            {off.map((summary) => (
              <OffCard key={summary.key} summary={summary} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-[260px] animate-pulse rounded-2xl bg-white/[0.03]" />
      ))}
    </div>
  )
}
