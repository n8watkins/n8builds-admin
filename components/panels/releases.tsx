import { timeAgo } from '@/lib/format'
import { getWorkerDeploy, isCloudflareConnected, type WorkerDeploy } from '@/lib/cloudflare'
import { getCommitsSince, getLatestRelease, getPreviewDeploys, getProductionDeploy, isGitHubConnected, type Deployment } from '@/lib/github'
import { TRACKED_REPOS, shortName, vercelProjectUrl, type TrackedRepo } from '@/lib/repos'
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

const TRIGGER: Record<string, string> = {
  deployment: 'Code deploy',
  secret: 'Secret changed',
  rollback: 'Rollback',
  version_upload: 'Code deploy',
}

/**
 * Where a project's production deploy comes from: its Cloudflare Worker when it
 * has one (lib/cloudflare.ts), otherwise the Production deployment Vercel
 * records on GitHub.
 */
type Production =
  | { kind: 'worker'; deploy: WorkerDeploy | null; connected: boolean }
  | { kind: 'github'; deploy: Deployment | null }

async function productionOf(tracked: TrackedRepo): Promise<Production> {
  if (tracked.worker) {
    if (!isCloudflareConnected()) return { kind: 'worker', deploy: null, connected: false }
    const result = await getWorkerDeploy(tracked.worker)
    return { kind: 'worker', deploy: result.ok ? result.data : null, connected: true }
  }
  const result = await getProductionDeploy(tracked.repo)
  return { kind: 'github', deploy: result.ok ? result.data : null }
}

function WorkerProduction({ tracked, deploy, connected }: { tracked: TrackedRepo; deploy: WorkerDeploy | null; connected: boolean }) {
  if (!connected) {
    return (
      <p className="mt-1.5 text-[14px] text-slate-400">
        On Cloudflare Workers; its deploys show once <code className="font-mono text-slate-300">CLOUDFLARE_DEPLOYS_TOKEN</code> is set. <OutLink href={tracked.site}>Site</OutLink>
      </p>
    )
  }
  if (!deploy) {
    return (
      <p className="mt-1.5 text-[14px] text-slate-400">
        No Cloudflare deploy yet. <OutLink href={tracked.site}>Site</OutLink>
      </p>
    )
  }
  return (
    <>
      <p className="mt-1.5 flex flex-wrap items-center gap-2">
        <StatusPill tone="good">Live</StatusPill>
        <span className="text-[14px] text-slate-300">{timeAgo(deploy.createdAt)}</span>
        {deploy.trigger && <span className="text-[14px] text-slate-400">{TRIGGER[deploy.trigger] ?? deploy.trigger}</span>}
      </p>
      {deploy.message && <p className="mt-2 truncate text-[14px] text-slate-300">{deploy.message}</p>}
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
        <OutLink href={tracked.site}>Site</OutLink>
        <OutLink href={deploy.url}>Cloudflare</OutLink>
        {deploy.version && <span className="font-mono text-slate-400">{deploy.version}</span>}
      </p>
    </>
  )
}

/** One row per project: its latest release, what has landed since, and its production deploy. */
export async function ProjectReleases() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const rows = await Promise.all(
    TRACKED_REPOS.map(async (tracked) => {
      const [release, production] = await Promise.all([getLatestRelease(tracked.repo), productionOf(tracked)])
      const latest = release.ok ? release.data : null
      const since = latest ? await getCommitsSince(tracked.repo, latest.tag) : null
      return { tracked, latest, since: since?.ok ? since.data : null, production }
    }),
  )
  // Newest release first; projects without releases last.
  rows.sort((a, b) => (b.latest?.publishedAt ?? '').localeCompare(a.latest?.publishedAt ?? ''))
  return (
    <ul className="-my-2 divide-y divide-white/[0.06]">
      {rows.map(({ tracked, latest, since, production: source }) => {
        const project = vercelProjectUrl(tracked.repo)
        const production = source.kind === 'github' ? source.deploy : null
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
              {source.kind === 'worker' ? (
                <WorkerProduction tracked={tracked} deploy={source.deploy} connected={source.connected} />
              ) : production && state ? (
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
                  No deploys recorded. <OutLink href={tracked.site}>Site</OutLink>
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
