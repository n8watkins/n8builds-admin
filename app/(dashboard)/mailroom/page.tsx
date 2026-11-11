import type { Metadata } from 'next'
import Link from 'next/link'
import { Slot } from '@/components/Slot'
import { Meter, NotConnected, PageHeader, Panel, PanelError, StatusPill, cx, type Tone } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'
import { formatNumber, timeAgo } from '@/lib/format'
import {
  WARN_SHARE,
  appName,
  getAuditLog,
  getEmailUsage,
  getProblems,
  getRecentSends,
  getSuppressions,
  type AppUsage,
  type EmailUsage,
} from '@/lib/mailroom'
import { removeSuppression, setDailyCap, setPaused } from './actions'
import { ConfirmAction } from './ConfirmAction'

const area = AREAS.mailroom

export const metadata: Metadata = { title: area.label }

// Always live: the actions change what this page shows.
export const dynamic = 'force-dynamic'

function MailroomNotConnected() {
  return (
    <NotConnected
      why="Reads mailroom, the Worker that sends every app's email, over the MAILROOM service binding. It is bound on the deployed admin; a local server needs mailroom running under wrangler dev."
      willShow={['Emails this month per app against the 3,000 included', 'Each app\'s day and month against its caps', 'Recent sends, bounces and the suppression list']}
      needs={['MAILROOM (service binding to mailroom\'s MailroomAdmin)']}
    />
  )
}

const shareTone = (value: number, max: number): Extract<Tone, 'good' | 'warn' | 'bad'> => (max > 0 && value >= max ? 'bad' : max > 0 && value / max >= WARN_SHARE ? 'warn' : 'good')
const time = (at: number) => new Date(at).toISOString().slice(0, 16).replace('T', ' ')

const TILE = 'flex min-w-0 flex-col gap-2 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06]'

/** The dense summary: four tiles, then one compact row per app. */
function Overview({ usage }: { usage: EmailUsage }) {
  const month = new Date(usage.generatedAt).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const over = usage.accountMonth > usage.monthlyIncluded
  const tone = shareTone(usage.accountMonth, usage.monthlyIncluded)
  const todayTone = shareTone(usage.globalToday, usage.globalDayCap)
  const problems30d = usage.apps.reduce((sum, a) => sum + a.bounces30d + a.complaints30d, 0)
  const countingFrom = usage.eventsSince && usage.eventsSince > Date.parse(usage.monthStart) ? new Date(usage.eventsSince).toISOString().slice(0, 10) : null
  const rows = [...usage.apps].sort((a, b) => b.sentMonth - a.sentMonth || b.today - a.today)
  const maxSent = Math.max(1, ...rows.map((a) => a.sentMonth), ...usage.otherSenders.map((o) => o.sentMonth))
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className={cx(TILE, 'col-span-2')}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[13px] text-slate-400">Sent in {month}, all apps</p>
            <StatusPill tone={tone}>{over ? `${formatNumber(usage.accountMonth - usage.monthlyIncluded)} over: $0.35 per 1,000` : `${formatNumber(usage.monthlyIncluded - usage.accountMonth)} included left`}</StatusPill>
          </div>
          <p className="font-mono text-[22px] leading-none whitespace-nowrap sm:text-[26px] font-semibold tabular-nums text-slate-50">
            {formatNumber(usage.accountMonth)} <span className="text-[17px] font-normal text-slate-500">/ {formatNumber(usage.monthlyIncluded)}</span>
          </p>
          <Meter value={usage.accountMonth} max={usage.monthlyIncluded} label={`Emails sent in ${month} of the ${usage.monthlyIncluded} included`} />
        </div>
        <div className={TILE}>
          <p className="text-[13px] text-slate-400">Today, all apps</p>
          <p className="font-mono text-[22px] leading-none whitespace-nowrap sm:text-[26px] font-semibold tabular-nums text-slate-50">
            <span className={cx(todayTone === 'bad' ? 'text-rose-300' : todayTone === 'warn' ? 'text-amber-200' : undefined)}>{formatNumber(usage.globalToday)}</span>{' '}
            <span className="text-[17px] font-normal text-slate-500">/ {formatNumber(usage.globalDayCap)}</span>
          </p>
          <p className="text-[12px] text-slate-400">{usage.priorityReserve} kept for sign-in links</p>
        </div>
        <div className={TILE}>
          <p className="text-[13px] text-slate-400">Trouble, last 30 days</p>
          <p className={cx('font-mono text-[22px] leading-none whitespace-nowrap sm:text-[26px] font-semibold tabular-nums', problems30d > 0 ? 'text-amber-200' : 'text-slate-50')}>{formatNumber(problems30d)}</p>
          <p className="text-[12px] text-slate-400">
            bounces and complaints, {formatNumber(usage.suppressions)} suppressed
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="text-[12px] text-slate-400">
            <tr>
              <th className="pb-2 font-medium">App</th>
              <th className="pb-2 font-medium">Today / cap</th>
              <th className="pb-2 font-medium">Month / cap</th>
              <th className="w-[34%] pb-2 font-medium">Delivered in {month}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((app) => {
              const dayTone = shareTone(app.today, app.caps.day)
              return (
                <tr key={app.app} className="border-t border-white/[0.06]">
                  <td className="py-2 pr-4 whitespace-nowrap text-slate-100">
                    {appName(app.app)}
                    {app.paused && <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 text-[12px] text-amber-200">Paused</span>}
                  </td>
                  <td className="py-2 pr-4 font-mono whitespace-nowrap tabular-nums">
                    <span className={cx(dayTone === 'bad' ? 'text-rose-300' : dayTone === 'warn' ? 'text-amber-200' : 'text-slate-100')}>{formatNumber(app.today)}</span>
                    <span className="text-slate-500"> / {formatNumber(app.caps.day)}</span>
                  </td>
                  <td className="py-2 pr-4 font-mono whitespace-nowrap tabular-nums">
                    <span className="text-slate-100">{formatNumber(app.month)}</span>
                    <span className="text-slate-500"> / {formatNumber(app.caps.month)}</span>
                  </td>
                  <td className="py-2">
                    <ShareBar value={app.sentMonth} max={maxSent} />
                  </td>
                </tr>
              )
            })}
            {usage.otherSenders.map((other) => (
              <tr key={other.sender} className="border-t border-white/[0.06]">
                <td className="py-2 pr-4 whitespace-nowrap text-slate-300" colSpan={3}>
                  {other.sender} <span className="text-[12px] text-slate-500">not on mailroom</span>
                </td>
                <td className="py-2">
                  <ShareBar value={other.sentMonth} max={maxSent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] leading-relaxed text-slate-400">
        Delivered counts come from Cloudflare&apos;s delivery events{countingFrom ? `, counted since ${countingFrom}` : ''}, so apps that still send on their own count too. Mail to your own verified inbox is free but counted, so the total is an upper bound. Today and month are sends through mailroom, which its caps count.
      </p>
    </div>
  )
}

function ShareBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-sky-400/80" style={{ width: `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%` }} />
      </div>
      <span className="w-14 text-right font-mono text-[13px] tabular-nums text-slate-200">{formatNumber(value)}</span>
    </div>
  )
}

