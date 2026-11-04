import 'server-only'
import { unstable_cache } from 'next/cache'
import type { AreaId } from './areas'
import { REVALIDATE_SECONDS } from './cache'
import { formatNumber } from './format'
import { ga4Config, getTraffic } from './ga4'
import { getDependabotAlerts, getLatestDeployments, getOrgMinutes, getRepoCi, isGitHubConnected, type WorkflowRun } from './github'
import { getDemoStatus } from './openping'
import { APPTURNITY_ORG, FREE_ACTIONS_MINUTES, TRACKED_REPOS, shortName } from './repos'
import { getSentrySummary, sentryConfig } from './sentry'
import { isAnalyticsConnected, readDailyCounts, readDailyFieldTotals } from './store'

/**
 * One headline per area for the Overview. It reads only what each headline
 * needs (no detail data), and the whole list is cached for five minutes and
 * served stale while it refreshes, so the Overview is fast after the first
 * load. `bad` and `warn` float to the top as "Needs attention".
 */
export type Tone = 'bad' | 'warn' | 'good' | 'quiet' | 'off'

export type Summary = {
  area: AreaId
  /** A second card for the same area (Stars and Views share a page). */
  key: string
  label?: string
  headline: string
  detail: string
  /** Short state, shown as a pill. */
  status: string
  tone: Tone
  /** The one most useful place to go outside the admin. */
  action?: { label: string; href: string; describe: string }
}

/** The slowest source may not hold up the whole Overview on a cold cache. */
const SOURCE_TIMEOUT_MS = 6000

export function isFailing(run: Pick<WorkflowRun, 'status' | 'conclusion'>): boolean {
  return run.status === 'completed' && ['failure', 'timed_out', 'startup_failure'].includes(run.conclusion ?? '')
}

const notConnected = (area: AreaId, detail: string): Summary => ({ area, key: area, headline: 'Not connected', detail, status: 'Not connected', tone: 'off' })

async function ci(): Promise<Summary> {
  if (!isGitHubConnected()) return notConnected('ci', 'Needs a GitHub token')
  const results = await Promise.all(TRACKED_REPOS.map(({ repo }) => getRepoCi(repo)))
  const runs = results.flatMap((result) => (result.ok ? result.data.latestByWorkflow : []))
  const failingRuns = runs.filter(isFailing)
  const failingRepos = results.flatMap((result) => (result.ok && result.data.latestByWorkflow.some(isFailing) ? [shortName(result.data.repo)] : []))
  if (failingRuns.length === 0) return { area: 'ci', key: 'ci', headline: 'All passing', detail: `${runs.length} workflows across ${TRACKED_REPOS.length} repos`, status: 'Passing', tone: 'good' }
  return {
    area: 'ci',
    key: 'ci',
    headline: `${failingRuns.length} failing`,
    detail: `In ${failingRepos.join(', ')}`,
    status: 'Failing',
    tone: 'bad',
    action: { label: 'Failing run', href: failingRuns[0].url, describe: `Open the failing ${failingRuns[0].workflow} run on GitHub` },
  }
}

async function minutes(): Promise<Summary> {
  if (!isGitHubConnected()) return notConnected('minutes', 'Needs a GitHub token')
  const org = await getOrgMinutes()
  if (!org.ok) return { area: 'minutes', key: 'minutes', headline: 'Unavailable', detail: org.message, status: 'Error', tone: 'warn' }
  const share = org.data.total / FREE_ACTIONS_MINUTES
  const action = { label: 'Billing', href: `https://github.com/organizations/${APPTURNITY_ORG}/settings/billing`, describe: 'Open Appturnity billing on GitHub' }
  const base = { area: 'minutes' as const, key: 'minutes', headline: `${formatNumber(org.data.total)} / ${formatNumber(FREE_ACTIONS_MINUTES)}`, action }
  if (share >= 1) return { ...base, detail: `${APPTURNITY_ORG} has used all its free minutes this month`, status: 'Used up', tone: 'bad' }
  if (share >= 0.7) return { ...base, detail: `${APPTURNITY_ORG} has used ${Math.round(share * 100)}% this month`, status: 'Running low', tone: 'warn' }
  return { ...base, detail: `${APPTURNITY_ORG} minutes used this month`, status: 'Fine', tone: 'quiet' }
}

