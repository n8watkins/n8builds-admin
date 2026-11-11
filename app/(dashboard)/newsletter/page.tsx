import type { Metadata } from 'next'
import { LuTriangleAlert } from 'react-icons/lu'
import { Tabs, currentTab } from '@/components/Tabs'
import { NotConnected, PageHeader, Panel, PanelError, Stat, StatusPill, cx, errorMessage, type Tone } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'
import { formatNumber } from '@/lib/format'
import { DIGEST_LIMIT, SUBSCRIBER_LIMIT, isStuck, readNewsletter, shortDate, shortDateTime, type Digest, type Newsletter, type SubscriberStatus } from '@/lib/newsletter'
import { isWaitlistConnected } from '@/lib/waitlist'

const area = AREAS.newsletter

export const metadata: Metadata = { title: area.label }
// Always live: it counts people's sign-ups, and a digest changes as it sends.
export const dynamic = 'force-dynamic'

function digestPill(digest: Digest, now: number): { tone: Tone; label: string } {
  if (digest.status === 'sent') return { tone: 'good', label: 'Sent' }
  if (digest.status === 'skipped') return { tone: 'idle', label: 'Skipped' }
  return isStuck(digest, now) ? { tone: 'warn', label: 'Stuck sending' } : { tone: 'running', label: 'Sending' }
}

const SUBSCRIBER: Record<SubscriberStatus, { tone: Tone; label: string }> = {
  confirmed: { tone: 'good', label: 'Confirmed' },
  pending: { tone: 'running', label: 'Pending' },
  expired: { tone: 'idle', label: 'Expired' },
}

function NewsletterNotConnected() {
  return (
    <NotConnected
      why="Shows who signed up for new N8's Notions posts by email, and how each weekly digest went."
      willShow={['Confirmed and pending readers', 'Each digest with its recipients', 'Skipped weeks and why']}
      needs={['WAITLIST_DB (D1 binding)']}
      setupId="databases"
    />
  )
}

function NotLiveYet() {
  return (
    <NotConnected
      title="Not live yet"
      why="n8builds-web's newsletter tables (its migrations/waitlist/0002_newsletter.sql) aren't in n8builds-waitlist yet. This page fills in as soon as they are."
      willShow={['Confirmed and pending readers', 'Each digest with its recipients', 'Skipped weeks and why']}
    />
  )
}

/** The digest stuck in 'sending', called out above every tab. */
function StuckBanner({ digest }: { digest: Digest }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl bg-amber-300/[0.08] p-4 text-[15px] text-amber-100 ring-1 ring-inset ring-amber-300/25">
      <LuTriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-200" />
      <p>
        <span className="font-semibold">The digest of {shortDate(digest.createdAt)} is still sending</span>{' '}
        <span className="text-amber-100/80">
          ({formatNumber(digest.delivered)} of {formatNumber(digest.recipients)} delivered, started {shortDateTime(digest.createdAt)}).
          {digest.note ? ` ${digest.note}` : ' The next cron run resumes it; if it stays stuck, check mailroom.'}
        </span>
      </p>
    </div>
  )
}

function Summary({ data, now }: { data: Newsletter; now: number }) {
  const { confirmed, pending, expired } = data.counts
  const last = data.digests[0]
  const pill = last ? digestPill(last, now) : null
  return (
    <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
      <Stat label="Confirmed" value={formatNumber(confirmed)} hint="get every digest" />
      <Stat label="Waiting to confirm" value={formatNumber(pending)} hint="inside their 7 days" />
      <Stat label="Expired" value={formatNumber(expired)} hint="never confirmed" />
      <div className="min-w-0">
        <p className="text-[14px] text-slate-400">Last digest</p>
        <p className="mt-1 text-[30px] leading-tight font-semibold text-slate-50 tabular-nums">{last ? shortDate(last.createdAt) : '-'}</p>
        {last && pill ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-slate-400">
            <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
            <span className="tabular-nums">{last.status === 'sending' ? `${formatNumber(last.delivered)} of ${formatNumber(last.recipients)}` : `${formatNumber(last.recipients)} ${last.recipients === 1 ? 'recipient' : 'recipients'}`}</span>
          </p>
        ) : (
          <p className="mt-1 text-[14px] text-slate-400">none yet</p>
        )}
      </div>
    </div>
  )
}

