import 'server-only'
import { unstable_cache } from 'next/cache'
import type { AreaId } from './areas'
import { REVALIDATE_SECONDS } from './cache'
import { formatNumber, timeAgo } from './format'
import { ga4Config, getTraffic } from './ga4'
import { getDependabotAlerts, getLatestDeployments, getOrgMinutes, getRepo, getRepoCi, getStarDates, isGitHubConnected, type WorkflowRun } from './github'
import { appName, getEmailUsage } from './mailroom'
import { getDemoStatus } from './openping'
import { APPTURNITY_ORG, FREE_ACTIONS_MINUTES, TRACKED_REPOS, shortName } from './repos'
import { getSentrySummary, sentryConfig } from './sentry'
import { allSetupStatuses } from './setup-status'
import { isAnalyticsConnected, readDailyCounts, readDailyFieldTotals } from './store'
import { isWaitlistConnected, readWaitlist } from './waitlist'

/**
 * One tile per area for the Overview. It reads only what each headline needs
 * (no detail data), and each remote source is cached for five minutes and
 * served stale while it refreshes, so the Overview is fast after the first
 * load. `bad` and `warn` also show as "Needs attention" chips; `off` means
 * not connected yet.
 */
export type Tone = 'bad' | 'warn' | 'good' | 'quiet' | 'off'

export type Summary = {
  area: AreaId
  key: string
  /** The one number (or short state) the tile shows. */
  headline: string
  /** A short note under it. */
  detail: string
  /** A short state, the text of the "Needs attention" chip. */
  status: string
  tone: Tone
  /** Usage against an allowance (Actions minutes, emails), drawn as a small meter. */
  meter?: { value: number; max: number }
  /** For a section not connected yet: the Setup item that connects it (its id on /setup). */
  setup?: string
}

/** The slowest source may not hold up the whole Overview on a cold cache. */
const SOURCE_TIMEOUT_MS = 6000

export function isFailing(run: Pick<WorkflowRun, 'status' | 'conclusion'>): boolean {
  return run.status === 'completed' && ['failure', 'timed_out', 'startup_failure'].includes(run.conclusion ?? '')
}

const notConnected = (area: AreaId, detail: string, setup?: string): Summary => ({ area, key: area, headline: 'Not connected', detail, status: 'Not connected', tone: 'off', setup })

async function ci(): Promise<Summary> {
  if (!isGitHubConnected()) return notConnected('ci', 'Needs a GitHub token', 'github')
  const results = await Promise.all(TRACKED_REPOS.map(({ repo }) => getRepoCi(repo)))
  const runs = results.flatMap((result) => (result.ok ? result.data.latestByWorkflow : []))
  const failingRuns = runs.filter(isFailing)
  const failingRepos = results.flatMap((result) => (result.ok && result.data.latestByWorkflow.some(isFailing) ? [shortName(result.data.repo)] : []))
  if (failingRuns.length === 0) return { area: 'ci', key: 'ci', headline: 'All passing', detail: `${runs.length} workflows, ${TRACKED_REPOS.length} repos`, status: 'Passing', tone: 'good' }
  return { area: 'ci', key: 'ci', headline: `${failingRuns.length} failing`, detail: `In ${failingRepos.join(', ')}`, status: `${failingRuns.length} failing`, tone: 'bad' }
}

async function minutes(): Promise<Summary> {
  if (!isGitHubConnected()) return notConnected('minutes', 'Needs a GitHub token', 'github')
  const org = await getOrgMinutes()
  if (!org.ok) return { area: 'minutes', key: 'minutes', headline: 'Unavailable', detail: org.message, status: 'Unavailable', tone: 'warn' }
  const share = org.data.total / FREE_ACTIONS_MINUTES
  const base = { area: 'minutes' as const, key: 'minutes', headline: formatNumber(org.data.total), meter: { value: org.data.total, max: FREE_ACTIONS_MINUTES } }
  const detail = `of ${formatNumber(FREE_ACTIONS_MINUTES)} this month, ${APPTURNITY_ORG}`
  if (share >= 1) return { ...base, detail, status: 'Used up', tone: 'bad' }
  if (share >= 0.7) return { ...base, detail, status: `${Math.round(share * 100)}% used`, tone: 'warn' }
  return { ...base, detail, status: 'Fine', tone: 'quiet' }
}

async function repos(): Promise<Summary> {
  if (!isGitHubConnected()) return notConnected('repos', 'Needs a GitHub token', 'github')
  const [info, starDates] = await Promise.all([Promise.all(TRACKED_REPOS.map(({ repo }) => getRepo(repo))), Promise.all(TRACKED_REPOS.map(({ repo }) => getStarDates(repo)))])
  const total = info.reduce((sum, repo) => sum + (repo.ok ? repo.data.stargazers_count : 0), 0)
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const gained = starDates.reduce((sum, dates) => sum + (dates.ok ? dates.data.filter((date) => date > since).length : 0), 0)
  return { area: 'repos', key: 'repos', headline: formatNumber(total), detail: `stars, +${formatNumber(gained)} in 30 days`, status: 'Fine', tone: 'quiet' }
}