async function demos(): Promise<Summary> {
  const feed = await getDemoStatus()
  const total = feed.services.length
  const action = { label: 'Status page', href: 'https://openping.n8builds.dev/status', describe: 'Open the OpenPing status page' }
  if (feed.offHours) return { area: 'demos', key: 'demos', headline: 'Asleep', detail: 'Off-hours: OpenPing isn\'t checking right now', status: 'Off-hours', tone: 'quiet', action }
  const down = feed.services.filter((service) => service.state === 'down').map((service) => service.name)
  if (down.length > 0) return { area: 'demos', key: 'demos', headline: `${down.length} down`, detail: down.join(', '), status: 'Down', tone: 'bad', action }
  const slow = feed.services.filter((service) => service.state === 'degraded').length
  if (slow > 0) return { area: 'demos', key: 'demos', headline: `${slow} slow`, detail: `${total - slow} of ${total} fully online`, status: 'Slow', tone: 'warn', action }
  return { area: 'demos', key: 'demos', headline: `${total} / ${total} online`, detail: feed.services.map((service) => service.name).join(', '), status: 'Online', tone: 'good', action }
}

async function errors(): Promise<Summary> {
  if (!sentryConfig()) return notConnected('errors', 'Needs a Sentry read-only token')
  const summary = await getSentrySummary()
  return {
    area: 'errors',
    key: 'errors',
    headline: `${summary.unresolved.length} unresolved`,
    detail: `${summary.newThisWeek} new this week`,
    status: summary.newThisWeek > 0 ? 'New issues' : 'Calm',
    tone: summary.newThisWeek > 0 ? 'warn' : 'good',
    action: { label: 'Sentry', href: `https://${summary.org}.sentry.io/issues/`, describe: 'View the issues on Sentry' },
  }
}

async function traffic(): Promise<Summary> {
  if (!ga4Config()) return notConnected('traffic', 'Needs Google Analytics access')
  const data = await getTraffic()
  return { area: 'traffic', key: 'traffic', headline: formatNumber(data.visitors), detail: 'visitors in the last 28 days', status: '28 days', tone: 'quiet', action: { label: 'Analytics', href: 'https://analytics.google.com/analytics/web/', describe: 'Open Google Analytics' } }
}

async function referrals(): Promise<Summary> {
  if (!(await isAnalyticsConnected())) return notConnected('referrals', 'Needs the analytics database and a counter on n8builds.dev')
  const days = await readDailyFieldTotals('ref:techforpros', 30)
  const total = days.reduce((sum, day) => sum + day.total, 0)
  return total === 0
    ? { area: 'referrals', key: 'referrals', headline: 'No clicks yet', detail: 'None to techforpros.com in 30 days', status: '30 days', tone: 'off' }
    : { area: 'referrals', key: 'referrals', headline: formatNumber(total), detail: 'clicks to techforpros.com in 30 days', status: '30 days', tone: 'quiet' }
}

async function game(): Promise<Summary> {
  if (!(await isAnalyticsConnected())) return notConnected('game', 'Needs the analytics database (n8builds-analytics)')
  const days = await readDailyFieldTotals('game:rounds', 30)
  const started = days.reduce((sum, day) => sum + Object.entries(day.byField).filter(([field]) => field.startsWith('start:')).reduce((s, [, v]) => s + v, 0), 0)
  return started === 0
    ? { area: 'game', key: 'game', headline: 'No rounds yet', detail: 'Nobody has played the dino game yet', status: 'Waiting', tone: 'off' }
    : { area: 'game', key: 'game', headline: formatNumber(started), detail: 'dino game rounds in 30 days', status: '30 days', tone: 'quiet' }
}

async function contact(): Promise<Summary> {
  if (!(await isAnalyticsConnected())) return notConnected('contact', 'Needs the analytics database and a counter on n8builds.dev')
  const days = await readDailyCounts('contact:sent', 30)
  const week = days.slice(-7).reduce((sum, day) => sum + day.count, 0)
  return { area: 'contact', key: 'contact', headline: formatNumber(week), detail: 'messages in the last 7 days', status: '7 days', tone: 'quiet' }
}

