import type { Metadata } from 'next'
import { Slot } from '@/components/Slot'
import { BarList, Meter, NotConnected, PageHeader, Panel, PanelError, Stat, StatusPill, cx, type Tone } from '@/components/ui'
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
  monthRows,
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

function ThisMonth({ usage }: { usage: EmailUsage }) {
  const month = new Date(usage.generatedAt).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const over = usage.accountMonth > usage.monthlyIncluded
  const tone = shareTone(usage.accountMonth, usage.monthlyIncluded)
  const rows = monthRows(usage)
  const countingFrom = usage.eventsSince && usage.eventsSince > Date.parse(usage.monthStart) ? new Date(usage.eventsSince).toISOString().slice(0, 10) : null
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Stat label={`Sent in ${month}`} value={`${formatNumber(usage.accountMonth)} / ${formatNumber(usage.monthlyIncluded)}`} tone={tone === 'good' ? undefined : tone} hint="emails, all apps" />
        <StatusPill tone={tone}>{over ? `${formatNumber(usage.accountMonth - usage.monthlyIncluded)} over: $0.35 per 1,000` : `${formatNumber(usage.monthlyIncluded - usage.accountMonth)} included emails left`}</StatusPill>
      </div>
      <Meter value={usage.accountMonth} max={usage.monthlyIncluded} label={`Emails sent in ${month} of the ${usage.monthlyIncluded} included`} />
      {rows.length === 0 ? <p className="text-[15px] text-slate-400">No email delivered yet this month.</p> : <BarList rows={rows} format={formatNumber} />}
      <p className="text-[13px] leading-relaxed text-slate-400">
        Delivered or bounced messages from Cloudflare&apos;s events{countingFrom ? `, counted since ${countingFrom}` : ''}. Mail to your own verified inbox is free and still counted, so this is an upper bound.
      </p>
    </div>
  )
}

function Figure({ label, value, max, tone, note }: { label: string; value: number; max?: number; tone?: 'good' | 'warn' | 'bad'; note?: string }) {
  return (
    <div className="min-w-[6.5rem]">
      <p className="text-[12px] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[14px] tabular-nums">
        <span className={cx(tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-200' : 'text-slate-100')}>{formatNumber(value)}</span>
        {max !== undefined && <span className="text-slate-500"> / {formatNumber(max)}</span>}
      </p>
      {note && <p className="text-[12px] text-slate-400">{note}</p>}
    </div>
  )
}

function AppRow({ app, globalDayCap }: { app: AppUsage; globalDayCap: number }) {
  const name = appName(app.app)
  const problems = [app.bounces30d && `${app.bounces30d} bounced`, app.complaints30d && `${app.complaints30d} complained`, app.failed30d && `${app.failed30d} failed`].filter(Boolean).join(', ')
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 py-4">
      <div className="w-full min-w-0 sm:w-40">
        <p className="flex items-center gap-2 font-medium text-slate-100">
          {name}
          {app.paused && <StatusPill tone="warn">Paused</StatusPill>}
        </p>
        <p className={cx('mt-0.5 text-[13px]', problems ? 'text-amber-200' : 'text-slate-500')}>{problems ? `${problems} in 30 days` : 'No bounces in 30 days'}</p>
      </div>
      <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
        <Figure label="Today" value={app.today} max={app.caps.day} tone={shareTone(app.today, app.caps.day)} note={app.caps.day !== app.defaultDayCap ? `default cap ${app.defaultDayCap}` : undefined} />
        <Figure label="This month" value={app.month} max={app.caps.month} tone={shareTone(app.month, app.caps.month)} />
        <Figure label="Delivered" value={app.sentMonth} note="this month" />
      </div>
      <div>
        <div className="flex flex-wrap gap-2">
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
      </div>
    </li>
  )
}

async function Usage() {
  const usage = await getEmailUsage()
  if (!usage) return <MailroomNotConnected />
  if (!usage.ok) return <PanelError message={usage.message} />
  return <ThisMonth usage={usage.data} />
}

async function Apps() {
  const usage = await getEmailUsage()
  if (!usage) return <MailroomNotConnected />
  if (!usage.ok) return <PanelError message={usage.message} />
  const { apps, globalToday, globalDayCap, priorityReserve } = usage.data
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[14px] text-slate-400">
        All apps today: <span className="font-mono text-slate-200 tabular-nums">{formatNumber(globalToday)} / {formatNumber(globalDayCap)}</span>, with {priorityReserve} kept for sign-in links.
      </p>
      <ul className="-my-4 divide-y divide-white/[0.06]">
        {apps.map((app) => (
          <AppRow key={app.app} app={app} globalDayCap={globalDayCap} />
        ))}
      </ul>
    </div>
  )
}

const STATUS_TONE: Record<string, string> = { sent: 'text-emerald-300', failed: 'text-rose-300', pending: 'text-sky-300' }

async function RecentSends() {
  const sends = await getRecentSends(50)
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

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader area={area} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Panel id="month" title="This month" description="Every app's email against the 3,000 the Workers Paid plan includes." className="xl:col-span-2">
          <Slot rows={5}>
            <Usage />
          </Slot>
        </Panel>
        <Panel id="problems" title="Bounces and complaints" description="From Cloudflare's delivery events, newest first." className="xl:col-span-3">
          <Slot rows={4}>
            <Problems />
          </Slot>
        </Panel>
        <Panel id="sends" title="Recent sends" description="The last 50 emails through mailroom. Addresses are masked; no email content is kept." className="xl:col-span-5">
          <Slot rows={6}>
            <RecentSends />
          </Slot>
        </Panel>
        <Panel id="apps" title="Apps and caps" description="Sent through mailroom today and this month, against each app's caps. Pause an app or change its daily cap here." className="xl:col-span-5">
          <Slot rows={6}>
            <Apps />
          </Slot>
        </Panel>
        <Panel id="suppressions" title="Suppression list" description="Addresses mailroom will not mail: they bounced for good or marked an email as spam." className="xl:col-span-3">
          <Slot rows={3}>
            <Suppressions />
          </Slot>
        </Panel>
        <Panel id="audit" title="Audit log" description="Every change made here, with who made it." className="xl:col-span-2">
          <Slot rows={3}>
            <Audit />
          </Slot>
        </Panel>
      </div>
    </>
  )
}