const recipientsText = (digest: Digest) =>
  digest.status === 'sending' ? `${formatNumber(digest.delivered)} of ${formatNumber(digest.recipients)}` : digest.status === 'skipped' ? '-' : formatNumber(digest.recipients)

const postsText = (digest: Digest) => (digest.posts ? `${formatNumber(digest.posts.length)} ${digest.posts.length === 1 ? 'post' : 'posts'}` : 'Posts unreadable')

/** Its reason, if any. The full reason of a skipped week is under Skipped weeks; here, two lines and the rest on hover. */
function Note({ digest }: { digest: Digest }) {
  if (!digest.note) return null
  return (
    <p title={digest.note} className="mt-1.5 line-clamp-2 max-w-xs text-[13px] text-slate-400">
      {digest.note}
    </p>
  )
}

function Titles({ digest }: { digest: Digest }) {
  if (!digest.posts || digest.posts.length === 0) return null
  return <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-400">{digest.posts.join(', ')}</p>
}

function Digests({ data, now }: { data: Newsletter; now: number }) {
  if (data.digests.length === 0) return <p className="text-[15px] text-slate-400">No digest has gone out yet: the first goes out the week after a new post.</p>
  return (
    <div className="flex flex-col gap-3">
      {/* Phones: one compact block per digest. */}
      <ul className="flex flex-col sm:hidden">
        {data.digests.map((digest) => {
          const pill = digestPill(digest, now)
          return (
            <li key={digest.id} className="border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] text-slate-100 tabular-nums">{shortDateTime(digest.createdAt)}</p>
                <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
              </div>
              <p className="mt-1 text-[13px] text-slate-300 tabular-nums">
                {postsText(digest)}
                {digest.status !== 'skipped' && `, ${recipientsText(digest)} ${digest.status === 'sending' ? 'delivered' : 'recipients'}`}
                {digest.finishedAt && digest.status === 'sent' && `, done ${shortDateTime(digest.finishedAt)}`}
              </p>
              <Titles digest={digest} />
              <Note digest={digest} />
            </li>
          )
        })}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[600px] text-left text-[14px]">
          <thead className="text-[13px] text-slate-400">
            <tr>
              <th className="pr-4 pb-2 font-medium">Started</th>
              <th className="pr-4 pb-2 font-medium">Status</th>
              <th className="pr-4 pb-2 font-medium">Posts</th>
              <th className="pr-4 pb-2 font-medium">Recipients</th>
              <th className="pb-2 font-medium">Finished</th>
            </tr>
          </thead>
          <tbody>
            {data.digests.map((digest) => {
              const pill = digestPill(digest, now)
              return (
                <tr key={digest.id} className="border-t border-white/[0.06] align-top">
                  <td className="py-3 pr-4 whitespace-nowrap text-slate-100 tabular-nums">{shortDateTime(digest.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                    <Note digest={digest} />
                  </td>
                  <td className="max-w-xs py-3 pr-4">
                    <p className="text-slate-100 tabular-nums">{digest.posts ? formatNumber(digest.posts.length) : 'Unreadable'}</p>
                    <Titles digest={digest} />
                  </td>
                  <td className={cx('py-3 pr-4 whitespace-nowrap tabular-nums', digest.status === 'skipped' ? 'text-slate-400' : 'text-slate-100')}>{recipientsText(digest)}</td>
                  <td className="py-3 whitespace-nowrap text-slate-300 tabular-nums">{digest.finishedAt ? shortDateTime(digest.finishedAt) : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {data.digests.length === DIGEST_LIMIT && <p className="text-[13px] text-slate-400">The newest {DIGEST_LIMIT}.</p>}
    </div>
  )
}

function Skipped({ data }: { data: Newsletter }) {
  const skipped = data.digests.filter((digest) => digest.status === 'skipped')
  if (skipped.length === 0) return <p className="text-[15px] text-slate-400">No week has been skipped.</p>
  return (
    <ul className="flex flex-col gap-3">
      {skipped.map((digest) => (
        <li key={digest.id} className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-medium text-slate-100 tabular-nums">Week of {shortDate(digest.createdAt)}</p>
            <p className="text-[13px] text-slate-400 tabular-nums">
              {postsText(digest)}, {formatNumber(digest.recipients)} would-be recipients
            </p>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-300">{digest.note || 'No reason recorded.'}</p>
        </li>
      ))}
    </ul>
  )
}

function Subscribers({ data }: { data: Newsletter }) {
  if (data.subscribers.length === 0) return <p className="text-[15px] text-slate-400">Nobody has signed up yet.</p>
  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-left text-[14px]">
        <thead className="text-[13px] text-slate-400">
          <tr>
            <th className="pr-4 pb-2 font-medium">Address</th>
            <th className="pr-4 pb-2 font-medium">Status</th>
            {/* Phones show both dates under the address instead. */}
            <th className="hidden pr-4 pb-2 font-medium sm:table-cell">Signed up</th>
            <th className="hidden pb-2 font-medium sm:table-cell">Confirmed</th>
          </tr>
        </thead>
        <tbody>
          {data.subscribers.map((subscriber, index) => (
            <tr key={index} className="border-t border-white/[0.06]">
              <td className="py-2.5 pr-4">
                <p className="font-mono text-[13px] [overflow-wrap:anywhere] text-slate-100">{subscriber.address}</p>
                <p className="mt-0.5 text-[13px] text-slate-400 tabular-nums sm:hidden">
                  <span className="whitespace-nowrap">{shortDate(subscriber.createdAt)}</span>
                  {subscriber.confirmedAt && (
                    <>
                      , <span className="whitespace-nowrap">confirmed {shortDate(subscriber.confirmedAt)}</span>
                    </>
                  )}
                </p>
              </td>
              <td className="py-2.5 pr-4">
                <StatusPill tone={SUBSCRIBER[subscriber.status].tone}>{SUBSCRIBER[subscriber.status].label}</StatusPill>
              </td>
              <td className="hidden py-2.5 pr-4 whitespace-nowrap text-slate-300 tabular-nums sm:table-cell">{shortDate(subscriber.createdAt)}</td>
              <td className="hidden py-2.5 whitespace-nowrap text-slate-300 tabular-nums sm:table-cell">{subscriber.confirmedAt ? shortDate(subscriber.confirmedAt) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[13px] text-slate-400">Addresses are masked; {data.subscribers.length === SUBSCRIBER_LIMIT ? `the newest ${SUBSCRIBER_LIMIT}` : 'newest first'}.</p>
    </div>
  )
}

const TABS = [
  { id: 'summary', label: 'Summary', title: 'Readers and the last digest' },
  { id: 'digests', label: 'Digests', title: 'Recent digests' },
  { id: 'skipped', label: 'Skipped weeks', title: 'Skipped weeks' },
  { id: 'subscribers', label: 'Subscribers', title: 'Subscribers, newest first' },
] as const

type Loaded = { state: 'off' } | { state: 'no-tables' } | { state: 'error'; message: string } | { state: 'ok'; data: Newsletter }

async function load(now: Date): Promise<Loaded> {
  if (!(await isWaitlistConnected())) return { state: 'off' }
  try {
    const data = await readNewsletter(now)
    return data === 'no-tables' ? { state: 'no-tables' } : { state: 'ok', data }
  } catch (error) {
    return { state: 'error', message: errorMessage(error) }
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner()
  const tab = currentTab(TABS, (await searchParams).tab)
  const now = new Date()
  const list = await load(now)
  const at = now.getTime()
  const stuck = list.state === 'ok' ? list.data.digests.find((digest) => isStuck(digest, at)) : undefined
  const counts =
    list.state === 'ok'
      ? { digests: list.data.digests.length, skipped: list.data.digests.filter((digest) => digest.status === 'skipped').length, subscribers: list.data.subscribers.length }
      : {}
  return (
    <>
      <PageHeader area={area} />
      <div className="flex flex-col gap-5">
        {stuck && <StuckBanner digest={stuck} />}
        <Tabs label="Newsletter sections" path={area.href} tabs={TABS} current={tab.id} counts={counts} />
        <Panel id={tab.id} title={tab.title}>
          {list.state === 'off' ? (
            <NewsletterNotConnected />
          ) : list.state === 'no-tables' ? (
            <NotLiveYet />
          ) : list.state === 'error' ? (
            <PanelError message={list.message} />
          ) : tab.id === 'summary' ? (
            <Summary data={list.data} now={at} />
          ) : tab.id === 'digests' ? (
            <Digests data={list.data} now={at} />
          ) : tab.id === 'skipped' ? (
            <Skipped data={list.data} />
          ) : (
            <Subscribers data={list.data} />
          )}
        </Panel>
      </div>
    </>
  )
}