async function releases(): Promise<Summary> {
  if (!isGitHubConnected()) return notConnected('releases', 'Needs a GitHub token')
  const deploys = await getLatestDeployments(5)
  if (!deploys.ok) return { area: 'releases', key: 'releases', headline: 'Unavailable', detail: deploys.message, status: 'Error', tone: 'warn' }
  const failed = deploys.data.filter((deploy) => deploy.state === 'failure' || deploy.state === 'error')
  if (failed.length > 0) {
    return { area: 'releases', key: 'releases', headline: `${failed.length} failed`, detail: `Deploys of ${[...new Set(failed.map((deploy) => shortName(deploy.repo)))].join(', ')}`, status: 'Failed deploy', tone: 'bad' }
  }
  const newest = deploys.data[0]
  return {
    area: 'releases',
    key: 'releases',
    headline: 'Deploys OK',
    detail: newest
      ? `Latest: ${shortName(newest.repo)} (${newest.environment}), ${new Date(newest.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })} PT`
      : 'No deploys yet',
    status: 'Healthy',
    tone: 'good',
  }
}

async function security(): Promise<Summary> {
  if (!isGitHubConnected()) return notConnected('security', 'Needs a GitHub token')
  const results = await Promise.all(TRACKED_REPOS.map(({ repo }) => getDependabotAlerts(repo)))
  const open = results.reduce((sum, result) => sum + (result.ok && typeof result.data === 'number' ? result.data : 0), 0)
  const off = results.filter((result) => result.ok && result.data === 'disabled').length
  if (open > 0) return { area: 'security', key: 'security', headline: `${open} open`, detail: 'Dependabot alerts across the repos, worst first on the page', status: 'To review', tone: 'bad' }
  if (off > 0) return { area: 'security', key: 'security', headline: `Off on ${off} of ${TRACKED_REPOS.length}`, detail: 'Repos with Dependabot alerts turned off report nothing', status: 'Alerts off', tone: 'warn' }
  return { area: 'security', key: 'security', headline: '0 open', detail: 'Dependabot alerts', status: 'Covered', tone: 'good' }
}

/**
 * Each headline is cached on its own (five minutes, then refreshed in the
 * background), so one slow or failing source never holds back or poisons the
 * others. A source slower than SOURCE_TIMEOUT_MS on a cold cache shows as
 * "Still loading" this time; its request keeps running and fills the cache.
 */
function cachedSource(key: string, load: () => Promise<Summary>) {
  return unstable_cache(load, ['overview', key], { revalidate: REVALIDATE_SECONDS })
}

function withTimeout(area: AreaId, key: string, load: () => Promise<Summary>): Promise<Summary> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<Summary>((resolve) => {
    timer = setTimeout(() => resolve({ area, key, headline: 'Still loading', detail: 'This source is slow right now; open the page for details', status: 'Slow source', tone: 'warn' }), SOURCE_TIMEOUT_MS)
  })
  const loaded = load()
    .catch((error: unknown): Summary => ({ area, key, headline: 'Unavailable', detail: error instanceof Error ? error.message : 'Unknown error', status: 'Error', tone: 'warn' }))
    .finally(() => clearTimeout(timer))
  return Promise.race([loaded, timeout])
}

const SOURCES: [AreaId, string, () => Promise<Summary>][] = [
  ['ci', 'ci', cachedSource('ci', ci)],
  ['minutes', 'minutes', cachedSource('minutes', minutes)],
  ['releases', 'releases', cachedSource('releases', releases)],
  ['security', 'security', cachedSource('security', security)],
  ['demos', 'demos', cachedSource('demos', demos)],
  ['errors', 'errors', cachedSource('errors', errors)],
  ['traffic', 'traffic', cachedSource('traffic', traffic)],
  ['referrals', 'referrals', cachedSource('referrals', referrals)],
  ['contact', 'contact', cachedSource('contact', contact)],
  ['game', 'game', cachedSource('game', game)],
]

/** Every headline, in the sidebar's order. */
export async function getSummaries(): Promise<Summary[]> {
  return Promise.all(SOURCES.map(([area, key, load]) => withTimeout(area, key, load)))
}
