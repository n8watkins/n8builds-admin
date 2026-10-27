import 'server-only'
import { cache } from 'react'
import { REVALIDATE_SECONDS } from './cache'
import { traced } from './trace'
import { APPTURNITY_ORG, PERSONAL_ACCOUNT, TRACKED_REPOS } from './repos'

const API = 'https://api.github.com'

export type Fetched<T> = { ok: true; data: T } | { ok: false; status: number; message: string }

export function isGitHubConnected(): boolean {
  return Boolean(process.env.GITHUB_TOKEN)
}

/**
 * A fine-grained token covers one resource owner, so the Appturnity org's
 * billing can need its own token; it falls back to GITHUB_TOKEN (a classic
 * token, or the gh CLI's, reads both).
 */
function tokenFor(owner: 'personal' | 'org'): string | undefined {
  return owner === 'org' ? process.env.GITHUB_ORG_TOKEN || process.env.GITHUB_TOKEN : process.env.GITHUB_TOKEN
}

async function gh<T>(path: string, owner: 'personal' | 'org' = 'personal'): Promise<Fetched<T>> {
  const token = tokenFor(owner)
  if (!token) return { ok: false, status: 0, message: 'No GitHub token' }
  try {
    const response = await traced(`github ${path}`, () => fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      next: { revalidate: REVALIDATE_SECONDS },
    }))
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      return { ok: false, status: response.status, message: body.message ?? response.statusText }
    }
    return { ok: true, data: (await response.json()) as T }
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : 'Network error' }
  }
}

// ---------------------------------------------------------------------------
// Repo basics

type RawRepo = { stargazers_count: number; default_branch: string; html_url: string; open_issues_count: number; pushed_at: string }

export const getRepo = cache((repo: string) => gh<RawRepo>(`/repos/${repo}`))

// ---------------------------------------------------------------------------
// CI

export type WorkflowRun = {
  id: number
  workflow: string
  status: string
  conclusion: string | null
  branch: string
  event: string
  createdAt: string
  url: string
}

type RawRuns = {
  workflow_runs: {
    id: number
    name: string
    status: string
    conclusion: string | null
    head_branch: string
    event: string
    created_at: string
    html_url: string
  }[]
}

function toRun(run: RawRuns['workflow_runs'][number]): WorkflowRun {
  return {
    id: run.id,
    workflow: run.name,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    event: run.event,
    createdAt: run.created_at,
    url: run.html_url,
  }
}

export type RepoCi = {
  repo: string
  defaultBranch: string
  /** The newest run of each workflow on the default branch. */
  latestByWorkflow: WorkflowRun[]
}

function trackedBranch(repo: string): string {
  return TRACKED_REPOS.find((tracked) => tracked.repo === repo)?.branch ?? 'main'
}

/** The newest run of each workflow on the default branch: one request, no repo lookup first. */
export const getRepoCi = cache(async (repo: string): Promise<Fetched<RepoCi>> => {
  const branch = trackedBranch(repo)
  const runs = await gh<RawRuns>(`/repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=30&exclude_pull_requests=true`)
  if (!runs.ok) return runs
  const seen = new Set<string>()
  const latestByWorkflow: WorkflowRun[] = []
  for (const run of runs.data.workflow_runs) {
    // Dependabot's version-update jobs (event `dynamic`) are not the repo's CI.
    if (run.event === 'dynamic' || seen.has(run.name)) continue
    seen.add(run.name)
    latestByWorkflow.push(toRun(run))
  }
  return { ok: true, data: { repo, defaultBranch: branch, latestByWorkflow } }
})

/** The newest run on any other branch (usually a pull request); only the CI page asks for it. */
export const getLatestOtherRun = cache(async (repo: string): Promise<WorkflowRun | null> => {
  const runs = await gh<RawRuns>(`/repos/${repo}/actions/runs?per_page=10`)
  const branch = trackedBranch(repo)
  const run = runs.ok ? runs.data.workflow_runs.find((item) => item.event !== 'dynamic' && item.head_branch !== branch) : undefined
  return run ? toRun(run) : null
})

// ---------------------------------------------------------------------------
// Actions minutes (the enhanced billing platform's usage report)

type RawUsage = {
  usageItems: { date?: string; product: string; unitType: string; quantity: number; repositoryName?: string; netAmount?: number }[]
}

export type MinutesUsage = {
  total: number
  /** The day of the newest usage item (YYYY-MM-DD), or null. */
  lastDay: string | null
  netAmount: number
  byRepo: { repo: string; minutes: number }[]
}

function summarizeMinutes(items: RawUsage['usageItems']): MinutesUsage {
  const byRepo = new Map<string, number>()
  let total = 0
  let netAmount = 0
  let lastDay: string | null = null
  for (const item of items) {
    if (item.product !== 'actions' || item.unitType.toLowerCase() !== 'minutes') continue
    const day = item.date?.slice(0, 10) ?? null
    if (day && (!lastDay || day > lastDay)) lastDay = day
    total += item.quantity
    netAmount += item.netAmount ?? 0
    const repo = item.repositoryName ?? '(no repo)'
    byRepo.set(repo, (byRepo.get(repo) ?? 0) + item.quantity)
  }
  return {
    total,
    lastDay,
    netAmount,
    byRepo: [...byRepo.entries()].map(([repo, minutes]) => ({ repo, minutes })).sort((a, b) => b.minutes - a.minutes),
  }
}