async function mailroom(): Promise<Summary> {
  const usage = await getEmailUsage()
  if (!usage) return notConnected('mailroom', 'Needs the MAILROOM binding')
  if (!usage.ok) return { area: 'mailroom', key: 'mailroom', headline: 'Unavailable', detail: usage.message, status: 'Unavailable', tone: 'warn' }
  const { accountMonth, monthlyIncluded, apps } = usage.data
  const share = monthlyIncluded > 0 ? accountMonth / monthlyIncluded : 0
  const paused = apps.filter((app) => app.paused).map((app) => appName(app.app))
  const base = { area: 'mailroom' as const, key: 'mailroom', headline: formatNumber(accountMonth), meter: { value: accountMonth, max: monthlyIncluded } }
  const detail = `of ${formatNumber(monthlyIncluded)} emails this month`
  if (share >= 1) return { ...base, detail: `Over the ${formatNumber(monthlyIncluded)} included`, status: 'Over the included', tone: 'bad' }
  if (paused.length > 0) return { ...base, detail: `Paused: ${paused.join(', ')}`, status: 'Paused', tone: 'warn' }
  if (share >= 0.7) return { ...base, detail, status: `${Math.round(share * 100)}% used`, tone: 'warn' }
  return { ...base, detail, status: 'Fine', tone: 'quiet' }
}

async function demos(): Promise<Summary> {
  const feed = await getDemoStatus()
  const total = feed.services.length
  if (feed.offHours) return { area: 'demos', key: 'demos', headline: 'Asleep', detail: 'Off-hours, on purpose', status: 'Off-hours', tone: 'quiet' }
  const down = feed.services.filter((service) => service.state === 'down').map((service) => service.name)
  if (down.length > 0) return { area: 'demos', key: 'demos', headline: `${down.length} down`, detail: down.join(', '), status: `${down.length} down`, tone: 'bad' }
  const slow = feed.services.filter((service) => service.state === 'degraded').length
  if (slow > 0) return { area: 'demos', key: 'demos', headline: `${slow} slow`, detail: `${total - slow} of ${total} fully online`, status: `${slow} slow`, tone: 'warn' }
  return { area: 'demos', key: 'demos', headline: `${total} / ${total}`, detail: 'online now', status: 'Online', tone: 'good' }
}

async function errors(): Promise<Summary> {
  if (!sentryConfig()) return notConnected('errors', 'Needs a Sentry token', 'sentry')
  const summary = await getSentrySummary()
  return {
    area: 'errors',
    key: 'errors',
    headline: formatNumber(summary.unresolved.length),
    detail: `unresolved, ${summary.newThisWeek} new this week`,
    status: `${summary.newThisWeek} new`,
    tone: summary.newThisWeek > 0 ? 'warn' : 'good',
  }
}

async function traffic(): Promise<Summary> {
  if (!ga4Config()) return notConnected('traffic', 'Needs Google Analytics access', 'ga4')
  const data = await getTraffic()
  return { area: 'traffic', key: 'traffic', headline: formatNumber(data.visitors), detail: 'visitors, last 28 days', status: 'Fine', tone: 'quiet' }
}

async function referrals(): Promise<Summary> {
  if (!(await isAnalyticsConnected())) return notConnected('referrals', 'Needs the analytics database', 'databases')
  const days = await readDailyFieldTotals('ref:techforpros', 30)
  const total = days.reduce((sum, day) => sum + day.total, 0)
  return { area: 'referrals', key: 'referrals', headline: formatNumber(total), detail: 'clicks, last 30 days', status: 'Fine', tone: 'quiet' }
}

async function game(): Promise<Summary> {
  if (!(await isAnalyticsConnected())) return notConnected('game', 'Needs the analytics database', 'databases')
  const days = await readDailyFieldTotals('game:rounds', 30)
  const started = days.reduce((sum, day) => sum + Object.entries(day.byField).filter(([field]) => field.startsWith('start:')).reduce((s, [, v]) => s + v, 0), 0)
  return { area: 'game', key: 'game', headline: formatNumber(started), detail: 'rounds, last 30 days', status: 'Fine', tone: 'quiet' }
}

async function contact(): Promise<Summary> {
  if (!(await isAnalyticsConnected())) return notConnected('contact', 'Needs the analytics database', 'databases')
  const days = await readDailyCounts('contact:sent', 30)
  const week = days.slice(-7).reduce((sum, day) => sum + day.count, 0)
  return { area: 'contact', key: 'contact', headline: formatNumber(week), detail: 'messages, last 7 days', status: 'Fine', tone: 'quiet' }
}

