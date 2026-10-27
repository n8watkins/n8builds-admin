import 'server-only'
import { formatNumber } from './format'
import { ga4Config, getTraffic } from './ga4'
import {
  getDependabotAlerts,
  getLatestDeployments,
  getLatestRelease,
  getOrgMinutes,
  getRepo,
  getRepoCi,
  getViews,
  isGitHubConnected,
  type WorkflowRun,
} from './github'
import { getDemoStatus } from './openping'
import { APPTURNITY_ORG, FREE_ACTIONS_MINUTES, TRACKED_REPOS, shortName } from './repos'
import { getSentrySummary, sentryConfig } from './sentry'
import { isStoreConnected, readDailyCounts, readDailyHashTotals, readSnapshots } from './store'

/**
 * One line per area for the Overview: a headline, a short detail and a tone.
 * `bad` and `warn` float to the top as "Needs attention"; the rest stay quiet.
 */
export type Tone = 'bad' | 'warn' | 'good' | 'quiet' | 'off'

export type Summary = { href: string; label: string; headline: string; detail: string; tone: Tone }

export function isFailing(run: Pick<WorkflowRun, 'status' | 'conclusion'>): boolean {
  return run.status === 'completed' && ['failure', 'timed_out', 'startup_failure'].includes(run.conclusion ?? '')
}

const notConnected = (href: string, label: string, detail: string): Summary => ({ href, label, headline: 'Not connected', detail, tone: 'off' })
const noGitHub = (href: string, label: string) => notConnected(href, label, 'Needs a GitHub token')

async function ci(): Promise<Summary> {
  const base = { href: '/ci', label: 'CI' }
  if (!isGitHubConnected()) return noGitHub(base.href, base.label)
  const results = await Promise.all(TRACKED_REPOS.map(({ repo }) => getRepoCi(repo)))
  const failingRepos = results.flatMap((result) => (result.ok && result.data.latestByWorkflow.some(isFailing) ? [shortName(result.data.repo)] : []))
  const runs = results.flatMap((result) => (result.ok ? result.data.latestByWorkflow : []))
  const failing = runs.filter(isFailing).length
  if (failing === 0) return { ...base, headline: 'All green', detail: `${runs.length} workflows on default branches`, tone: 'good' }
  return { ...base, headline: `${failing} failing`, detail: failingRepos.join(', '), tone: 'bad' }
}

async function minutes(): Promise<Summary> {
  const base = { href: '/minutes', label: 'Actions minutes' }
  if (!isGitHubConnected()) return noGitHub(base.href, base.label)
  const org = await getOrgMinutes()
  if (!org.ok) return { ...base, headline: 'Unavailable', detail: org.message, tone: 'warn' }
  const share = org.data.total / FREE_ACTIONS_MINUTES
  const headline = `${formatNumber(org.data.total)} / ${formatNumber(FREE_ACTIONS_MINUTES)}`
  if (share >= 1) return { ...base, headline, detail: `${APPTURNITY_ORG}: all free minutes used`, tone: 'bad' }
  if (share >= 0.7) return { ...base, headline, detail: `${APPTURNITY_ORG}: ${Math.round(share * 100)}% used`, tone: 'warn' }
  return { ...base, headline, detail: `${APPTURNITY_ORG} this month`, tone: 'quiet' }
}

async function stars(): Promise<Summary> {
  const base = { href: '/repos', label: 'Stars' }
  if (!isGitHubConnected()) return noGitHub(base.href, base.label)
  const repos = await Promise.all(TRACKED_REPOS.map(({ repo }) => getRepo(repo)))
  const total = repos.reduce((sum, repo) => sum + (repo.ok ? repo.data.stargazers_count : 0), 0)
  let detail = 'Weekly change once daily snapshots start'
  if (isStoreConnected()) {
    const snapshots = await readSnapshots(8).catch(() => [])
    const weekAgo = snapshots[0]
    if (weekAgo) {
      const change = total - Object.values(weekAgo.stars).reduce((sum, value) => sum + value, 0)
      detail = `${change >= 0 ? '+' : ''}${change} this week`
    }
  }
  return { ...base, headline: formatNumber(total), detail, tone: 'quiet' }
}

async function views(): Promise<Summary> {
  const base = { href: '/repos', label: 'Repo views 14d' }
  if (!isGitHubConnected()) return noGitHub(base.href, base.label)
  const results = await Promise.all(TRACKED_REPOS.map(({ repo }) => getViews(repo)))
  const total = results.reduce((sum, view) => sum + (view.ok ? view.data.count : 0), 0)
  const uniques = results.reduce((sum, view) => sum + (view.ok ? view.data.uniques : 0), 0)
  return { ...base, headline: formatNumber(total), detail: `${formatNumber(uniques)} unique visitors`, tone: 'quiet' }
}

async function demos(): Promise<Summary> {
  const base = { href: '/demos', label: 'Live demos' }
  const feed = await getDemoStatus()
  const total = feed.services.length
  if (feed.offHours) return { ...base, headline: 'Asleep', detail: 'Off-hours: OpenPing isn\'t checking', tone: 'quiet' }
  const down = feed.services.filter((service) => service.state === 'down').map((service) => service.name)
  if (down.length > 0) return { ...base, headline: `${down.length} down`, detail: down.join(', '), tone: 'bad' }
  const slow = feed.services.filter((service) => service.state === 'degraded').length
  if (slow > 0) return { ...base, headline: `${slow} slow`, detail: `${total - slow} of ${total} fully online`, tone: 'warn' }
  return { ...base, headline: `${total} / ${total} online`, detail: 'OpenPing', tone: 'good' }
}

