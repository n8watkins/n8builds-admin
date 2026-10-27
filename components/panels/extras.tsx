import { LuGithub } from 'react-icons/lu'
import { formatNumber, timeAgo } from '@/lib/format'
import { getDependabotAlerts, getLatestDeployments, getLatestRelease, getMonthActivity, isGitHubConnected } from '@/lib/github'
import { STATUS_PAGE, getDemoStatus } from '@/lib/openping'
import { TRACKED_REPOS, shortName, vercelProjectUrl } from '@/lib/repos'
import { Actions, BarList, Dot, ExternalAction, OutLink, PanelError, Stat, StatusPill, cx, errorMessage, type Tone } from '../ui'
import { GitHubNotConnected } from './github'

function stateTone(state: string): Tone {
  if (state === 'operational' || state === 'up' || state === 'success') return 'good'
  if (state === 'down' || state === 'failure' || state === 'error') return 'bad'
  if (state === 'degraded' || state === 'maintenance' || state === 'pending' || state === 'in_progress' || state === 'queued') return 'warn'
  return 'idle'
}

const BAR: Record<string, string> = {
  up: 'bg-emerald-400',
  down: 'bg-rose-400',
  degraded: 'bg-amber-300',
  none: 'bg-white/[0.08]',
}

const DEMO_STATE: Record<string, string> = {
  operational: 'Online',
  degraded: 'Slow',
  down: 'Down',
  maintenance: 'Maintenance',
  suspended: 'Asleep',
  scheduled_off: 'Asleep',
}

// ---------------------------------------------------------------------------
// Live demos

