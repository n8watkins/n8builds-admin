import type { Metadata } from 'next'
import { Tabs, currentTab } from '@/components/Tabs'
import { PageHeader, Panel, NotConnected, PanelError, Stat, errorMessage } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'
import { countByProject, isWaitlistConnected, projectName as name, readWaitlist, type WaitlistRow } from '@/lib/waitlist'
import { deleteSignup } from './actions'

const area = AREAS.waitlist

export const metadata: Metadata = { title: area.label }
// Always the live list: it holds people's addresses, and changes as they confirm or leave.
export const dynamic = 'force-dynamic'

const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) : '')

function Row({ row }: { row: WaitlistRow }) {
  const confirmed = Boolean(row.confirmedAt)
  return (
    <tr className="border-t border-white/[0.06] align-top">
      <td className="py-3 pr-4">
        {/* Breaks before the @ when the column is narrow, not mid-word. */}
        <p className="font-medium [overflow-wrap:anywhere] text-slate-100">
          {row.email.split('@')[0]}
          <wbr />@{row.email.split('@').slice(1).join('@')}
        </p>
        <p className="mt-0.5 text-[13px] text-slate-400">{day(row.createdAt)}</p>
      </td>
      <td className="py-3 pr-4">
        <p className="text-slate-200">{row.projects.map(name).join(', ') || '-'}</p>
        {row.requested.length > 0 && <p className="mt-0.5 text-[13px] text-amber-200">Asked for: {row.requested.map(name).join(', ')}</p>}
      </td>
      <td className="py-3 pr-4">
        <span className={confirmed ? 'text-emerald-300' : 'text-amber-200'}>{confirmed ? 'Confirmed' : 'Waiting to confirm'}</span>
      </td>
      <td className="max-w-xs py-3 pr-4 text-slate-300">
        <p className="break-words whitespace-pre-wrap">{row.note || row.requestedNote || ''}</p>
      </td>
      <td className="py-3 pr-4 text-[13px] text-slate-400">
        {row.interest && <p>Interest: {name(row.interest)}</p>}
        {/* Without its scheme, a landing page's address fits the column instead of breaking mid-word. */}
        {row.referrer && (
          <p className="[overflow-wrap:anywhere]" title={row.referrer}>
            From: {row.referrer.replace(/^https?:\/\//, '')}
          </p>
        )}
      </td>
      <td className="py-3 text-right">
        <form action={deleteSignup}>
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            aria-label={`Delete ${row.email}`}
            className="rounded-lg px-3 py-1.5 text-[13px] text-slate-300 ring-1 ring-white/10 hover:bg-rose-500/15 hover:text-rose-200"
          >
            Delete
          </button>
        </form>
      </td>
    </tr>
  )
}

function WaitlistNotConnected() {
  return (
    <NotConnected
      why="Shows who joined the waitlist on n8builds.dev/upcoming, and for which projects."
      willShow={['Confirmed sign-ups per project', 'Every entry with its note and source']}
      needs={['WAITLIST_DB (D1 binding)']}
      setupId="databases"
    />
  )
}

function Summary({ rows }: { rows: WaitlistRow[] }) {
  return (
    // Five projects and the waiting count: six even tiles, two by two on phones, three to a row from sm.
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
      {countByProject(rows).map((c) => (
        <Stat key={c.slug} label={c.name} value={c.confirmed} hint="confirmed" />
      ))}
      <Stat label="Waiting to confirm" value={rows.filter((r) => !r.confirmedAt).length} hint="expire after 7 days" />
    </div>
  )
}

function SignUps({ rows }: { rows: WaitlistRow[] }) {
  if (rows.length === 0) return <p className="text-[15px] text-slate-400">Nobody has joined yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[14px]">
        <thead className="text-[13px] text-slate-400">
          <tr>
            <th className="pb-2 font-medium">Email</th>
            <th className="pb-2 font-medium">Projects</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Note</th>
            <th className="pb-2 font-medium">Source</th>
            <th className="pb-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BccLists({ rows }: { rows: WaitlistRow[] }) {
  const lists = countByProject(rows).filter((c) => c.confirmed > 0)
  if (lists.length === 0) return <p className="text-[15px] text-slate-400">No confirmed addresses yet.</p>
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] text-slate-300">Add the leave page (n8builds.dev/upcoming/leave) to every email.</p>
      {lists.map((c) => (
        <label key={c.slug} className="flex flex-col gap-1.5 text-[13px] text-slate-400">
          {c.name}
          <textarea readOnly rows={2} value={c.emails.join(', ')} className="rounded-lg bg-white/[0.04] p-2.5 font-mono text-[13px] text-slate-200 ring-1 ring-white/10" />
        </label>
      ))}
    </div>
  )
}

const TABS = [
  { id: 'summary', label: 'Summary', title: 'Confirmed per project' },
  { id: 'signups', label: 'Sign-ups', title: 'Sign-ups, newest first' },
  { id: 'bcc', label: 'Bcc lists', title: 'Bcc lists' },
] as const

async function load(): Promise<{ state: 'off' } | { state: 'error'; message: string } | { state: 'ok'; rows: WaitlistRow[] }> {
  if (!(await isWaitlistConnected())) return { state: 'off' }
  try {
    return { state: 'ok', rows: await readWaitlist() }
  } catch (error) {
    return { state: 'error', message: errorMessage(error) }
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner()
  const tab = currentTab(TABS, (await searchParams).tab)
  const list = await load()
  return (
    <>
      <PageHeader area={area} />
      <div className="flex flex-col gap-5">
        <Tabs label="Waitlist sections" path={area.href} tabs={TABS} current={tab.id} counts={list.state === 'ok' ? { signups: list.rows.length } : {}} />
        <Panel id={tab.id} title={tab.title}>
          {list.state === 'off' ? (
            <WaitlistNotConnected />
          ) : list.state === 'error' ? (
            <PanelError message={list.message} />
          ) : tab.id === 'summary' ? (
            <Summary rows={list.rows} />
          ) : tab.id === 'signups' ? (
            <SignUps rows={list.rows} />
          ) : (
            <BccLists rows={list.rows} />
          )}
        </Panel>
      </div>
    </>
  )
}
