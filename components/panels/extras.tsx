import { formatNumber, timeAgo } from '@/lib/format'
import { getDependabotAlerts, getLatestDeployments, getLatestRelease, getMonthActivity, isGitHubConnected } from '@/lib/github'
import { STATUS_PAGE, getDemoStatus } from '@/lib/openping'
import { TRACKED_REPOS, shortName } from '@/lib/repos'
import { BarList, Dot, PanelError, cx, errorMessage, type Tone } from '../ui'
import { GitHubNotConnected } from './github'

function stateTone(state: string): Tone {
  if (state === 'operational' || state === 'up' || state === 'success') return 'good'
  if (state === 'down' || state === 'failure' || state === 'error') return 'bad'
  if (state === 'degraded' || state === 'maintenance' || state === 'pending' || state === 'in_progress' || state === 'queued') return 'warn'
  return 'idle'
}

const BAR: Record<string, string> = {
  up: 'bg-emerald-400/80',
  down: 'bg-rose-400/90',
  degraded: 'bg-amber-300/90',
  none: 'bg-white/[0.07]',
}

export async function DemoStatus() {
  let feed
  try {
    feed = await getDemoStatus()
  } catch (error) {
    return <PanelError message={errorMessage(error)} />
  }
  return (
    <div className="flex flex-1 flex-col gap-3">
      <ul className="space-y-3">
        {feed.services.map((service) => (
          <li key={service.name}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
              <span className="flex items-center gap-2 font-medium text-slate-100">
                <Dot tone={feed.offHours ? 'idle' : stateTone(service.state)} />
                {service.name}
              </span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {feed.offHours ? 'asleep' : service.state} {service.uptime90d !== null && <span className="text-slate-475">· {service.uptime90d.toFixed(1)}% 90d</span>}
              </span>
            </div>
            <div className="flex h-4 gap-px" role="img" aria-label={`${service.name}: last 30 days of uptime`}>
              {service.bars.map((bar) => (
                <span key={bar.date} title={`${bar.date}: ${bar.uptimePct === null ? 'not checked' : `${bar.uptimePct}%`}`} className={cx('flex-1 rounded-[2px]', BAR[bar.state] ?? BAR.none)} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-auto text-xs text-slate-475">
        {feed.updatedAt ? `Checked ${timeAgo(feed.updatedAt)}. ` : ''}Grey days are scheduled off-hours.{' '}
        <a href={STATUS_PAGE} target="_blank" rel="noreferrer" className="text-cyan-300/90 hover:text-cyan-200">
          Status page
        </a>
      </p>
    </div>
  )
}

export async function LatestDeploys() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const result = await getLatestDeployments(7)
  if (!result.ok) return <PanelError message={result.message} />
  return (
    <ul className="-mx-2 divide-y divide-white/[0.04]">
      {result.data.map((deploy) => (
        <li key={`${deploy.repo}-${deploy.sha}-${deploy.createdAt}`} className="flex items-center gap-2.5 px-2 py-2 text-[13px]">
          <Dot tone={stateTone(deploy.state ?? '')} label={deploy.state ?? 'unknown'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-slate-100">
              {deploy.url ? (
                <a href={deploy.url} target="_blank" rel="noreferrer" className="hover:text-cyan-300">
                  {shortName(deploy.repo)}
                </a>
              ) : (
                shortName(deploy.repo)
              )}{' '}
              <span className={cx('text-xs', deploy.environment.toLowerCase().startsWith('production') ? 'text-cyan-300' : 'text-slate-450')}>{deploy.environment}</span>
            </p>
            <p className="truncate font-mono text-[11px] text-slate-475">
              {deploy.sha}
              {deploy.ref && !deploy.ref.startsWith(deploy.sha) ? ` · ${deploy.ref}` : ''}
            </p>
          </div>
          <span className="shrink-0 text-xs text-slate-450">{timeAgo(deploy.createdAt)}</span>
        </li>
      ))}
    </ul>
  )
}

export async function LatestReleases() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const rows = await Promise.all(TRACKED_REPOS.map(async ({ repo }) => ({ repo, release: await getLatestRelease(repo) })))
  const released = rows
    .flatMap(({ repo, release }) => (release.ok && release.data ? [{ repo, ...release.data }] : []))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const none = rows.filter(({ release }) => release.ok && !release.data).map(({ repo }) => shortName(repo))
  return (
    <div className="flex flex-1 flex-col">
      <ul className="-mx-2 divide-y divide-white/[0.04]">
        {released.map((release) => (
          <li key={release.repo} className="flex items-center justify-between gap-3 px-2 py-2 text-[13px]">
            <span className="min-w-0 truncate text-slate-100">{shortName(release.repo)}</span>
            <span className="flex shrink-0 items-center gap-2">
              <a href={release.url} target="_blank" rel="noreferrer" className="rounded bg-cyan-400/10 px-1.5 font-mono text-xs text-cyan-200 hover:bg-cyan-400/20">
                {release.tag}
              </a>
              <span className="w-20 text-right text-xs text-slate-450">{timeAgo(release.publishedAt)}</span>
            </span>
          </li>
        ))}
      </ul>
      {none.length > 0 && <p className="mt-auto pt-3 text-xs text-slate-475">No releases yet: {none.join(', ')}</p>}
    </div>
  )
}

export async function SecurityAlerts() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const rows = await Promise.all(TRACKED_REPOS.map(async ({ repo }) => ({ repo, alerts: await getDependabotAlerts(repo) })))
  const open = rows.reduce((sum, { alerts }) => sum + (alerts.ok && typeof alerts.data === 'number' ? alerts.data : 0), 0)
  const disabled = rows.filter(({ alerts }) => alerts.ok && alerts.data === 'disabled').map(({ repo }) => shortName(repo))
  const failed = rows.filter(({ alerts }) => !alerts.ok)
  const withAlerts = rows.filter(({ alerts }) => alerts.ok && typeof alerts.data === 'number' && alerts.data > 0)
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className={cx('text-[26px] leading-tight font-semibold tabular-nums', open === 0 ? 'text-emerald-300' : 'text-rose-300')}>{open}</span>
        <span className="text-[13px] text-slate-400">open Dependabot alerts</span>
      </div>
      {withAlerts.length > 0 && (
        <BarList
          rows={withAlerts.map(({ repo, alerts }) => ({ label: shortName(repo), value: alerts.ok && typeof alerts.data === 'number' ? alerts.data : 0 }))}
        />
      )}
      {disabled.length > 0 && (
        <p className="text-xs leading-relaxed text-amber-200/80">
          Alerts are turned off for {disabled.join(', ')}. Turn them on in each repo&apos;s Settings, Code security.
        </p>
      )}
      {failed.length > 0 && <p className="text-xs text-slate-475">Couldn&apos;t read {failed.map(({ repo }) => shortName(repo)).join(', ')}.</p>}
    </div>
  )
}

export async function MonthActivity() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const result = await getMonthActivity()
  if (!result.ok) return <PanelError message={result.message} />
  const commits = result.data.reduce((sum, row) => sum + row.commits, 0)
  const releases = result.data.reduce((sum, row) => sum + row.releases, 0)
  const capped = result.data.some((row) => row.capped)
  const month = new Date().toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex gap-6">
        <p className="text-[13px] text-slate-400">
          <span className="block text-[26px] leading-tight font-semibold text-slate-50 tabular-nums">
            {formatNumber(commits)}
            {capped ? '+' : ''}
          </span>
          commits in {month}
        </p>
        <p className="text-[13px] text-slate-400">
          <span className="block text-[26px] leading-tight font-semibold text-slate-50 tabular-nums">{releases}</span>
          releases
        </p>
      </div>
      <BarList
        rows={result.data.filter((row) => row.commits > 0).slice(0, 6).map((row) => ({ label: shortName(row.repo), value: row.commits }))}
        format={(value) => (value >= 100 ? '100+' : String(value))}
      />
      <p className="mt-auto text-xs text-slate-475">
        Default-branch commits, the raw feed behind{' '}
        <a href="https://n8builds.dev/builds" target="_blank" rel="noreferrer" className="text-cyan-300/90 hover:text-cyan-200">
          the build log
        </a>
        .
      </p>
    </div>
  )
}
