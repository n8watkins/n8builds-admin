import Link from 'next/link'
import { LuArrowRight, LuGithub, LuStar, LuTag } from 'react-icons/lu'
import { AREAS } from '@/lib/areas'
import { timeAgo, formatNumber } from '@/lib/format'
import { getSummaries, type Summary, type Tone } from '@/lib/overview'
import { getProjects, getPulse, type ProjectTile } from '@/lib/pulse'
import { TRACKED_REPOS, shortName } from '@/lib/repos'
import { allSetupStatuses } from '@/lib/setup-status'
import { ProjectIcon } from './ProjectIcon'
import { Sparkline } from './Sparkline'
import { Actions, AreaIcon, CARD, Dot, ExternalAction, InternalAction, OutLink, StatusPill, cx, type Tone as PillTone } from './ui'

const HEADLINE: Record<Tone, string> = {
  bad: 'text-rose-300',
  warn: 'text-amber-200',
  good: 'text-emerald-300',
  quiet: 'text-slate-50',
  off: 'text-slate-400',
}

const PILL: Record<Tone, PillTone> = { bad: 'bad', warn: 'warn', good: 'good', quiet: 'idle', off: 'idle' }

// ---------------------------------------------------------------------------
// The strip: the five numbers to read first

function StripCell({ href, label, children, className }: { href: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx('group flex min-w-0 flex-col gap-1 p-5 transition-colors hover:bg-white/[0.03] sm:p-6', className)}>
      <span className="flex items-center justify-between gap-2 text-[14px] text-slate-400">
        {label}
        <LuArrowRight aria-hidden className="size-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
      </span>
      {children}
    </Link>
  )
}

