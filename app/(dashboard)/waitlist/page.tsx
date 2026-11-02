import type { Metadata } from 'next'
import { PageHeader, Panel, NotConnected, PanelError, Stat, errorMessage } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'
import { isStoreConnected } from '@/lib/store'
import { countByProject, projectName as name, readWaitlist, type WaitlistRow } from '@/lib/waitlist'
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
        <p className="font-medium break-all text-slate-100">{row.email}</p>
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
        {row.referrer && <p className="break-all">From: {row.referrer}</p>}
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

async function List() {
  if (!isStoreConnected()) {
    return (
      <NotConnected
        why="Shows who joined the waitlist on n8builds.dev/upcoming, and for which projects."
        willShow={['Confirmed sign-ups per project', 'Every entry with its note and source']}
        needs={['ANALYTICS_REDIS_REST_URL', 'ANALYTICS_REDIS_REST_TOKEN']}
        setupId="upstash"
      />
    )
  }
  let rows: WaitlistRow[]
  try {
    rows = await readWaitlist()
  } catch (error) {
    return <PanelError message={errorMessage(error)} />
  }
  const counts = countByProject(rows)
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {counts.map((c) => (
          <Stat key={c.slug} label={c.name} value={c.confirmed} hint="confirmed" />
        ))}
        <Stat label="Waiting to confirm" value={rows.filter((r) => !r.confirmedAt).length} hint="expire after 7 days" />
      </div>
      {rows.length === 0 ? (
        <p className="text-[15px] text-slate-400">Nobody has joined yet.</p>
      ) : (
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
      )}
      {counts.some((c) => c.confirmed > 0) && (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-slate-300">
            Confirmed addresses per project, to paste into Bcc. Add the leave page (n8builds.dev/upcoming/leave) to every email.
          </p>
          {counts
            .filter((c) => c.confirmed > 0)
            .map((c) => (
              <label key={c.slug} className="flex flex-col gap-1.5 text-[13px] text-slate-400">
                {c.name}
                <textarea
                  readOnly
                  rows={2}
                  value={c.emails.join(', ')}
                  className="rounded-lg bg-white/[0.04] p-2.5 font-mono text-[13px] text-slate-200 ring-1 ring-white/10"
                />
              </label>
            ))}
        </div>
      )}
    </div>
  )
}

export default async function Page() {
  await requireOwner()
  return (
    <>
      <PageHeader area={area} />
      <Panel id="waitlist" title="Sign-ups" description="Newest first. Delete removes the address and everything stored with it.">
        <List />
      </Panel>
    </>
  )
}
