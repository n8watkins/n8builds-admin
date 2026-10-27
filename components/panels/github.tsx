import { timeAgo, formatNumber } from '@/lib/format'
import {
  getClones,
  getOrgMinutes,
  getPersonalMinutes,
  getRepo,
  getRepoCi,
  getViews,
  isGitHubConnected,
  type WorkflowRun,
} from '@/lib/github'
import { APPTURNITY_ORG, FREE_ACTIONS_MINUTES, TRACKED_REPOS, shortName } from '@/lib/repos'
import { BarList, Dot, Meter, NotConnected, PanelError, cx, type Tone } from '../ui'

export function GitHubNotConnected() {
  return (
    <NotConnected
      why="Start the server with a GitHub token in the environment (locally: GITHUB_TOKEN=$(gh auth token))."
      needs={['GITHUB_TOKEN']}
      setupId="github"
    />
  )
}

export function runTone(run: Pick<WorkflowRun, 'status' | 'conclusion'>): Tone {
  if (run.status !== 'completed') return 'running'
  if (run.conclusion === 'success') return 'good'
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'startup_failure') return 'bad'
  if (run.conclusion === 'cancelled' || run.conclusion === 'action_required') return 'warn'
  return 'idle'
}

function runLabel(run: WorkflowRun): string {
  return run.status === 'completed' ? (run.conclusion ?? 'done').replace('_', ' ') : run.status.replace('_', ' ')
}

