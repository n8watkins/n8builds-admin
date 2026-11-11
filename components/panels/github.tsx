import { LuGithub, LuInfo } from 'react-icons/lu'
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
import { ProjectIcon } from '../ProjectIcon'
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
              <div className="flex min-w-0 items-center gap-3">
                <ProjectIcon repo={tracked.repo} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold text-slate-50">{tracked.label}</p>
                  <p className="truncate font-mono text-[13px] text-slate-400">
                    {shortName(tracked.repo)} · {defaultBranch}
                  </p>
                </div>
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
                      <span className="sr-only">{`: ${runLabel(run)},`}</span>
                      <span className="text-slate-400">{timeAgo(run.createdAt)}</span>
                      <span className="sr-only">(opens in a new tab)</span>
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
                <ExternalAction href={failing[0].url} variant="primary" describe={`Open the failing ${failing[0].workflow} run on GitHub`}>
                  Failing run
                </ExternalAction>
              )}
              <ExternalAction href={`https://github.com/${tracked.repo}/actions`} icon={LuGithub} describe={`All ${shortName(tracked.repo)} runs on GitHub`}>
                Runs
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
        <ExternalAction href={ORG_BILLING} variant="primary" icon={LuGithub} describe="Open Appturnity billing on GitHub">
          Billing
        </ExternalAction>
        <ExternalAction href={`https://github.com/organizations/${APPTURNITY_ORG}/settings/billing/budgets`} describe="Set an Actions spending budget for Appturnity">
          Budget
        </ExternalAction>
        <ExternalAction href={`https://github.com/${APPTURNITY_ORG}/monorepo-app/actions`} describe="monorepo-app workflow runs on GitHub">
          Runs
        </ExternalAction>
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
          <ExternalAction href="https://github.com/settings/billing" icon={LuGithub} describe="Open your personal billing on GitHub">
            Billing
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
        <ExternalAction href="https://github.com/settings/billing" icon={LuGithub} describe="Open your personal billing on GitHub">
          Billing
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
  // Most viewed first: views are the signal of people.
  const sorted = [...rows].sort((a, b) => (b.views.ok ? b.views.data.count : -1) - (a.views.ok ? a.views.data.count : -1))
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6">
        <Stat label="Stars" value={formatNumber(stars)} hint={`across ${TRACKED_REPOS.length} public repos`} />
        <Stat label="Repo views, 14 days" value={formatNumber(views)} hint={`${formatNumber(viewers)} different people`} />
      </div>
      <ul className="-my-2 divide-y divide-white/[0.06]">
        {sorted.map(({ tracked, repo, views: repoViews, clones: repoClones }) => (
          <li key={tracked.repo} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
            <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
              <ProjectIcon repo={tracked.repo} size={36} />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-slate-50">{tracked.label}</p>
                <p className="truncate font-mono text-[13px] text-slate-400">{shortName(tracked.repo)}</p>
              </div>
            </div>
            <dl className="flex items-center gap-6 text-right tabular-nums">
              <div className="w-14">
                <dt className="text-[13px] text-slate-400">Stars</dt>
                <dd className="text-[17px] font-semibold text-slate-50">{repo.ok ? repo.data.stargazers_count : 'n/a'}</dd>
              </div>
              <div className="w-24">
                <dt className="text-[13px] text-slate-400">Views</dt>
                <dd className="text-[17px] font-semibold text-slate-50">
                  {repoViews.ok ? formatNumber(repoViews.data.count) : 'n/a'}
                  {repoViews.ok && <span className="ml-1 text-[13px] font-normal text-slate-400">({repoViews.data.uniques})</span>}
                </dd>
              </div>
              <div className="w-16">
                <dt className="text-[13px] text-slate-400">Clones</dt>
                <dd className="text-[15px] text-slate-400">{repoClones.ok ? formatNumber(repoClones.data.count) : 'n/a'}</dd>
              </div>
            </dl>
            <OutLink href={`https://github.com/${tracked.repo}/graphs/traffic`} className="text-[14px]">
              Traffic
            </OutLink>
          </li>
        ))}
      </ul>
      {/* The explanation opens on demand, like a page's About. */}
      <details className="group text-[14px] leading-relaxed text-slate-300">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md font-medium text-slate-400 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 [&::-webkit-details-marker]:hidden">
          <LuInfo aria-hidden className="size-4 text-yellow-200" />
          Why views, not clones
        </summary>
        <p className="mt-3 max-w-3xl rounded-xl bg-white/[0.025] p-4 ring-1 ring-inset ring-white/[0.05]">
          Views (in brackets: different people) are visits to the repo&apos;s page on GitHub, so they are people looking. Clones ({formatNumber(clones)} in 14 days) count every <code className="font-mono text-[0.9em]">git clone</code>: GitHub Actions checking out the code for CI, Vercel, Render and Firebase builds, Dependabot, and your own machines. GitHub doesn&apos;t say who cloned, so thousands of clones on a repo with busy CI (like Solara) are almost certainly automation, not people.
        </p>
      </details>
    </div>
  )
}
