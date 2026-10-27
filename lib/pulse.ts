import 'server-only'
import { unstable_cache } from 'next/cache'
import { REVALIDATE_SECONDS } from './cache'
import { getLatestRelease, getRepo, getRepoCi, getStarDates, getViews, isGitHubConnected } from './github'
import { getDemoStatus } from './openping'
import { isFailing } from './overview'
import { TRACKED_REPOS } from './repos'
import { lastDays } from './store'

/**
 * The Overview's top strip and project grid. Built from the same cached
 * GitHub reads the pages use, and cached as a whole for five minutes.
 */
export type Pulse = {
  github: boolean
  ci: { passing: number; total: number }
  stars: { total: number; gained30d: number; series: number[] }
  views: { total: number; uniques: number; series: number[] }
  demos: { up: number; total: number; offHours: boolean } | null
}

export type ProjectTile = {
  repo: string
  ci: 'good' | 'bad' | 'idle'
  failing: number
  stars: number | null
  views: number | null
  release: { tag: string; publishedAt: string; url: string } | null
}

async function loadPulse(): Promise<Pulse> {
  const demosPromise = getDemoStatus()
    .then((feed) => ({ up: feed.services.filter((service) => service.state === 'operational').length, total: feed.services.length, offHours: feed.offHours }))
    .catch(() => null)
  if (!isGitHubConnected()) {
    return { github: false, ci: { passing: 0, total: 0 }, stars: { total: 0, gained30d: 0, series: [] }, views: { total: 0, uniques: 0, series: [] }, demos: await demosPromise }
  }
  const [ci, repos, starDates, views, demos] = await Promise.all([
    Promise.all(TRACKED_REPOS.map(({ repo }) => getRepoCi(repo))),
    Promise.all(TRACKED_REPOS.map(({ repo }) => getRepo(repo))),
    Promise.all(TRACKED_REPOS.map(({ repo }) => getStarDates(repo))),
    Promise.all(TRACKED_REPOS.map(({ repo }) => getViews(repo))),
    demosPromise,
  ])
  const runs = ci.flatMap((result) => (result.ok ? result.data.latestByWorkflow : []))

  // Stars: today's total, and the running total at the end of each of the last 30 days.
  const total = repos.reduce((sum, repo) => sum + (repo.ok ? repo.data.stargazers_count : 0), 0)
  const dates = starDates.flatMap((result) => (result.ok ? result.data : [])).map((date) => date.slice(0, 10))
  const days = lastDays(30)
  const series = days.map((day) => {
    const after = dates.filter((date) => date > day).length
    return total - after
  })

  // Views: GitHub lists only the days that had traffic, so missing days are zero.
  const viewDays = lastDays(14)
  const perDay = new Map(viewDays.map((day) => [day, 0]))
  for (const result of views) {
    if (!result.ok) continue
    for (const day of result.data.views ?? []) {
      const key = day.timestamp.slice(0, 10)
      if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + day.count)
    }
  }

  return {
    github: true,
    ci: { passing: runs.filter((run) => !isFailing(run)).length, total: runs.length },
    stars: { total, gained30d: total - (series[0] ?? total), series },
    views: {
      total: views.reduce((sum, view) => sum + (view.ok ? view.data.count : 0), 0),
      uniques: views.reduce((sum, view) => sum + (view.ok ? view.data.uniques : 0), 0),
      series: [...perDay.values()],
    },
    demos,
  }
}

async function loadProjects(): Promise<ProjectTile[]> {
  if (!isGitHubConnected()) return []
  return Promise.all(
    TRACKED_REPOS.map(async ({ repo }) => {
      const [ci, info, views, release] = await Promise.all([getRepoCi(repo), getRepo(repo), getViews(repo), getLatestRelease(repo)])
      const failing = ci.ok ? ci.data.latestByWorkflow.filter(isFailing).length : 0
      return {
        repo,
        ci: !ci.ok || ci.data.latestByWorkflow.length === 0 ? 'idle' : failing > 0 ? 'bad' : 'good',
        failing,
        stars: info.ok ? info.data.stargazers_count : null,
        views: views.ok ? views.data.count : null,
        release: release.ok && release.data ? { tag: release.data.tag, publishedAt: release.data.publishedAt, url: release.data.url } : null,
      } satisfies ProjectTile
    }),
  )
}

export const getPulse = unstable_cache(loadPulse, ['overview-pulse'], { revalidate: REVALIDATE_SECONDS })
export const getProjects = unstable_cache(loadProjects, ['overview-projects'], { revalidate: REVALIDATE_SECONDS })
