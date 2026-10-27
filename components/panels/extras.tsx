import { LuGithub } from 'react-icons/lu'
import { formatNumber, timeAgo } from '@/lib/format'
import { getAlertSeverities, getDependabotAlerts, getMonthActivity, isGitHubConnected } from '@/lib/github'
import { STATUS_PAGE, getDemoStatus } from '@/lib/openping'
import { TRACKED_REPOS, shortName } from '@/lib/repos'
import { Actions, BarList, ExternalAction, OutLink, PanelError, Stat, StatusPill, cx, errorMessage, type Tone } from '../ui'
import { ProjectIcon } from '../ProjectIcon'
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
        <ExternalAction href={STATUS_PAGE} variant="primary" describe="Open the OpenPing status page">
          Status page
        </ExternalAction>
        <ExternalAction href="https://openping.n8builds.dev" describe="Open OpenPing">
          OpenPing
        </ExternalAction>
        <ExternalAction href="https://portfolio.n8builds.dev" describe="See the demos on the developer portfolio">
          Portfolio
        </ExternalAction>
      </Actions>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Deploys, releases and activity

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
        <ExternalAction href="https://n8builds.dev/builds" describe="Open the build log on n8builds.dev">
          Build log
        </ExternalAction>
      </Actions>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Security alerts

export async function SecurityAlerts() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const rows = await Promise.all(
    TRACKED_REPOS.map(async (tracked) => {
      const [alerts, severity] = await Promise.all([getDependabotAlerts(tracked.repo), getAlertSeverities(tracked.repo)])
      return { tracked, alerts, severity }
    }),
  )
  // Most alerts first.
  rows.sort((a, b) => (b.alerts.ok && typeof b.alerts.data === 'number' ? b.alerts.data : -1) - (a.alerts.ok && typeof a.alerts.data === 'number' ? a.alerts.data : -1))
  const totals = rows.reduce((sum, { severity }) => ({ critical: sum.critical + (severity?.critical ?? 0), high: sum.high + (severity?.high ?? 0) }), { critical: 0, high: 0 })
  const open = rows.reduce((sum, { alerts }) => sum + (alerts.ok && typeof alerts.data === 'number' ? alerts.data : 0), 0)
  const off = rows.filter(({ alerts }) => alerts.ok && alerts.data === 'disabled').length
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6">
        <Stat label="Open alerts" value={open} tone={open > 0 ? 'bad' : 'good'} hint={open > 0 ? `${totals.critical} critical, ${totals.high} high` : 'none right now'} />
        <Stat label="Repos covered" value={`${rows.length - off} of ${rows.length}`} tone={off > 0 ? 'warn' : 'good'} hint={off > 0 ? `${off} have alerts off and report nothing` : 'alerts are on everywhere'} />
      </div>
      {off === 0 && open === 0 && (
        <p className="text-[15px] leading-relaxed text-slate-300">
          Alerts are on for every repo and none are open. Right after alerts are switched on, GitHub can take a few minutes to scan; anything it finds shows up here within 5 minutes.
        </p>
      )}
      <ul className="-my-2 divide-y divide-white/[0.06]">
        {rows.map(({ tracked, alerts, severity }) => {
          const disabled = alerts.ok && alerts.data === 'disabled'
          const count = alerts.ok && typeof alerts.data === 'number' ? alerts.data : null
          return (
            <li key={tracked.repo} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <ProjectIcon repo={tracked.repo} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-slate-50">{tracked.label}</p>
                  <p className="truncate font-mono text-[13px] text-slate-400">{shortName(tracked.repo)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!alerts.ok ? (
                  <StatusPill tone="idle">Couldn&apos;t read</StatusPill>
                ) : disabled ? (
                  <>
                    <StatusPill tone="warn">Alerts off</StatusPill>
                    <ExternalAction href={`https://github.com/${tracked.repo}/settings/security_analysis`} icon={LuGithub} describe={`Turn on Dependabot alerts for ${shortName(tracked.repo)}`}>
                      Turn on
                    </ExternalAction>
                  </>
                ) : count && count > 0 ? (
                  <>
                    <span className="text-[14px] text-slate-400">{severity ? [severity.critical && `${severity.critical} critical`, severity.high && `${severity.high} high`].filter(Boolean).join(', ') : ''}</span>
                    <StatusPill tone={severity && severity.critical + severity.high > 0 ? 'bad' : 'warn'}>{count} open</StatusPill>
                    <ExternalAction href={`https://github.com/${tracked.repo}/security/dependabot`} variant="primary" describe={`Review ${shortName(tracked.repo)} alerts on GitHub`}>
                      Alerts
                    </ExternalAction>
                  </>
                ) : (
                  <>
                    <StatusPill tone="good">Alerts on, none open</StatusPill>
                    <OutLink href={`https://github.com/${tracked.repo}/security/dependabot`} className="text-[14px]">
                      Dependabot
                    </OutLink>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