function thisMonth(now = new Date()) {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

export const getOrgMinutes = cache(async (): Promise<Fetched<MinutesUsage>> => {
  const { year, month } = thisMonth()
  const usage = await gh<RawUsage>(`/organizations/${APPTURNITY_ORG}/settings/billing/usage?year=${year}&month=${month}`, 'org')
  return usage.ok ? { ok: true, data: summarizeMinutes(usage.data.usageItems) } : usage
})

/** Needs the token's "Plan: read" account permission; GitHub answers 404 without it. */
export const getPersonalMinutes = cache(async (): Promise<Fetched<MinutesUsage>> => {
  const { year, month } = thisMonth()
  const usage = await gh<RawUsage>(`/users/${PERSONAL_ACCOUNT}/settings/billing/usage?year=${year}&month=${month}`)
  return usage.ok ? { ok: true, data: summarizeMinutes(usage.data.usageItems) } : usage
})

// ---------------------------------------------------------------------------
// Traffic, releases, alerts, deployments, activity

export type Traffic = { count: number; uniques: number }

export const getViews = cache((repo: string) => gh<Traffic>(`/repos/${repo}/traffic/views`))
export const getClones = cache((repo: string) => gh<Traffic>(`/repos/${repo}/traffic/clones`))

export type Release = { tag: string; name: string; publishedAt: string; url: string }

export const getLatestRelease = cache(async (repo: string): Promise<Fetched<Release | null>> => {
  const result = await gh<{ tag_name: string; name: string | null; published_at: string; html_url: string; draft: boolean }[]>(
    `/repos/${repo}/releases?per_page=5`,
  )
  if (!result.ok) return result
  const release = result.data.find((item) => !item.draft)
  return {
    ok: true,
    data: release ? { tag: release.tag_name, name: release.name || release.tag_name, publishedAt: release.published_at, url: release.html_url } : null,
  }
})

/** Open Dependabot alerts, or `disabled` when the repo has alerts turned off (GitHub answers 403). */
export const getDependabotAlerts = cache(async (repo: string): Promise<Fetched<number | 'disabled'>> => {
  const result = await gh<unknown[]>(`/repos/${repo}/dependabot/alerts?state=open&per_page=100`)
  if (result.ok) return { ok: true, data: result.data.length }
  if (result.status === 403 && /disabled/i.test(result.message)) return { ok: true, data: 'disabled' }
  return result
})

export type Deployment = {
  repo: string
  environment: string
  ref: string
  sha: string
  createdAt: string
  state: string | null
  url: string | null
}

type RawDeployment = { id: number; environment: string; ref: string; sha: string; created_at: string; statuses_url: string }

export const getLatestDeployments = cache(async (limit = 8): Promise<Fetched<Deployment[]>> => {
  const lists = await Promise.all(
    TRACKED_REPOS.map(async ({ repo }) => ({ repo, result: await gh<RawDeployment[]>(`/repos/${repo}/deployments?per_page=5`) })),
  )
  const failed = lists.find((list) => !list.result.ok)
  if (failed && !failed.result.ok && lists.every((list) => !list.result.ok)) return failed.result
  const all = lists
    .flatMap(({ repo, result }) => (result.ok ? result.data.map((item) => ({ repo, item })) : []))
    .sort((a, b) => b.item.created_at.localeCompare(a.item.created_at))
    .slice(0, limit)
  const withState = await Promise.all(
    all.map(async ({ repo, item }) => {
      const statuses = await gh<{ state: string; environment_url?: string; target_url?: string }[]>(
        `/repos/${repo}/deployments/${item.id}/statuses?per_page=1`,
      )
      const latest = statuses.ok ? statuses.data[0] : undefined
      return {
        repo,
        environment: item.environment,
        ref: item.ref,
        sha: item.sha.slice(0, 7),
        createdAt: item.created_at,
        state: latest?.state ?? null,
        url: latest?.target_url || latest?.environment_url || null,
      }
    }),
  )
  return { ok: true, data: withState }
})

export type MonthActivity = { repo: string; commits: number; capped: boolean; releases: number }

/** Commits on the default branch and releases since the 1st of this month (UTC). */
export const getMonthActivity = cache(async (): Promise<Fetched<MonthActivity[]>> => {
  const now = new Date()
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const rows = await Promise.all(
    TRACKED_REPOS.map(async ({ repo }) => {
      const [commits, releases] = await Promise.all([
        gh<unknown[]>(`/repos/${repo}/commits?since=${since}&per_page=100`),
        gh<{ published_at: string | null; draft: boolean }[]>(`/repos/${repo}/releases?per_page=30`),
      ])
      if (!commits.ok) return null
      const releaseCount = releases.ok
        ? releases.data.filter((item) => !item.draft && item.published_at && item.published_at >= since).length
        : 0
      return { repo, commits: commits.data.length, capped: commits.data.length >= 100, releases: releaseCount }
    }),
  )
  const data = rows.filter((row): row is MonthActivity => row !== null)
  if (data.length === 0) return { ok: false, status: 0, message: 'No repo answered' }
  return { ok: true, data: data.sort((a, b) => b.commits - a.commits) }
})
