import { formatNumber } from '@/lib/format'
import { getOrgMinutes, getRepo, getRepoCi, getViews, isGitHubConnected } from '@/lib/github'
import { getDemoStatus } from '@/lib/openping'
import { APPTURNITY_ORG, FREE_ACTIONS_MINUTES, TRACKED_REPOS } from '@/lib/repos'
import { cx } from '../ui'
import { runTone } from './github'

function Tile({ label, value, hint, tone = 'plain' }: { label: string; value: string; hint: string; tone?: 'plain' | 'good' | 'bad' }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium tracking-wide text-slate-450 uppercase">{label}</p>
      <p className={cx('mt-1 text-[26px] leading-tight font-semibold tabular-nums', tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-50')}>{value}</p>
      <p className="truncate text-xs text-slate-450">{hint}</p>
    </div>
  )
}

export function TileSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <p className="text-[11px] font-medium tracking-wide text-slate-450 uppercase">{label}</p>
      <div className="mt-2 h-7 w-20 animate-pulse rounded-md bg-white/[0.05]" />
      <div className="mt-1.5 h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
    </div>
  )
}

const offline = (label: string) => <Tile label={label} value="-" hint="GitHub not connected" />

export async function StarsTile() {
  if (!isGitHubConnected()) return offline('Stars')
  const repos = await Promise.all(TRACKED_REPOS.map(({ repo }) => getRepo(repo)))
  const stars = repos.reduce((sum, repo) => sum + (repo.ok ? repo.data.stargazers_count : 0), 0)
  return <Tile label="Stars" value={formatNumber(stars)} hint={`${TRACKED_REPOS.length} public repos`} />
}

export async function ViewsTile() {
  if (!isGitHubConnected()) return offline('Repo views')
  const views = await Promise.all(TRACKED_REPOS.map(({ repo }) => getViews(repo)))
  const total = views.reduce((sum, view) => sum + (view.ok ? view.data.count : 0), 0)
  const uniques = views.reduce((sum, view) => sum + (view.ok ? view.data.uniques : 0), 0)
  return <Tile label="Views 14d" value={formatNumber(total)} hint={`${formatNumber(uniques)} unique`} />
}

export async function CiTile() {
  if (!isGitHubConnected()) return offline('CI')
  const ci = await Promise.all(TRACKED_REPOS.map(({ repo }) => getRepoCi(repo)))
  const runs = ci.flatMap((result) => (result.ok ? result.data.latestByWorkflow : []))
  const failing = runs.filter((run) => runTone(run) === 'bad').length
  return (
    <Tile
      label="CI"
      value={failing === 0 ? 'All green' : `${failing} failing`}
      hint={`${runs.length - failing} / ${runs.length} workflows green`}
      tone={failing === 0 ? 'good' : 'bad'}
    />
  )
}

export async function MinutesTile() {
  if (!isGitHubConnected()) return offline('Actions minutes')
  const org = await getOrgMinutes()
  if (!org.ok) return <Tile label="Org minutes" value="n/a" hint={org.message} />
  const usedUp = org.data.total >= FREE_ACTIONS_MINUTES
  return (
    <Tile
      label="Org minutes"
      value={formatNumber(org.data.total)}
      hint={usedUp ? `${APPTURNITY_ORG}: free 2,000 used` : `${APPTURNITY_ORG}, of ${formatNumber(FREE_ACTIONS_MINUTES)}`}
      tone={usedUp ? 'bad' : 'plain'}
    />
  )
}

export async function DemosTile() {
  const feed = await getDemoStatus().catch(() => null)
  if (!feed) return <Tile label="Live demos" value="n/a" hint="OpenPing feed unreachable" />
  if (feed.offHours) return <Tile label="Live demos" value="Asleep" hint="Off-hours: OpenPing isn't checking" />
  const down = feed.services.filter((service) => service.state === 'down').length
  return (
    <Tile
      label="Live demos"
      value={down === 0 ? `${feed.services.length} up` : `${down} down`}
      hint={`OpenPing: ${feed.overall}`}
      tone={down === 0 ? 'good' : 'bad'}
    />
  )
}
