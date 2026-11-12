import type { Metadata } from 'next'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Tabs, currentTab } from '@/components/Tabs'
import { Meter, NotConnected, PageHeader, Panel, PanelError, StatusPill } from '@/components/ui'
import { allowanceOf, anySending, formatPeople, historyMeta, isActive, nothingToPick, progressOf, projectChoices, statePill, stopReason } from '@/lib/announce-view'
import { getHistory, getProjectsAndTemplates, getSenderUsage, type Announcement, type AnnounceProject, type AnnounceTemplate } from '@/lib/announcements'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'
import { cancelAnnouncement } from './actions'
import { AutoRefresh } from './AutoRefresh'
import { Composer } from './Composer'

const area = AREAS.announcements

export const metadata: Metadata = { title: area.label }
// Always live: a send moves while you watch, and the actions change what this page shows.
export const dynamic = 'force-dynamic'

function AnnounceNotConnected() {
  return (
    <NotConnected
      why="n8builds-web holds the waitlist's addresses, the email templates and the sending; this page reaches it over the ANNOUNCE service binding to its Announcements entrypoint. It fills in once n8builds-web serves that entrypoint (a local server needs n8builds-web running under wrangler dev)."
      willShow={['Each project with its confirmed people and when it was last announced', 'Your words in a template, with a live preview and a test to yourself', 'Every announcement: sending, paused at a cap, done or cancelled']}
      needs={["ANNOUNCE (service binding to n8builds-web's Announcements)"]}
    />
  )
}

function History({ list, projects, templates, now }: { list: Announcement[]; projects: AnnounceProject[]; templates: AnnounceTemplate[]; now: number }) {
  if (list.length === 0) return <p className="text-[15px] text-slate-400">No announcement yet. The first one shows here as soon as it starts.</p>
  const name = (slug: string) => projects.find((project) => project.slug === slug)?.name ?? slug
  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh active={anySending(list)} />
      <ul className="flex flex-col divide-y divide-white/[0.06]">
        {list.map((announcement) => {
          const pill = statePill(announcement, now)
          const progress = progressOf(announcement)
          const project = name(announcement.project)
          const meta = historyMeta(announcement, templates, now)
          const stop = stopReason(announcement.lastError)
          return (
            <li key={announcement.id} aria-label={`${project}: ${announcement.subject}`} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-[15px] font-semibold text-slate-50">{project}</span>
                  <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                </div>
                <p className="text-[14px] [overflow-wrap:anywhere] text-slate-300">{announcement.subject}</p>
                {meta && <p className="text-[13px] text-slate-400">{meta}</p>}
                <div className="flex max-w-xl flex-col gap-1.5">
                  <Meter size="sm" progress value={progress.done} max={announcement.total} label={`${project}: ${progress.done} of ${announcement.total} handled`} />
                  <p className="text-[13px] text-slate-400 tabular-nums">
                    <span className="font-medium text-slate-200">{progress.label}</span>
                    {', '}
                    <span className={announcement.failed > 0 ? 'text-amber-200' : undefined} title="Failed: addresses mailroom refused, such as a bounced or suppressed one">
                      {progress.problems}
                    </span>
                  </p>
                </div>
                {stop && (
                  <p className="text-[13px] [overflow-wrap:anywhere] text-rose-200/90">
                    {announcement.state === 'paused_cap' ? 'Paused: ' : 'Last stop: '}
                    {stop}
                    {stop !== announcement.lastError && <span className="ml-1.5 font-mono text-[13px] text-slate-400">({announcement.lastError})</span>}
                  </p>
                )}
              </div>
              {isActive(announcement) && (
                <ConfirmAction
                  action={cancelAnnouncement}
                  label="Cancel"
                  ariaLabel={`Cancel the ${project} announcement`}
                  title={`Cancel the ${project} announcement?`}
                  description={`${formatPeople(announcement.sent)} already have it, and that can't be undone. The other ${formatPeople(Math.max(0, announcement.total - progress.done))} won't get it.`}
                  confirmLabel="Stop sending"
                  danger
                  note="n8builds-web records your GitHub login as who cancelled it."
                  fields={{ id: announcement.id }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const TABS = [
  { id: 'compose', label: 'Compose', title: 'New announcement' },
  { id: 'history', label: 'History', title: 'Announcements, newest first' },
] as const

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  const params = await searchParams
  const tab = currentTab(TABS, params.tab)
  const [setup, history, usage] = await Promise.all([getProjectsAndTemplates(), getHistory(), tab.id === 'compose' ? getSenderUsage() : null])
  const now = new Date().getTime()
  const active = history?.ok ? history.data.filter(isActive).length : 0
  const choices = setup?.ok ? projectChoices(setup.data.projects, now) : []
  return (
    <>
      <PageHeader area={area} />
      <div className="flex flex-col gap-5">
        <Tabs label="Announcements sections" path="/announcements" tabs={TABS} current={tab.id} counts={{ history: active }} />
        <Panel id={tab.id} title={tab.title} description={tab.id === 'compose' ? 'It goes to everyone confirmed on one project\'s waitlist, at most once in 30 days per project.' : undefined}>
          {!setup ? (
            <AnnounceNotConnected />
          ) : !setup.ok ? (
            <PanelError message={setup.message} />
          ) : tab.id === 'compose' ? (
            <Composer choices={choices} templates={setup.data.templates} allowance={history?.ok ? allowanceOf(usage, history.data, now) : null} blocked={nothingToPick(choices)} />
          ) : !history ? (
            <AnnounceNotConnected />
          ) : !history.ok ? (
            <PanelError message={history.message} />
          ) : (
            <History list={history.data} projects={setup.data.projects} templates={setup.data.templates} now={now} />
          )}
        </Panel>
      </div>
    </>
  )
}