export async function DemoStatus() {
  let feed
  try {
    feed = await getDemoStatus()
  } catch (error) {
    return <PanelError message={errorMessage(error)} />
  }
  return (
    <div className="flex flex-col gap-8">
      <ul className="space-y-7">
        {feed.services.map((service) => {
          const tone = feed.offHours ? 'idle' : stateTone(service.state)
          return (
            <li key={service.name}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[17px] font-semibold text-slate-50">{service.name}</p>
                <div className="flex items-center gap-3">
                  {service.uptime90d !== null && <span className="text-[14px] text-slate-400 tabular-nums">{service.uptime90d.toFixed(1)}% uptime, 90 days</span>}
                  <StatusPill tone={tone}>{feed.offHours ? 'Asleep (off-hours)' : (DEMO_STATE[service.state] ?? service.state)}</StatusPill>
                </div>
              </div>
              <div className="flex h-8 gap-[3px]" role="img" aria-label={`${service.name}: the last 30 days of uptime`}>
                {service.bars.map((bar) => (
                  <span key={bar.date} title={`${bar.date}: ${bar.uptimePct === null ? 'scheduled off' : `${bar.uptimePct}% up`}`} className={cx('flex-1 rounded-[3px]', BAR[bar.state] ?? BAR.none)} />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[13px] text-slate-400">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-[14px] text-slate-400">{feed.updatedAt ? `OpenPing last checked ${timeAgo(feed.updatedAt)}.` : ''} Grey days are scheduled off-hours; amber days had slow responses.</p>
      <Actions>
        <ExternalAction href={STATUS_PAGE} variant="primary">
          Open the status page
        </ExternalAction>
        <ExternalAction href="https://openping.n8builds.dev">Open OpenPing</ExternalAction>
        <ExternalAction href="https://portfolio.n8builds.dev">See the demos on the portfolio</ExternalAction>
      </Actions>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Deploys, releases and activity

export async function LatestDeploys() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const result = await getLatestDeployments(8)
  if (!result.ok) return <PanelError message={result.message} />
  return (
    <ul className="-my-2 divide-y divide-white/[0.06]">
      {result.data.map((deploy) => {
        const project = vercelProjectUrl(deploy.repo)
        const production = deploy.environment.toLowerCase().startsWith('production')
        return (
          <li key={`${deploy.repo}-${deploy.sha}-${deploy.createdAt}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
            <Dot tone={stateTone(deploy.state ?? '')} label={deploy.state ?? 'unknown'} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-slate-50">
                {shortName(deploy.repo)}{' '}
                <span className={cx('ml-1 rounded-md px-2 py-0.5 text-[13px] font-medium', production ? 'bg-teal-400/15 text-teal-200' : 'bg-white/[0.06] text-slate-300')}>{deploy.environment}</span>
              </p>
              <p className="mt-0.5 text-[14px] text-slate-400">
                <span className="font-mono">{deploy.sha}</span> · {timeAgo(deploy.createdAt)}
              </p>
            </div>
            <span className="flex gap-4 text-[14px]">
              {deploy.url && <OutLink href={deploy.url}>Open deploy</OutLink>}
              {project && <OutLink href={project}>Vercel</OutLink>}
            </span>
          </li>
        )
      })}
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
    <div className="flex flex-col gap-5">
      <ul className="-my-2 divide-y divide-white/[0.06]">
        {released.map((release) => (
          <li key={release.repo} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-[15px] font-medium text-slate-50">{shortName(release.repo)}</p>
              <p className="text-[14px] text-slate-400">{timeAgo(release.publishedAt)}</p>
            </div>
            <OutLink href={release.url} className="rounded-lg bg-teal-400/12 px-3 py-1.5 font-mono text-[14px] text-teal-100 hover:bg-teal-400/20 hover:text-teal-50">
              {release.tag}
            </OutLink>
          </li>
        ))}
      </ul>
      {none.length > 0 && <p className="text-[14px] leading-relaxed text-slate-400">No releases yet: {none.join(', ')}.</p>}
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
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-6">
        <Stat label={`Commits in ${month}`} value={`${formatNumber(commits)}${capped ? '+' : ''}`} hint="on default branches" />
        <Stat label="Releases" value={releases} hint={`in ${month}`} />
      </div>
      <BarList
        rows={result.data.filter((row) => row.commits > 0).slice(0, 6).map((row) => ({ label: shortName(row.repo), value: row.commits }))}
        format={(value) => (value >= 100 ? '100+' : String(value))}
      />
      <Actions>
        <ExternalAction href="https://n8builds.dev/builds">Open the build log</ExternalAction>
      </Actions>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Security alerts

export async function SecurityAlerts() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const rows = await Promise.all(TRACKED_REPOS.map(async (tracked) => ({ tracked, alerts: await getDependabotAlerts(tracked.repo) })))
  const open = rows.reduce((sum, { alerts }) => sum + (alerts.ok && typeof alerts.data === 'number' ? alerts.data : 0), 0)
  const off = rows.filter(({ alerts }) => alerts.ok && alerts.data === 'disabled').length
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6">
        <Stat label="Open alerts" value={open} tone={open > 0 ? 'bad' : 'good'} hint="where alerts are on" />
        <Stat label="Repos with alerts off" value={`${off} of ${rows.length}`} tone={off > 0 ? 'warn' : 'good'} hint={off > 0 ? 'these report nothing' : 'every repo is covered'} />
      </div>
      <ul className="-my-2 divide-y divide-white/[0.06]">
        {rows.map(({ tracked, alerts }) => {
          const disabled = alerts.ok && alerts.data === 'disabled'
          const count = alerts.ok && typeof alerts.data === 'number' ? alerts.data : null
          return (
            <li key={tracked.repo} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-slate-50">{shortName(tracked.repo)}</p>
                <p className="text-[14px] text-slate-400">{tracked.label}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!alerts.ok ? (
                  <StatusPill tone="idle">Couldn&apos;t read</StatusPill>
                ) : disabled ? (
                  <>
                    <StatusPill tone="warn">Alerts off</StatusPill>
                    <ExternalAction href={`https://github.com/${tracked.repo}/settings/security_analysis`} icon={LuGithub}>
                      Turn on alerts
                    </ExternalAction>
                  </>
                ) : count && count > 0 ? (
                  <>
                    <StatusPill tone="bad">{count} open</StatusPill>
                    <ExternalAction href={`https://github.com/${tracked.repo}/security/dependabot`} variant="primary">
                      Review alerts
                    </ExternalAction>
                  </>
                ) : (
                  <StatusPill tone="good">No open alerts</StatusPill>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
