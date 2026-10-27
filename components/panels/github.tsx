import { LuGithub } from 'react-icons/lu'
import { formatNumber, timeAgo } from '@/lib/format'
import {
  getClones,
  getLatestOtherRun,
  getOrgMinutes,
  getPersonalMinutes,
  getRepo,
  getRepoCi,
  getViews,
  isGitHubConnected,
  type WorkflowRun,
} from '@/lib/github'
import { APPTURNITY_ORG, FREE_ACTIONS_MINUTES, TRACKED_REPOS, shortName } from '@/lib/repos'
import { Actions, BarList, Dot, ExternalAction, Meter, NotConnected, OutLink, PanelError, Stat, StatusPill, cx, type Tone } from '../ui'

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

// ---------------------------------------------------------------------------
// CI

export async function CiStatus() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const results = await Promise.all(
    TRACKED_REPOS.map(async (tracked) => {
      const [ci, other] = await Promise.all([getRepoCi(tracked.repo), getLatestOtherRun(tracked.repo)])
      return { tracked, ci, other }
    }),
  )
  if (results.every(({ ci }) => !ci.ok)) {
    const first = results[0]?.ci
    return <PanelError message={first && !first.ok ? first.message : 'No repo answered'} />
  }
  // Failing repos first, then the rest in their usual order.
  const sorted = [...results].sort((a, b) => Number(b.ci.ok && b.ci.data.latestByWorkflow.some((run) => runTone(run) === 'bad')) - Number(a.ci.ok && a.ci.data.latestByWorkflow.some((run) => runTone(run) === 'bad')))
  return (
    <ul className="-my-2 divide-y divide-white/[0.06]">
      {sorted.map(({ tracked, ci, other }) => {
        if (!ci.ok) {
          return (
            <li key={tracked.repo} className="py-5 text-[15px] text-rose-200">
              {shortName(tracked.repo)}: {ci.message}
            </li>
          )
        }
        const { latestByWorkflow, defaultBranch } = ci.data
        const failing = latestByWorkflow.filter((run) => runTone(run) === 'bad')
        const tone: Tone = latestByWorkflow.length === 0 ? 'idle' : failing.length > 0 ? 'bad' : 'good'
        return (
          <li key={tracked.repo} className="py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[17px] font-semibold text-slate-50">{shortName(tracked.repo)}</p>
                <p className="text-[14px] text-slate-400">
                  {tracked.label} · <span className="font-mono">{defaultBranch}</span>
                </p>
              </div>
              <StatusPill tone={tone}>{tone === 'idle' ? 'No CI runs' : failing.length > 0 ? `${failing.length} failing` : 'Passing'}</StatusPill>
            </div>
            {latestByWorkflow.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {latestByWorkflow.slice(0, 6).map((run) => (
                  <li key={run.id}>
                    <a
                      href={run.url}
                      target="_blank"
                      rel="noreferrer"
                      title={`${run.workflow}: ${runLabel(run)}, ${timeAgo(run.createdAt)} (opens GitHub)`}
                      className={cx(
                        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[14px] transition-colors',
                        runTone(run) === 'bad' ? 'bg-rose-400/12 text-rose-100 hover:bg-rose-400/20' : 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]',
                      )}>
                      <Dot tone={runTone(run)} />
                      <span className="max-w-52 truncate">{run.workflow}</span>
                      <span className="text-slate-400">{timeAgo(run.createdAt)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {other && (
              <p className="mt-3 flex items-center gap-2 text-[14px] text-slate-400">
                <Dot tone={runTone(other)} />
                <span className="min-w-0 truncate">
                  Latest on another branch: {other.workflow} {runLabel(other)} on <span className="font-mono text-slate-300">{other.branch}</span>, {timeAgo(other.createdAt)}
                </span>
              </p>
            )}
            <Actions className="mt-4">
              {failing[0] && (
                <ExternalAction href={failing[0].url} variant="primary">
                  Open the failing run
                </ExternalAction>
              )}
              <ExternalAction href={`https://github.com/${tracked.repo}/actions`} icon={LuGithub}>
                All runs on GitHub
              </ExternalAction>
            </Actions>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Actions minutes

const ORG_BILLING = `https://github.com/organizations/${APPTURNITY_ORG}/settings/billing`

export async function OrgMinutes() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const org = await getOrgMinutes()
  if (!org.ok) return <PanelError message={`GitHub answered ${org.status || 'nothing'}: ${org.message}`} />
  const month = new Date().toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const usedUp = org.data.total >= FREE_ACTIONS_MINUTES
  const left = Math.max(0, FREE_ACTIONS_MINUTES - org.data.total)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Stat label={`Used in ${month}`} value={`${formatNumber(org.data.total)} / ${formatNumber(FREE_ACTIONS_MINUTES)}`} tone={usedUp ? 'bad' : undefined} hint="minutes" />
        <StatusPill tone={usedUp ? 'bad' : org.data.total / FREE_ACTIONS_MINUTES >= 0.7 ? 'warn' : 'good'}>
          {usedUp ? 'Free minutes used up' : `${formatNumber(left)} free minutes left`}
        </StatusPill>
      </div>
      <Meter value={org.data.total} max={FREE_ACTIONS_MINUTES} label={`${APPTURNITY_ORG} Actions minutes used in ${month}`} />
      {usedUp && org.data.netAmount === 0 && (
        <div role="status" className="rounded-xl bg-rose-400/[0.09] p-5 text-[15px] leading-relaxed text-rose-100">
          <p className="font-semibold">Appturnity&apos;s workflows have probably stopped.</p>
          <p className="mt-1 text-rose-100/85">
            All 2,000 free minutes are used{org.data.lastDay ? `, with no usage since ${org.data.lastDay}` : ''}, and $0 was billed. Private-repo workflows (monorepo-app) won&apos;t run until the minutes reset at the start of next month, unless you add a payment method and a budget that allows paid minutes (Linux costs $0.006 a minute).
          </p>
        </div>
      )}
      {org.data.byRepo.length > 0 && (
        <div>
          <p className="mb-3 text-[14px] font-medium text-slate-300">By repo</p>
          <BarList rows={org.data.byRepo.map((row) => ({ label: row.repo, value: row.minutes }))} format={(value) => `${formatNumber(value)} min`} />
        </div>
      )}
      <Actions>
        <ExternalAction href={ORG_BILLING} variant="primary" icon={LuGithub}>
          Open Appturnity billing on GitHub
        </ExternalAction>
        <ExternalAction href={`https://github.com/organizations/${APPTURNITY_ORG}/settings/billing/budgets`}>Set a spending budget</ExternalAction>
        <ExternalAction href={`https://github.com/${APPTURNITY_ORG}/monorepo-app/actions`}>monorepo-app runs</ExternalAction>
      </Actions>
    </div>
  )
}

export async function PersonalMinutes() {
  if (!isGitHubConnected()) return <GitHubNotConnected />
  const personal = await getPersonalMinutes()
  if (personal.ok) {
    return (
      <div className="flex flex-col gap-6">
        <Stat label="Used this month" value={`${formatNumber(personal.data.total)} / ${formatNumber(FREE_ACTIONS_MINUTES)}`} hint="minutes" />
        <Meter value={personal.data.total} max={FREE_ACTIONS_MINUTES} label="Personal Actions minutes used this month" />
        <Actions>
          <ExternalAction href="https://github.com/settings/billing" icon={LuGithub}>
            Open your billing on GitHub
          </ExternalAction>
        </Actions>
      </div>
    )
  }
  return (
    <NotConnected
      kind="needs-permission"
      why={
        <>
          GitHub answers {personal.status || 'nothing'} for your personal billing report: the token needs the account permission <b className="font-semibold text-slate-100">Plan: read</b>. All the n8builds repos are public, so they use no minutes either way.
        </>
      }
      needs={['GITHUB_TOKEN with Plan: read']}
      setupId="github"
      actions={
        <ExternalAction href="https://github.com/settings/billing" icon={LuGithub}>
          Open your billing on GitHub
        </ExternalAction>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Stars and traffic

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
  const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0)
  const stars = sum((row) => (row.repo.ok ? row.repo.data.stargazers_count : 0))
  const views = sum((row) => (row.views.ok ? row.views.data.count : 0))
  const viewers = sum((row) => (row.views.ok ? row.views.data.uniques : 0))
  const clones = sum((row) => (row.clones.ok ? row.clones.data.count : 0))
  const cloners = sum((row) => (row.clones.ok ? row.clones.data.uniques : 0))
  const traffic = (result: (typeof rows)[number]['views']) =>
    result.ok ? (
      <>
        <span className="text-slate-50">{formatNumber(result.data.count)}</span>
        <span className="block text-[14px] text-slate-400">{formatNumber(result.data.uniques)} unique</span>
      </>
    ) : (
      <span className="text-slate-400" title={result.message}>
        n/a
      </span>
    )
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <Stat label="Stars" value={formatNumber(stars)} hint={`across ${TRACKED_REPOS.length} public repos`} />
        <Stat label="Views, 14 days" value={formatNumber(views)} hint={`${formatNumber(viewers)} unique visitors`} />
        <Stat label="Clones, 14 days" value={formatNumber(clones)} hint={`${formatNumber(cloners)} unique (mostly bots)`} />
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[340px] text-left text-[15px]">
          <caption className="sr-only">Stars, and views and clones over the last 14 days, per repo</caption>
          <thead>
            <tr className="text-[14px] text-slate-400">
              <th scope="col" className="px-1 pb-3 font-medium">Repo</th>
              <th scope="col" className="px-1 pb-3 text-right font-medium">Stars</th>
              <th scope="col" className="px-1 pb-3 text-right font-medium">Views</th>
              <th scope="col" className="px-1 pb-3 text-right font-medium">Clones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] tabular-nums">
            {rows.map(({ tracked, repo, views: repoViews, clones: repoClones }) => (
              <tr key={tracked.repo}>
                <th scope="row" className="px-1 py-3.5 text-left align-top font-normal">
                  <OutLink href={`https://github.com/${tracked.repo}/graphs/traffic`} className="font-medium text-slate-50 hover:text-cyan-200">
                    {shortName(tracked.repo)}
                  </OutLink>
                  <span className="block text-[14px] text-slate-400">{tracked.label}</span>
                </th>
                <td className="px-1 py-3.5 text-right align-top text-slate-50">{repo.ok ? formatNumber(repo.data.stargazers_count) : 'n/a'}</td>
                <td className="px-1 py-3.5 text-right align-top">{traffic(repoViews)}</td>
                <td className="px-1 py-3.5 text-right align-top">{traffic(repoClones)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[14px] leading-relaxed text-slate-400">Each repo name opens its traffic graph on GitHub. Clones are mostly automated (CI, mirrors, bots), so views are the better signal of people.</p>
    </div>
  )
}
