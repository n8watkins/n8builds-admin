import { getAllAppStats, type AppStatsResult, type AppStatsTone } from '@/lib/app-stats'
import { formatNumber, timeAgo } from '@/lib/format'
import { CARD, Dot, ExternalAction, Meter, StatusPill, cx, type Tone } from './ui'

/**
 * One card per app that reports its own admin numbers (lib/app-stats.ts,
 * docs/APP-STATS.md). Totals only; every action is a link to the app's admin.
 */

const PILL: Record<AppStatsTone, Tone> = { good: 'good', warn: 'warn', bad: 'bad', quiet: 'idle' }
const PILL_TEXT: Record<AppStatsTone, string> = { good: 'Fine', warn: 'Check', bad: 'Failing', quiet: 'Fine' }
const JOB: Record<string, Tone> = { ok: 'good', failed: 'bad', running: 'running', never: 'idle' }

function AppStatsCard({ result }: { result: AppStatsResult }) {
  const { source } = result
  return (
    <article aria-label={source.name} data-testid={`app-stats-${source.app}`} className={cx(CARD, 'flex min-w-0 flex-col p-6 sm:p-7')}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h3 className="truncate text-[17px] font-semibold text-slate-50">{source.name}</h3>
        {result.state === 'ok' ? (
          <StatusPill tone={PILL[result.stats.tile.tone]}>{PILL_TEXT[result.stats.tile.tone]}</StatusPill>
        ) : (
          <StatusPill tone={result.state === 'error' ? 'warn' : 'idle'}>{result.state === 'error' ? 'Unreachable' : 'Not connected'}</StatusPill>
        )}
      </div>
      {result.state === 'ok' ? (
        <>
          <p className="mt-4 text-[36px] leading-tight font-semibold tracking-tight text-slate-50 tabular-nums">
            {formatNumber(result.stats.tile.headline.value)}
            <span className="ml-2 text-[15px] font-normal text-slate-400">{result.stats.tile.headline.label}</span>
          </p>
          <p className="mt-1 text-[15px] text-slate-200">{result.stats.tile.note}</p>
          {result.stats.tile.meter && (
            <div className="mt-4 space-y-1.5">
              <p className="flex justify-between text-[14px] text-slate-400">
                <span>{result.stats.tile.meter.label}</span>
                <span className="tabular-nums">
                  {formatNumber(result.stats.tile.meter.value)} / {formatNumber(result.stats.tile.meter.limit)}
                </span>
              </p>
              <Meter value={result.stats.tile.meter.value} max={result.stats.tile.meter.limit} label={result.stats.tile.meter.label} />
            </div>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2 text-[14px]">
            {result.stats.totals.map((total) => (
              <div key={total.key} className="min-w-0">
                <dt className="truncate text-slate-400">{total.label}</dt>
                <dd className="font-semibold text-slate-100 tabular-nums">{formatNumber(total.value)}</dd>
              </div>
            ))}
            <div className="min-w-0">
              <dt className="truncate text-slate-400">Errors, {result.stats.errors.windowHours} h</dt>
              <dd className={cx('font-semibold tabular-nums', result.stats.errors.count > 0 ? 'text-amber-200' : 'text-slate-100')}>{formatNumber(result.stats.errors.count)}</dd>
            </div>
          </dl>
          {result.stats.jobs.length > 0 && (
            <ul className="mt-5 space-y-1.5 text-[14px]">
              {result.stats.jobs.map((job) => (
                <li key={job.key} className="flex min-w-0 items-center gap-2">
                  <Dot tone={JOB[job.status] ?? 'idle'} label={job.status} />
                  <span className="truncate text-slate-200">{job.label}</span>
                  <span className="ml-auto shrink-0 text-slate-400">{job.lastRunAt ? timeAgo(job.lastRunAt) : 'never run'}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 truncate font-mono text-[13px] text-slate-400">
            {result.stats.deploy.version}
            {result.stats.deploy.deployedAt && `, deployed ${timeAgo(result.stats.deploy.deployedAt)}`}
          </p>
        </>
      ) : (
        <p className="mt-4 text-[15px] text-slate-300">
          {result.state === 'error' ? result.message : `Needs the ${source.binding} service binding (the Cloudflare Worker).`}
        </p>
      )}
      <div className="mt-auto pt-6">
        <ExternalAction href={source.adminUrl} describe={`Open the ${source.name} admin`}>
          {source.name} admin
        </ExternalAction>
      </div>
    </article>
  )
}

export async function AppStatsCards() {
  const results = await getAllAppStats()
  return (
    <section aria-labelledby="apps-title" className="mt-12">
      <h2 id="apps-title" className="mb-4 text-[17px] font-semibold text-slate-50">
        Apps
      </h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {results.map((result) => (
          <AppStatsCard key={result.source.app} result={result} />
        ))}
      </div>
    </section>
  )
}