export async function CiStatus() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const results = await Promise.all(TRACKED_REPOS.map(async (tracked) => ({ tracked, ci: await getRepoCi(tracked.repo) })))
  if (results.every(({ ci }) => !ci.ok)) {
    const first = results[0]?.ci
    return <PanelError message={first && !first.ok ? first.message : 'No repo answered'} />
  }
  return (
    <ul className="-mx-2 divide-y divide-white/[0.04]">
      {results.map(({ tracked, ci }) => {
        if (!ci.ok) {
          return (
            <li key={tracked.repo} className="px-2 py-2.5 text-[13px] text-rose-200/80">
              {shortName(tracked.repo)}: {ci.message}
            </li>
          )
        }
        const { latestByWorkflow, latest, defaultBranch } = ci.data
        const failing = latestByWorkflow.some((run) => runTone(run) === 'bad')
        const offDefault = latest && latest.branch !== defaultBranch ? latest : null
        return (
          <li key={tracked.repo} className="flex flex-col gap-2 px-2 py-2.5 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-44 sm:shrink-0">
              <Dot tone={latestByWorkflow.length === 0 ? 'idle' : failing ? 'bad' : 'good'} />
              <a href={`https://github.com/${tracked.repo}/actions`} target="_blank" rel="noreferrer" className="truncate text-[13px] font-medium text-slate-100 hover:text-cyan-300">
                {shortName(tracked.repo)}
              </a>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {latestByWorkflow.length === 0 ? (
                <p className="text-xs text-slate-475">No workflow runs on {defaultBranch}</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {latestByWorkflow.slice(0, 6).map((run) => (
                    <li key={run.id}>
                      <a
                        href={run.url}
                        target="_blank"
                        rel="noreferrer"
                        title={`${run.workflow} on ${run.branch}: ${runLabel(run)}, ${timeAgo(run.createdAt)}`}
                        className={cx(
                          'flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs transition-colors hover:bg-white/[0.08]',
                          runTone(run) === 'bad' ? 'bg-rose-400/10 text-rose-100' : 'bg-white/[0.04] text-slate-300',
                        )}>
                        <Dot tone={runTone(run)} />
                        <span className="max-w-40 truncate">{run.workflow}</span>
                        <span className="text-slate-475">{timeAgo(run.createdAt)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {offDefault && (
                <a href={offDefault.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-xs text-slate-450 hover:text-cyan-300">
                  <Dot tone={runTone(offDefault)} />
                  <span className="truncate">
                    Latest: {offDefault.workflow} {runLabel(offDefault)} on <span className="font-mono text-slate-400">{offDefault.branch}</span>, {timeAgo(offDefault.createdAt)}
                  </span>
                </a>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export async function ActionsMinutes() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const [org, personal] = await Promise.all([getOrgMinutes(), getPersonalMinutes()])
  const month = new Date().toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-medium text-slate-200">{APPTURNITY_ORG} org</p>
          {org.ok && (
            <p className="font-mono text-xs text-slate-400 tabular-nums">
              <span className="text-base font-semibold text-slate-50">{formatNumber(org.data.total)}</span> / {formatNumber(FREE_ACTIONS_MINUTES)} min
            </p>
          )}
        </div>
        {org.ok ? (
          <>
            <Meter value={org.data.total} max={FREE_ACTIONS_MINUTES} label={`${APPTURNITY_ORG} Actions minutes used in ${month}`} />
            {org.data.total >= FREE_ACTIONS_MINUTES && org.data.netAmount === 0 ? (
              <p role="status" className="mt-3 rounded-lg bg-rose-400/[0.07] px-3 py-2.5 text-xs leading-relaxed text-rose-200">
                <b className="font-semibold">All 2,000 free minutes are used</b>
                {org.data.lastDay ? ` (no usage since ${org.data.lastDay})` : ''}, with $0 billed: private-repo workflows can&apos;t run until the minutes reset on the 1st, unless a budget allows paid minutes.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-450">
                {formatNumber(Math.max(0, FREE_ACTIONS_MINUTES - org.data.total))} free minutes left in {month}
                {org.data.netAmount > 0 ? `, $${org.data.netAmount.toFixed(2)} billed` : ', $0 billed'}
              </p>
            )}
            {org.data.byRepo.length > 0 && (
              <div className="mt-3">
                <BarList rows={org.data.byRepo.map((row) => ({ label: row.repo, value: row.minutes }))} format={(value) => `${formatNumber(value)} min`} />
              </div>
            )}
          </>
        ) : (
          <PanelError message={`GitHub answered ${org.status || 'nothing'}: ${org.message}`} />
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <p className="mb-2 text-[13px] font-medium text-slate-200">Personal (n8watkins)</p>
        {personal.ok ? (
          <>
            <Meter value={personal.data.total} max={FREE_ACTIONS_MINUTES} label={`Personal Actions minutes used in ${month}`} />
            <p className="mt-1.5 text-xs text-slate-450">
              {formatNumber(personal.data.total)} / {formatNumber(FREE_ACTIONS_MINUTES)} min. Public repos don&apos;t count.
            </p>
          </>
        ) : (
          <NotConnected
            kind="needs-permission"
            why={
              <>
                GitHub answered {personal.status === 404 ? '404' : personal.status} for the personal billing report: the token needs the account permission <b className="font-semibold text-slate-200">Plan: read</b>. All the tracked repos are public, so their minutes are free either way.
              </>
            }
            needs={['GITHUB_TOKEN (Plan: read)']}
            setupId="github"
          />
        )}
      </div>
    </div>
  )
}

export async function RepoStats() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const rows = await Promise.all(
    TRACKED_REPOS.map(async (tracked) => {
      const [repo, views, clones] = await Promise.all([getRepo(tracked.repo), getViews(tracked.repo), getClones(tracked.repo)])
      return { tracked, repo, views, clones }
    }),
  )
  if (rows.every((row) => !row.repo.ok)) {
    const first = rows[0]?.repo
    return <PanelError message={first && !first.ok ? first.message : 'No repo answered'} />
  }
  const totals = rows.reduce(
    (sum, row) => ({
      stars: sum.stars + (row.repo.ok ? row.repo.data.stargazers_count : 0),
      views: sum.views + (row.views.ok ? row.views.data.count : 0),
      viewers: sum.viewers + (row.views.ok ? row.views.data.uniques : 0),
      clones: sum.clones + (row.clones.ok ? row.clones.data.count : 0),
    }),
    { stars: 0, views: 0, viewers: 0, clones: 0 },
  )
  const traffic = (result: (typeof rows)[number]['views']) =>
    result.ok ? (
      <>
        {formatNumber(result.data.count)} <span className="block text-slate-475 sm:inline">/ {formatNumber(result.data.uniques)}</span>
      </>
    ) : (
      <span className="text-slate-475" title={result.message}>
        n/a
      </span>
    )
  return (
    <div className="-mx-1">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Stars, and views and clones over the last 14 days (total / unique), per repo</caption>
        <thead>
          <tr className="text-[11px] tracking-wide text-slate-450 uppercase">
            <th scope="col" className="px-1 pb-2 font-medium">Repo</th>
            <th scope="col" className="px-1 pb-2 text-right font-medium">Stars</th>
            <th scope="col" className="px-1 pb-2 text-right font-medium">Views 14d</th>
            <th scope="col" className="px-1 pb-2 text-right font-medium">Clones 14d</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04] font-mono text-xs text-slate-200 tabular-nums">
          {rows.map(({ tracked, repo, views, clones }) => (
            <tr key={tracked.repo}>
              <th scope="row" className="px-1 py-2 text-left align-top font-sans font-normal">
                <a href={`https://github.com/${tracked.repo}`} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-slate-100 hover:text-cyan-300">
                  {shortName(tracked.repo)}
                </a>
                <span className="ml-2 hidden text-xs text-slate-475 sm:inline">{tracked.label}</span>
              </th>
              <td className="px-1 py-2 text-right align-top">{repo.ok ? formatNumber(repo.data.stargazers_count) : 'n/a'}</td>
              <td className="px-1 py-2 text-right align-top">{traffic(views)}</td>
              <td className="px-1 py-2 text-right align-top">{traffic(clones)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="font-mono text-xs text-slate-50 tabular-nums">
          <tr className="border-t border-white/[0.08]">
            <th scope="row" className="px-1 pt-2.5 text-left align-top font-sans text-[11px] font-medium tracking-wide text-slate-450 uppercase">
              All repos
            </th>
            <td className="px-1 pt-2.5 text-right align-top font-semibold">{formatNumber(totals.stars)}</td>
            <td className="px-1 pt-2.5 text-right font-semibold">
              {formatNumber(totals.views)} <span className="block font-normal text-slate-475 sm:inline">/ {formatNumber(totals.viewers)}</span>
            </td>
            <td className="px-1 pt-2.5 text-right align-top font-semibold">{formatNumber(totals.clones)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-3 px-1 text-xs text-slate-475">Views and clones: total / unique. GitHub keeps 14 days; the daily snapshot will keep the rest.</p>
    </div>
  )
}
