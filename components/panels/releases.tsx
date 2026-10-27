import { timeAgo } from '@/lib/format'
import { getCommitsSince, getLatestRelease, getPreviewDeploys, getProductionDeploy, isGitHubConnected } from '@/lib/github'
import { TRACKED_REPOS, shortName, vercelProjectUrl } from '@/lib/repos'
import { ProjectIcon } from '../ProjectIcon'
import { Dot, OutLink, StatusPill, type Tone } from '../ui'
import { GitHubNotConnected } from './github'

const DEPLOY_STATE: Record<string, { label: string; tone: Tone }> = {
  success: { label: 'Live', tone: 'good' },
  failure: { label: 'Failed', tone: 'bad' },
  error: { label: 'Failed', tone: 'bad' },
  in_progress: { label: 'Building', tone: 'running' },
  queued: { label: 'Queued', tone: 'running' },
  pending: { label: 'Pending', tone: 'running' },
  inactive: { label: 'Replaced', tone: 'idle' },
}

function deployState(state: string | null): { label: string; tone: Tone } {
  return DEPLOY_STATE[state ?? ''] ?? { label: state ?? 'Unknown', tone: 'idle' }
}

/** One row per project: its latest release, what has landed since, and its production deploy. */
export async function ProjectReleases() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const rows = await Promise.all(
    TRACKED_REPOS.map(async (tracked) => {
      const [release, production] = await Promise.all([getLatestRelease(tracked.repo), getProductionDeploy(tracked.repo)])
      const latest = release.ok ? release.data : null
      const since = latest ? await getCommitsSince(tracked.repo, latest.tag) : null
      return { tracked, latest, since: since?.ok ? since.data : null, production: production.ok ? production.data : null }
    }),
  )
  // Newest release first; projects without releases last.
  rows.sort((a, b) => (b.latest?.publishedAt ?? '').localeCompare(a.latest?.publishedAt ?? ''))
  return (
    <ul className="-my-2 divide-y divide-white/[0.06]">
      {rows.map(({ tracked, latest, since, production }) => {
        const project = vercelProjectUrl(tracked.repo)
        const state = production ? deployState(production.state) : null
        return (
          <li key={tracked.repo} className="grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.1fr)] lg:gap-8">
            <div className="flex min-w-0 items-center gap-3 self-start">
              <ProjectIcon repo={tracked.repo} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-slate-50">{tracked.label}</p>
                <p className="truncate font-mono text-[13px] text-slate-400">{shortName(tracked.repo)}</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-400">Latest release</p>
              {latest ? (
                <>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <OutLink href={latest.url} className="rounded-md bg-teal-400/12 px-2 py-0.5 font-mono text-[14px] text-teal-100 hover:bg-teal-400/20 hover:text-teal-50">
                      {latest.tag}
                    </OutLink>
                    <span className="text-[14px] text-slate-300">
                      {new Date(latest.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })}
                    </span>
                    <span className="text-[14px] text-slate-400">{timeAgo(latest.publishedAt)}</span>
                  </p>
                  {latest.summary && <p className="mt-2 text-[14px] leading-relaxed text-slate-300">{latest.summary}</p>}
                  {since !== null && (
                    <p className="mt-2 text-[14px] text-slate-400">
                      {since === 0 ? (
                        'Nothing new since this release.'
                      ) : (
                        <OutLink href={`https://github.com/${tracked.repo}/compare/${encodeURIComponent(latest.tag)}...${tracked.branch}`}>
                          {`${since} commit${since === 1 ? '' : 's'} since, not released yet`}
                        </OutLink>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1.5 text-[14px] text-slate-400">No releases yet.</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-400">Production</p>
              {production && state ? (
                <>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusPill tone={state.tone}>{state.label}</StatusPill>
                    <span className="text-[14px] text-slate-300">{timeAgo(production.createdAt)}</span>
                  </p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                    {production.url && <OutLink href={production.url}>Deploy</OutLink>}
                    {project && <OutLink href={project}>Vercel</OutLink>}
                    <span className="font-mono text-slate-400">{production.sha}</span>
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[14px] text-slate-400">
                  Not deployed through Vercel. <OutLink href={tracked.site}>Site</OutLink>
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Preview deploys (one per pull request), folded away: they matter only when one fails. */
export async function PreviewDeploys() {
  if (!isGitHubConnected()) return null
  const result = await getPreviewDeploys(8)
  if (!result.ok || result.data.length === 0) return <p className="text-[14px] text-slate-400">No preview deploys.</p>
  const failed = result.data.filter((deploy) => deployState(deploy.state).tone === 'bad').length
  return (
    <details className="group" open={failed > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] text-slate-200 [&::-webkit-details-marker]:hidden">
        <span>
          The last {result.data.length} previews{failed > 0 ? <span className="ml-2 text-rose-200">{failed} failed</span> : <span className="ml-2 text-slate-400">all fine</span>}
        </span>
        <span className="text-[14px] font-medium text-cyan-300 group-open:hidden">Show</span>
        <span className="hidden text-[14px] font-medium text-cyan-300 group-open:inline">Hide</span>
      </summary>
      <ul className="mt-3 divide-y divide-white/[0.06]">
        {result.data.map((deploy) => {
          const state = deployState(deploy.state)
          return (
            <li key={`${deploy.repo}-${deploy.sha}-${deploy.createdAt}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-[14px]">
              <Dot tone={state.tone} label={state.label} />
              <span className="font-medium text-slate-100">{shortName(deploy.repo)}</span>
              <span className="text-slate-400">{timeAgo(deploy.createdAt)}</span>
              <span className="font-mono text-slate-400">{deploy.sha}</span>
              {deploy.url && (
                <OutLink href={deploy.url} className="ml-auto">
                  Preview
                </OutLink>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