async function errors(): Promise<Summary> {
  const base = { href: '/errors', label: 'Errors' }
  if (!sentryConfig()) return notConnected(base.href, base.label, 'Needs a Sentry read token')
  const summary = await getSentrySummary()
  const tone: Tone = summary.newThisWeek > 0 ? 'warn' : 'good'
  return { ...base, headline: `${summary.unresolved.length} unresolved`, detail: `${summary.newThisWeek} new this week`, tone }
}

async function traffic(): Promise<Summary> {
  const base = { href: '/traffic', label: 'Website traffic' }
  if (!ga4Config()) return notConnected(base.href, base.label, 'Needs Google Analytics access')
  const data = await getTraffic()
  return { ...base, headline: formatNumber(data.visitors), detail: 'visitors in 28 days', tone: 'quiet' }
}

async function referrals(): Promise<Summary> {
  const base = { href: '/referrals', label: 'Referrals to Appturnity' }
  if (!isStoreConnected()) return notConnected(base.href, base.label, 'Needs the analytics database')
  const days = await readDailyHashTotals('ref:appturnity', 30)
  const total = days.reduce((sum, day) => sum + day.total, 0)
  return total === 0
    ? { ...base, headline: 'No clicks yet', detail: 'Counter not added to n8builds-web yet', tone: 'off' }
    : { ...base, headline: formatNumber(total), detail: 'clicks in 30 days', tone: 'quiet' }
}

async function contact(): Promise<Summary> {
  const base = { href: '/contact', label: 'Contact messages' }
  if (!isStoreConnected()) return notConnected(base.href, base.label, 'Needs the analytics database')
  const days = await readDailyCounts('contact:sent', 30)
  const week = days.slice(-7).reduce((sum, day) => sum + day.count, 0)
  return { ...base, headline: formatNumber(week), detail: 'messages in 7 days', tone: 'quiet' }
}

async function releases(): Promise<Summary> {
  const base = { href: '/releases', label: 'Releases and deploys' }
  if (!isGitHubConnected()) return noGitHub(base.href, base.label)
  const [deploys, latest] = await Promise.all([
    getLatestDeployments(5),
    Promise.all(TRACKED_REPOS.map(async ({ repo }) => ({ repo, release: await getLatestRelease(repo) }))),
  ])
  const failed = deploys.ok ? deploys.data.filter((deploy) => deploy.state === 'failure' || deploy.state === 'error') : []
  const newest = latest
    .flatMap(({ repo, release }) => (release.ok && release.data ? [{ repo, ...release.data }] : []))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]
  if (failed.length > 0) return { ...base, headline: `${failed.length} failed deploy${failed.length > 1 ? 's' : ''}`, detail: failed.map((deploy) => shortName(deploy.repo)).join(', '), tone: 'bad' }
  return { ...base, headline: newest ? newest.tag : 'No releases', detail: newest ? `${shortName(newest.repo)}, latest release` : '', tone: 'quiet' }
}

async function security(): Promise<Summary> {
  const base = { href: '/security', label: 'Security alerts' }
  if (!isGitHubConnected()) return noGitHub(base.href, base.label)
  const results = await Promise.all(TRACKED_REPOS.map(({ repo }) => getDependabotAlerts(repo)))
  const open = results.reduce((sum, result) => sum + (result.ok && typeof result.data === 'number' ? result.data : 0), 0)
  const off = results.filter((result) => result.ok && result.data === 'disabled').length
  if (open > 0) return { ...base, headline: `${open} open`, detail: 'Dependabot alerts', tone: 'bad' }
  if (off > 0) return { ...base, headline: 'Alerts off', detail: `On ${off} of ${TRACKED_REPOS.length} repos; 0 open elsewhere`, tone: 'warn' }
  return { ...base, headline: '0 open', detail: 'Dependabot alerts', tone: 'good' }
}

/** Every area, in the sidebar's order. A failing source shows as a warning, never breaks the page. */
export async function getSummaries(): Promise<Summary[]> {
  const sources: [string, string, () => Promise<Summary>][] = [
    ['/ci', 'CI', ci],
    ['/minutes', 'Actions minutes', minutes],
    ['/repos', 'Stars', stars],
    ['/repos', 'Repo views 14d', views],
    ['/demos', 'Live demos', demos],
    ['/errors', 'Errors', errors],
    ['/traffic', 'Website traffic', traffic],
    ['/referrals', 'Referrals to Appturnity', referrals],
    ['/contact', 'Contact messages', contact],
    ['/releases', 'Releases and deploys', releases],
    ['/security', 'Security alerts', security],
  ]
  return Promise.all(
    sources.map(([href, label, load]) =>
      load().catch((error: unknown): Summary => ({ href, label, headline: 'Unavailable', detail: error instanceof Error ? error.message : 'Unknown error', tone: 'warn' })),
    ),
  )
}