function Count({ value, max, tone }: { value: number; max: number; tone: 'good' | 'warn' | 'bad' }) {
  return (
    <>
      <span className={cx(tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-200' : 'text-slate-100')}>{formatNumber(value)}</span>
      <span className="text-slate-500"> / {formatNumber(max)}</span>
    </>
  )
}

function AppRow({ app, globalDayCap }: { app: AppUsage; globalDayCap: number }) {
  const name = appName(app.app)
  const problems = [app.bounces30d && `${app.bounces30d} bounced`, app.complaints30d && `${app.complaints30d} complained`, app.failed30d && `${app.failed30d} failed`].filter(Boolean).join(', ')
  return (
    <tr className="border-t border-white/[0.06] align-middle">
      <td className="py-2 pr-4 whitespace-nowrap text-slate-100">
        {name}
        {app.paused && <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 text-[12px] text-amber-200">Paused</span>}
      </td>
      <td className="py-2 pr-4 font-mono whitespace-nowrap tabular-nums">
        <Count value={app.today} max={app.caps.day} tone={shareTone(app.today, app.caps.day)} />
        {app.caps.day !== app.defaultDayCap && <span className="ml-2 font-sans text-[12px] text-slate-400">default {app.defaultDayCap}</span>}
      </td>
      <td className="py-2 pr-4 font-mono whitespace-nowrap tabular-nums">
        <Count value={app.month} max={app.caps.month} tone={shareTone(app.month, app.caps.month)} />
      </td>
      <td className={cx('py-2 pr-4 text-[13px] whitespace-nowrap', problems ? 'text-amber-200' : 'text-slate-500')}>{problems || 'None'}</td>
      <td className="py-2">
        <div className="flex justify-end gap-2">
          <ConfirmAction
            action={setPaused}
            label={app.paused ? 'Resume' : 'Pause'}
            ariaLabel={`${app.paused ? 'Resume' : 'Pause'} ${name}'s email`}
            title={app.paused ? `Resume ${name}'s email?` : `Pause all of ${name}'s email?`}
            description={
              app.paused
                ? `${name} can send again right away, within its caps.`
                : `mailroom will refuse every email ${name} sends, sign-in links included, until you resume it. ${name} sees a retryable "paused" answer.`
            }
            confirmLabel={app.paused ? 'Resume' : 'Pause email'}
            danger={!app.paused}
            fields={{ app: app.app, paused: String(!app.paused) }}
          />
          <ConfirmAction
            action={setDailyCap}
            label="Daily cap"
            ariaLabel={`Change ${name}'s daily cap`}
            title={`Change ${name}'s daily cap`}
            description={`Today it is ${app.caps.day} a day (default ${app.defaultDayCap}). The new cap applies at once, from today's count of ${app.today}.`}
            confirmLabel="Save cap"
            fields={{ app: app.app }}
            number={{ name: 'cap', label: 'Emails a day', value: app.caps.day, min: 0, max: globalDayCap, resetLabel: app.caps.day !== app.defaultDayCap ? `Put back the default (${app.defaultDayCap})` : undefined }}
          />
        </div>
      </td>
    </tr>
  )
}

function Apps({ usage }: { usage: EmailUsage }) {
  const { apps, globalToday, globalDayCap, priorityReserve } = usage
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] text-slate-400">
        All apps today: <span className="font-mono text-slate-200 tabular-nums">{formatNumber(globalToday)} / {formatNumber(globalDayCap)}</span>, with {priorityReserve} kept for sign-in links. Pausing or changing a cap asks you to confirm first.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <thead className="text-[12px] text-slate-400">
            <tr>
              <th className="pb-2 font-medium">App</th>
              <th className="pb-2 font-medium">Today / cap</th>
              <th className="pb-2 font-medium">Month / cap</th>
              <th className="pb-2 font-medium">Last 30 days</th>
              <th className="pb-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <AppRow key={app.app} app={app} globalDayCap={globalDayCap} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const STATUS_TONE: Record<string, string> = { sent: 'text-emerald-300', failed: 'text-rose-300', pending: 'text-sky-300' }

async function RecentSends() {
  const sends = await getRecentSends(100)
  if (!sends) return <MailroomNotConnected />
  if (!sends.ok) return <PanelError message={sends.message} />
  if (sends.data.length === 0) return <p className="text-[15px] text-slate-400">No app sends through mailroom yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <thead className="text-[13px] text-slate-400">
          <tr>
            <th className="pb-2 font-medium">Time (UTC)</th>
            <th className="pb-2 font-medium">App</th>
            <th className="pb-2 font-medium">Kind</th>
            <th className="pb-2 font-medium">To</th>
            <th className="pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {sends.data.map((send) => (
            <tr key={send.id} className="border-t border-white/[0.06]">
              <td className="py-2.5 pr-4 font-mono text-[13px] whitespace-nowrap text-slate-300 tabular-nums" title={timeAgo(send.at)}>
                {time(send.at)}
              </td>
              <td className="py-2.5 pr-4 text-slate-100">{appName(send.app)}</td>
              <td className="py-2.5 pr-4 text-slate-300">{send.kind}</td>
              <td className="py-2.5 pr-4 font-mono text-[13px] text-slate-300">{send.recipient}</td>
              <td className="py-2.5">
                <p className={cx('whitespace-nowrap', STATUS_TONE[send.status] ?? 'text-slate-300')}>{send.status}</p>
                {send.error && <p className="text-[12px] whitespace-nowrap text-slate-400">{send.error.replaceAll('_', ' ')}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

async function Problems() {
  const problems = await getProblems(50)
  if (!problems) return <MailroomNotConnected />
  if (!problems.ok) return <PanelError message={problems.message} />
  if (problems.data.length === 0) return <p className="text-[15px] text-slate-400">No bounces or complaints.</p>
  return (
    <ul className="-my-2 divide-y divide-white/[0.06]">
      {problems.data.map((p) => (
        <li key={p.eventId} className="flex flex-col gap-1 py-3">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
            <span className={cx('font-medium', p.type === 'complained' ? 'text-rose-300' : p.type === 'bounced' ? 'text-amber-200' : 'text-slate-200')}>
              {p.type === 'bounced' && p.bounceType ? `${p.bounceType} bounce` : p.type}
            </span>
            <span className="text-slate-100">{appName(p.app)}</span>
            <span className="font-mono text-[13px] text-slate-300">{p.recipient}</span>
            <span className="text-[13px] text-slate-500">{timeAgo(p.at)}</span>
          </p>
          {p.reason && <p className="font-mono text-[12px] [overflow-wrap:anywhere] text-slate-400">{p.reason}</p>}
        </li>
      ))}
    </ul>
  )
}

const REASON: Record<string, string> = { hard_bounce: 'Hard bounce', complained: 'Marked as spam', cloudflare_suppressed: 'On Cloudflare\'s list' }

async function Suppressions() {
  const list = await getSuppressions(100)
  if (!list) return <MailroomNotConnected />
  if (!list.ok) return <PanelError message={list.message} />
  if (list.data.length === 0) return <p className="text-[15px] text-slate-400">No address is suppressed.</p>
  return (
    <ul className="-my-2 divide-y divide-white/[0.06]">
      {list.data.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[14px] text-slate-100">{s.recipient}</p>
            <p className="mt-0.5 text-[13px] text-slate-400">
              {REASON[s.reason] ?? s.reason}
              {s.app ? `, from ${appName(s.app)}` : ''}, {timeAgo(s.createdAt)}
            </p>
          </div>
          <ConfirmAction
            action={removeSuppression}
            label="Remove"
            ariaLabel={`Remove ${s.recipient} from the suppression list`}
            title="Let mailroom mail this address again?"
            description={
              <>
                <span className="font-mono">{s.recipient}</span> leaves mailroom&apos;s suppression list. Cloudflare keeps its own list too: a hard bounce also has to be removed there (Compute, Email Service, Suppressions) before mail reaches it.
              </>
            }
            confirmLabel="Remove"
            danger
            fields={{ id: String(s.id) }}
          />
        </li>
      ))}
    </ul>
  )
}

async function Audit() {
  const log = await getAuditLog(30)
  if (!log) return <MailroomNotConnected />
  if (!log.ok) return <PanelError message={log.message} />
  if (log.data.length === 0) return <p className="text-[15px] text-slate-400">No changes yet.</p>
  return (
    <ul className="-my-2 divide-y divide-white/[0.06]">
      {log.data.map((entry) => (
        <li key={entry.id} className="py-2.5 text-[14px]">
          <p className="text-slate-100">{entry.detail}</p>
          <p className="mt-0.5 text-[13px] text-slate-400">
            {entry.actor}, {timeAgo(entry.at)}
          </p>
        </li>
      ))}
    </ul>
  )
}

const TABS = [
  { id: 'overview', label: 'Overview', title: 'This month at a glance', description: 'Every app\'s email against the 3,000 the Workers Paid plan includes, and today against the daily caps.' },
  { id: 'sends', label: 'Sends', title: 'Recent sends', description: 'The last 100 emails through mailroom, newest first. Addresses are masked; no email content is kept.' },
  { id: 'problems', label: 'Bounces & complaints', title: 'Bounces and complaints', description: 'From Cloudflare\'s delivery events, newest first.' },
  { id: 'suppressions', label: 'Suppressions', title: 'Suppression list', description: 'Addresses mailroom will not mail: they bounced for good or marked an email as spam.' },
  { id: 'apps', label: 'Apps & caps', title: 'Apps and caps', description: 'Sent through mailroom today and this month, against each app\'s caps.' },
  { id: 'audit', label: 'Audit log', title: 'Audit log', description: 'Every change made on this page, with who made it.' },
] as const

type TabId = (typeof TABS)[number]['id']

function Tabs({ current, counts }: { current: TabId; counts: Partial<Record<TabId, number>> }) {
  return (
    <nav aria-label="Mailroom sections" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 border-b border-white/[0.08]">
        {TABS.map((tab) => {
          const active = tab.id === current
          const count = counts[tab.id]
          return (
            <li key={tab.id}>
              <Link
                href={tab.id === 'overview' ? '/mailroom' : `/mailroom?tab=${tab.id}`}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  '-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-300',
                  active ? 'border-sky-400 text-slate-50' : 'border-transparent text-slate-400 hover:text-slate-200',
                )}
              >
                {tab.label}
                {count !== undefined && count > 0 && <span className={cx('rounded-full px-1.5 text-[12px] tabular-nums', active ? 'bg-sky-400/20 text-sky-100' : 'bg-white/[0.08] text-slate-300')}>{count}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  const params = await searchParams
  const tab = TABS.find((t) => t.id === params.tab) ?? TABS[0]
  const usage = await getEmailUsage()
  const data = usage?.ok ? usage.data : null
  const counts: Partial<Record<TabId, number>> = data
    ? { problems: data.apps.reduce((sum, a) => sum + a.bounces30d + a.complaints30d, 0), suppressions: data.suppressions }
    : {}
  return (
    <>
      <PageHeader area={area} />
      <div className="flex flex-col gap-5">
        <Tabs current={tab.id} counts={counts} />
        <Panel id={tab.id} title={tab.title} description={tab.description}>
          {!usage ? (
            <MailroomNotConnected />
          ) : !usage.ok ? (
            <PanelError message={usage.message} />
          ) : tab.id === 'overview' ? (
            <Overview usage={usage.data} />
          ) : tab.id === 'apps' ? (
            <Apps usage={usage.data} />
          ) : (
            <Slot rows={6}>
              {tab.id === 'sends' && <RecentSends />}
              {tab.id === 'problems' && <Problems />}
              {tab.id === 'suppressions' && <Suppressions />}
              {tab.id === 'audit' && <Audit />}
            </Slot>
          )}
        </Panel>
      </div>
    </>
  )
}
