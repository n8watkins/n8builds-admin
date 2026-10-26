import 'server-only'
import { REVALIDATE_SECONDS } from './cache'

/**
 * Sentry's unresolved issues and error volume, read with a read-only token
 * (scopes: org:read, project:read, event:read). Written against Sentry's
 * REST API docs; it switches on once the token is set (docs/SETUP.md).
 */
export function sentryConfig() {
  const token = process.env.SENTRY_AUTH_TOKEN
  const org = process.env.SENTRY_ORG
  const projects = (process.env.SENTRY_PROJECTS ?? '').split(',').map((slug) => slug.trim()).filter(Boolean)
  if (!token || !org || projects.length === 0) return null
  return { token, org, projects, base: process.env.SENTRY_API_BASE || 'https://sentry.io' }
}

export type SentryIssue = {
  id: string
  shortId: string
  title: string
  project: string
  events: number
  users: number
  firstSeen: string
  lastSeen: string
  url: string
}

export type SentrySummary = {
  org: string
  unresolved: SentryIssue[]
  /** Unresolved issues first seen in the last 7 days. */
  newThisWeek: number
  /** Accepted error events over the last 30 days, all projects. */
  errors30d: number | null
}

async function sentry<T>(path: string): Promise<T> {
  const config = sentryConfig()
  if (!config) throw new Error('Sentry is not connected')
  const response = await fetch(`${config.base}/api/0${path}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!response.ok) throw new Error(`Sentry answered ${response.status} for ${path.split('?')[0]}`)
  return (await response.json()) as T
}

type RawIssue = {
  id: string
  shortId: string
  title: string
  count: string
  userCount: number
  firstSeen: string
  lastSeen: string
  permalink: string
  project: { slug: string }
}

export async function getSentrySummary(): Promise<SentrySummary> {
  const config = sentryConfig()
  if (!config) throw new Error('Sentry is not connected')
  const perProject = await Promise.all(
    config.projects.map((project) =>
      sentry<RawIssue[]>(`/projects/${config.org}/${project}/issues/?query=is:unresolved&statsPeriod=14d&limit=25`),
    ),
  )
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const unresolved = perProject
    .flat()
    .map((issue) => ({
      id: issue.id,
      shortId: issue.shortId,
      title: issue.title,
      project: issue.project.slug,
      events: Number(issue.count) || 0,
      users: issue.userCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      url: issue.permalink,
    }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))

  let errors30d: number | null = null
  try {
    const stats = await sentry<{ groups: { by: { outcome?: string }; totals: Record<string, number> }[] }>(
      `/organizations/${config.org}/stats_v2/?field=sum(quantity)&category=error&statsPeriod=30d&interval=1d&groupBy=outcome`,
    )
    errors30d = stats.groups
      .filter((group) => group.by.outcome === 'accepted')
      .reduce((sum, group) => sum + (group.totals['sum(quantity)'] ?? 0), 0)
  } catch {
    errors30d = null
  }

  return {
    org: config.org,
    unresolved,
    newThisWeek: unresolved.filter((issue) => Date.parse(issue.firstSeen) >= weekAgo).length,
    errors30d,
  }
}