export async function OverviewStrip() {
  const [pulse, summaries] = await Promise.all([getPulse(), getSummaries()])
  const attention = summaries.filter((summary) => summary.tone === 'bad' || summary.tone === 'warn')
  const failingCi = pulse.ci.total - pulse.ci.passing
  return (
    <section aria-label="At a glance" className={cx(CARD, 'mb-12 grid grid-cols-2 overflow-hidden lg:grid-cols-5 [&>*]:border-white/[0.06] max-lg:[&>*:nth-child(odd)]:border-r max-lg:[&>*:nth-child(n+3)]:border-t lg:[&>*:not(:first-child)]:border-l')}>
      <StripCell href="#attention" label="Needs attention">
        <span className={cx('text-[32px] leading-tight font-semibold tabular-nums', attention.length > 0 ? 'text-rose-300' : 'text-emerald-300')}>{attention.length}</span>
        <span className="truncate text-[14px] text-slate-300">{attention.length > 0 ? attention.map((summary) => AREAS[summary.area].label).join(', ') : 'Nothing right now'}</span>
      </StripCell>
      <StripCell href="/ci" label="CI passing">
        <span className={cx('text-[32px] leading-tight font-semibold tabular-nums', failingCi > 0 ? 'text-rose-300' : 'text-emerald-300')}>
          {pulse.ci.passing}
          <span className="text-[20px] text-slate-400"> / {pulse.ci.total}</span>
        </span>
        <span className="text-[14px] text-slate-300">{failingCi > 0 ? `${failingCi} workflows failing` : 'workflows passing'}</span>
      </StripCell>
      <StripCell href="/repos" label="Stars">
        <span className="text-[32px] leading-tight font-semibold text-slate-50 tabular-nums">{formatNumber(pulse.stars.total)}</span>
        <span className="text-[14px] text-yellow-200">+{pulse.stars.gained30d} in 30 days</span>
        <Sparkline values={pulse.stars.series} label="Total stars over the last 30 days" color="var(--color-yellow-300)" height={32} />
      </StripCell>
      <StripCell href="/repos" label="Repo views">
        <span className="text-[32px] leading-tight font-semibold text-slate-50 tabular-nums">{formatNumber(pulse.views.total)}</span>
        <span className="text-[14px] text-slate-300">{formatNumber(pulse.views.uniques)} people, 14 days</span>
        <Sparkline values={pulse.views.series} label="Repo views per day over the last 14 days" color="var(--color-sky-400)" height={32} />
      </StripCell>
      <StripCell href="/demos" label="Live demos" className="col-span-2 lg:col-span-1">
        {pulse.demos ? (
          <>
            <span className={cx('text-[32px] leading-tight font-semibold tabular-nums', pulse.demos.offHours ? 'text-slate-200' : pulse.demos.up === pulse.demos.total ? 'text-emerald-300' : 'text-rose-300')}>
              {pulse.demos.offHours ? 'Asleep' : `${pulse.demos.up} / ${pulse.demos.total}`}
            </span>
            <span className="text-[14px] text-slate-300">{pulse.demos.offHours ? 'off-hours, on purpose' : 'online now'}</span>
          </>
        ) : (
          <span className="text-[16px] text-slate-300">OpenPing unreachable</span>
        )}
      </StripCell>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Area cards

function SummaryCard({ summary, prominent }: { summary: Summary; prominent?: boolean }) {
  const area = AREAS[summary.area]
  return (
    <article
      className={cx(
        CARD,
        'flex min-w-0 flex-col p-6 sm:p-7',
        prominent && summary.tone === 'bad' && 'bg-[#1a0f1d] ring-rose-400/25',
        prominent && summary.tone === 'warn' && 'bg-[#1a160f] ring-amber-300/20',
      )}>
      <div className="flex min-w-0 items-center gap-3">
        <AreaIcon area={area} />
        <h3 className="min-w-0 truncate text-[17px] font-semibold text-slate-50">{summary.label ?? area.label}</h3>
      </div>
      {summary.tone !== 'quiet' && (
        <div className="mt-5">
          <StatusPill tone={PILL[summary.tone]}>{summary.status}</StatusPill>
        </div>
      )}
      <p className={cx('mt-3 text-[36px] leading-tight font-semibold tracking-tight tabular-nums', HEADLINE[summary.tone], summary.tone === 'quiet' && 'mt-5')}>{summary.headline}</p>
      <p className="mt-2 text-[15px] text-slate-200">{summary.detail}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{area.summary}</p>
      <Actions className="mt-auto pt-6">
        {summary.action && (
          <ExternalAction href={summary.action.href} describe={summary.action.describe} variant={prominent ? 'primary' : 'secondary'}>
            {summary.action.label}
          </ExternalAction>
        )}
        <InternalAction href={area.href} describe={`${area.label} details`} variant={summary.action ? 'quiet' : 'secondary'}>
          Details
        </InternalAction>
      </Actions>
    </article>
  )
}

function OffCard({ summary }: { summary: Summary }) {
  const area = AREAS[summary.area]
  return (
    <Link href={area.href} className={cx(CARD, 'group flex min-w-0 items-center gap-4 p-5 transition-colors hover:bg-[#0e1730]')}>
      <AreaIcon area={area} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-slate-100">{area.label}</span>
        <span className="block text-[14px] text-slate-400">{summary.detail}</span>
      </span>
      <LuArrowRight aria-hidden className="size-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Builds: one tile per project

const CI_LABEL: Record<ProjectTile['ci'], string> = { good: 'CI passing', bad: 'CI failing', idle: 'No CI' }

function ProjectCard({ project }: { project: ProjectTile }) {
  const tracked = TRACKED_REPOS.find((item) => item.repo === project.repo)!
  return (
    <article className={cx(CARD, 'flex min-w-0 flex-col p-5 sm:p-6')}>
      <div className="flex min-w-0 items-center gap-3">
        <ProjectIcon repo={project.repo} size={40} />
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold text-slate-50">{tracked.label}</h3>
          <p className="truncate font-mono text-[13px] text-slate-400">{shortName(project.repo)}</p>
        </div>
      </div>
      <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
        <div>
          <dt className="sr-only">CI</dt>
          <dd className={cx('flex items-center gap-1.5', project.ci === 'bad' ? 'text-rose-200' : 'text-slate-300')}>
            <Dot tone={project.ci} />
            {project.ci === 'bad' ? `${project.failing} failing` : CI_LABEL[project.ci]}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Stars</dt>
          <dd className="flex items-center gap-1.5 text-slate-300">
            <LuStar aria-hidden className="size-4 text-yellow-200" />
            {project.stars ?? 'n/a'}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Repo views, 14 days</dt>
          <dd className="text-slate-300">{project.views === null ? 'n/a' : `${formatNumber(project.views)} views`}</dd>
        </div>
      </dl>
      <p className="mt-3 flex min-w-0 items-center gap-1.5 text-[14px] text-slate-400">
        <LuTag aria-hidden className="size-4 shrink-0 text-teal-300" />
        {project.release ? (
          <span className="truncate">
            <OutLink href={project.release.url} className="font-mono text-teal-200 hover:text-teal-100">
              {project.release.tag}
            </OutLink>{' '}
            {timeAgo(project.release.publishedAt)}
          </span>
        ) : (
          'No releases yet'
        )}
      </p>
      <Actions className="mt-auto pt-5">
        <ExternalAction href={tracked.site} describe={`Open ${tracked.label}`}>
          Site
        </ExternalAction>
        <ExternalAction href={`https://github.com/${project.repo}`} describe={`Open ${shortName(project.repo)} on GitHub`} icon={LuGithub}>
          Repo
        </ExternalAction>
      </Actions>
    </article>
  )
}

// ---------------------------------------------------------------------------

export async function OverviewCards() {
  const [summaries, projects, setup] = await Promise.all([getSummaries(), getProjects(), allSetupStatuses()])
  const attention = summaries.filter((summary) => summary.tone === 'bad' || summary.tone === 'warn').sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1))
  const live = summaries.filter((summary) => summary.tone === 'good' || summary.tone === 'quiet')
  const off = summaries.filter((summary) => summary.tone === 'off')
  const checkable = setup.filter(({ status }) => status.state !== 'manual')
  const done = checkable.filter(({ status }) => status.state === 'done').length
  // Failing builds first, then most viewed.
  const sortedProjects = [...projects].sort((a, b) => Number(b.ci === 'bad') - Number(a.ci === 'bad') || (b.views ?? 0) - (a.views ?? 0))
  return (
    <div className="space-y-14">
      {attention.length > 0 && (
        <section aria-labelledby="attention-title" id="attention" className="scroll-mt-24">
          <h2 className="mb-5 text-[20px] font-semibold text-slate-50" id="attention-title">
            Needs attention
          </h2>
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {attention.map((summary) => (
              <SummaryCard key={summary.key} summary={summary} prominent />
            ))}
          </div>
        </section>
      )}
      {sortedProjects.length > 0 && (
        <section aria-labelledby="builds">
          <div className="mb-5">
            <h2 id="builds" className="text-[20px] font-semibold text-slate-50">
              Your builds
            </h2>
            <p className="mt-1 text-[15px] text-slate-400">Every public build on n8builds.dev. Failing ones first, then the most viewed on GitHub (14 days).</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sortedProjects.map((project) => (
              <ProjectCard key={project.repo} project={project} />
            ))}
          </div>
        </section>
      )}
      {live.length > 0 && (
        <section aria-labelledby="all-good">
          <h2 id="all-good" className="mb-5 text-[20px] font-semibold text-slate-50">
            {attention.length > 0 ? 'Everything else' : 'All good'}
          </h2>
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {live.map((summary) => (
              <SummaryCard key={summary.key} summary={summary} />
            ))}
          </div>
        </section>
      )}
      {(off.length > 0 || done < checkable.length) && (
        <section aria-labelledby="not-connected">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="not-connected" className="text-[20px] font-semibold text-slate-50">
                Not connected yet
              </h2>
              <p className="mt-1 text-[15px] text-slate-400">Each needs an account or a token you create once.</p>
            </div>
            <InternalAction href="/setup" variant="primary" describe="Open the setup checklist">
              Setup: {done} of {checkable.length} done
            </InternalAction>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {off.map((summary) => (
              <OffCard key={summary.key} summary={summary} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function StripSkeleton() {
  return <div aria-busy="true" aria-label="Loading" className="mb-12 h-[420px] animate-pulse rounded-2xl bg-white/[0.03] lg:h-[190px]" />
}

export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-[260px] animate-pulse rounded-2xl bg-white/[0.03]" />
      ))}
    </div>
  )
}