async function releases(): Promise<Summary> {
  if (!isGitHubConnected()) return notConnected('releases', 'Needs a GitHub token', 'github')
  const deploys = await getLatestDeployments(5)
  if (!deploys.ok) return { area: 'releases', key: 'releases', headline: 'Unavailable', detail: deploys.message, status: 'Unavailable', tone: 'warn' }
  const failed = deploys.data.filter((deploy) => deploy.state === 'failure' || deploy.state === 'error')
  if (failed.length > 0) {
    return { area: 'releases', key: 'releases', headline: `${failed.length} failed`, detail: `Deploys of ${[...new Set(failed.map((deploy) => shortName(deploy.repo)))].join(', ')}`, status: `${failed.length} failed deploys`, tone: 'bad' }
  }
  const newest = deploys.data[0]
  return { area: 'releases', key: 'releases', headline: 'Deploys OK', detail: newest ? `Latest: ${shortName(newest.repo)}, ${timeAgo(newest.createdAt)}` : 'No deploys yet', status: 'Healthy', tone: 'good' }
}

async function security(): Promise<Summary> {
  if (!isGitHubConnected()) return notConnected('security', 'Needs a GitHub token', 'github')
  const results = await Promise.all(TRACKED_REPOS.map(({ repo }) => getDependabotAlerts(repo)))
  const open = results.reduce((sum, result) => sum + (result.ok && typeof result.data === 'number' ? result.data : 0), 0)
  const off = results.filter((result) => result.ok && result.data === 'disabled').length
  if (open > 0) return { area: 'security', key: 'security', headline: formatNumber(open), detail: 'open Dependabot alerts', status: `${open} open`, tone: 'bad' }
  if (off > 0) return { area: 'security', key: 'security', headline: `Off on ${off}`, detail: `of ${TRACKED_REPOS.length} repos: alerts off`, status: `Off on ${off} repos`, tone: 'warn' }
  return { area: 'security', key: 'security', headline: '0', detail: 'open Dependabot alerts', status: 'Covered', tone: 'good' }
}

async function waitlist(): Promise<Summary> {
  if (!(await isWaitlistConnected())) return notConnected('waitlist', 'Needs the waitlist database', 'databases')
  const rows = await readWaitlist()
  const confirmed = rows.filter((row) => row.confirmedAt).length
  return { area: 'waitlist', key: 'waitlist', headline: formatNumber(confirmed), detail: `confirmed, ${formatNumber(rows.length - confirmed)} waiting`, status: 'Fine', tone: 'quiet' }
}

async function setup(): Promise<Summary> {
  const items = await allSetupStatuses()
  const checkable = items.filter(({ status }) => status.state !== 'manual')
  const done = checkable.filter(({ status }) => status.state === 'done').length
  return { area: 'setup', key: 'setup', headline: `${done} / ${checkable.length}`, detail: 'items done', status: done === checkable.length ? 'Done' : 'To do', tone: done === checkable.length ? 'good' : 'quiet' }
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
    timer = setTimeout(() => resolve({ area, key, headline: 'Still loading', detail: 'Slow source; open the page', status: 'Slow source', tone: 'warn' }), SOURCE_TIMEOUT_MS)
  })
  const loaded = load()
    .catch((error: unknown): Summary => ({ area, key, headline: 'Unavailable', detail: error instanceof Error ? error.message : 'Unknown error', status: 'Unavailable', tone: 'warn' }))
    .finally(() => clearTimeout(timer))
  return Promise.race([loaded, timeout])
}

const SOURCES: [AreaId, string, () => Promise<Summary>][] = [
  ['ci', 'ci', cachedSource('ci', ci)],
  ['minutes', 'minutes', cachedSource('minutes', minutes)],
  ['repos', 'repos', cachedSource('repos', repos)],
  ['releases', 'releases', cachedSource('releases', releases)],
  ['security', 'security', cachedSource('security', security)],
  ['demos', 'demos', cachedSource('demos', demos)],
  ['errors', 'errors', cachedSource('errors', errors)],
  ['traffic', 'traffic', cachedSource('traffic', traffic)],
  ['mailroom', 'mailroom', cachedSource('mailroom', mailroom)],
  ['referrals', 'referrals', cachedSource('referrals', referrals)],
  ['contact', 'contact', cachedSource('contact', contact)],
  ['game', 'game', cachedSource('game', game)],
  // Local reads, never cached: the waitlist holds people's addresses, and Setup reads this server's own configuration.
  ['waitlist', 'waitlist', waitlist],
  ['setup', 'setup', setup],
]

/** Every headline, in the sidebar's order. */
export async function getSummaries(): Promise<Summary[]> {
  return Promise.all(SOURCES.map(([area, key, load]) => withTimeout(area, key, load)))
}
