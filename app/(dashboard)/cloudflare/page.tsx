import type { Metadata } from 'next'
import { Slot } from '@/components/Slot'
import { BarList, ExternalAction, InternalAction, Meter, NotConnected, PageHeader, Panel, PanelError, StatusPill, cx, type Tone } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'
import {
  AI_FREE_NEURONS_PER_DAY,
  BAD_AT,
  CACHE_SECONDS,
  MAILROOM_MONTHLY_CAP,
  PORTFOLIORANK_AI_SLICE,
  WARN_AT,
  WORKERS_INCLUDED,
  compact,
  getAiUsage,
  getWorkersUsage,
  isCloudflareUsageConnected,
  type AiUsage,
  type Allowance,
  type Level,
  type WorkersUsage,
} from '@/lib/cloudflare-usage'
import { formatNumber, formatPercent, timeAgo } from '@/lib/format'
import { getEmailUsage } from '@/lib/mailroom'
import { CLOUDFLARE_ACCOUNT } from '@/lib/repos'

const area = AREAS.cloudflare

export const metadata: Metadata = { title: area.label }

const TILE = 'flex min-w-0 flex-col gap-2.5 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06]'
const BIG = 'font-mono text-[22px] leading-none font-semibold whitespace-nowrap text-slate-50 tabular-nums sm:text-[26px]'
const TONE_TEXT: Record<Level, string> = { good: 'text-slate-50', warn: 'text-amber-200', bad: 'text-rose-300' }
const WORKER_ROWS = 12

const monthName = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
/** "Nov 30" for the last day of the month that ends at `endIso` (exclusive). */
const lastDay = (endIso: string) => new Date(Date.parse(endIso) - 1).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function pill(allowance: Pick<Allowance, 'used' | 'included' | 'level' | 'share' | 'basis'>): { tone: Tone; text: string } {
  if (allowance.used >= allowance.included) return { tone: 'bad', text: 'Over the included' }
  if (allowance.level === 'good') return { tone: 'good', text: 'On track' }
  return { tone: allowance.level, text: `${formatPercent(allowance.share)} ${allowance.basis}` }
}

/** The colour of what is used so far, on its own (the projection has its own line). */
function usedLevel({ used, included }: Pick<Allowance, 'used' | 'included'>): Level {
  const share = included > 0 ? used / included : 0
  return share >= BAD_AT ? 'bad' : share >= WARN_AT ? 'warn' : 'good'
}

function CloudflareNotConnected() {
  return (
    <NotConnected
      why="Reads Cloudflare's GraphQL Analytics API with a read-only token, at most every 10 minutes, to keep Workers and Workers AI inside what the Workers Paid plan includes."
      willShow={[
        `Workers requests this month of the ${compact(WORKERS_INCLUDED.requests)} included`,
        `Workers CPU time this month of the ${compact(WORKERS_INCLUDED.cpuMs)} ms included`,
        'A projection to the end of the month',
        'Each Worker, busiest first',
        `Workers AI neurons today of the free ${formatNumber(AI_FREE_NEURONS_PER_DAY)}`,
      ]}
      plan={[
        'Create a custom API token in Cloudflare: Account, Account Analytics, Read, for the owner\'s account only, and nothing else.',
        'Store it with pass-env as n8builds-admin/CF_ANALYTICS_TOKEN.',
        'Set it on the Worker as CF_ANALYTICS_TOKEN; this page shows live numbers on the next load.',
      ]}
      needs={['CF_ANALYTICS_TOKEN']}
      setupId="cloudflare-analytics"
    />
  )
}

function AllowanceTile({ title, unit, allowance, monthEnd }: { title: string; unit?: string; allowance: Allowance; monthEnd: string }) {
  const { tone, text } = pill(allowance)
  const projectedShare = allowance.projected / allowance.included
  return (
    <div role="group" aria-label={title} className={TILE}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="text-[14px] font-medium text-slate-300">{title}</h3>
        <StatusPill tone={tone}>{text}</StatusPill>
      </div>
      <p className={BIG}>
        <span className={TONE_TEXT[usedLevel(allowance)]}>{compact(allowance.used)}</span>{' '}
        <span className="text-[17px] font-normal text-slate-400">
          / {compact(allowance.included)}
          {unit && ` ${unit}`}
        </span>
      </p>
      <Meter value={allowance.used} max={allowance.included} label={`${title}: ${formatNumber(allowance.used)} of the ${formatNumber(allowance.included)} included`} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px] text-slate-400">
        <dt>Used</dt>
        <dd className="text-right font-mono text-slate-200 tabular-nums">
          {formatNumber(allowance.used)} ({formatPercent(allowance.used / allowance.included)})
        </dd>
        <dt>By {lastDay(monthEnd)}</dt>
        <dd className={cx('text-right font-mono tabular-nums', allowance.projectionReady && allowance.basis === 'projected' ? TONE_TEXT[allowance.level] : 'text-slate-200')}>
          {allowance.projectionReady ? '' : '~'}
          {compact(allowance.projected)} ({formatPercent(projectedShare)})
        </dd>
      </dl>
      {!allowance.projectionReady && <p className="text-[13px] text-slate-500">The projection starts counting after the month&apos;s first day.</p>}
    </div>
  )
}

function WorkerTable({ usage }: { usage: WorkersUsage }) {
  const rows = usage.workers.slice(0, WORKER_ROWS)
  const rest = usage.workers.slice(WORKER_ROWS)
  const maxCpu = Math.max(1, ...rows.map((row) => row.cpuMs))
  if (usage.workers.length === 0) return <p className="text-[15px] text-slate-400">No Worker has run this month yet.</p>
  return (
    <table className="w-full text-left text-[14px]">
      <caption className="sr-only">Each Worker&apos;s requests and CPU time in {monthName(usage.at)}, busiest first</caption>
      <thead className="text-[13px] text-slate-400">
        <tr>
          <th scope="col" className="pb-2 font-medium">
            Worker
          </th>
          <th scope="col" className="pb-2 pl-3 text-right font-medium">
            Requests
          </th>
          <th scope="col" className="pb-2 pl-3 text-right font-medium">
            CPU ms
          </th>
          <th scope="col" className="hidden w-[30%] pb-2 pl-6 font-medium md:table-cell">
            Share of CPU
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.worker} className="border-t border-white/[0.06]">
            {/* Long names wrap instead of truncating, so n8builds-web and n8builds-admin stay apart on a phone. */}
            <td className="py-2 text-slate-100 [overflow-wrap:anywhere]">
              {row.worker}
            </td>
            <td className="py-2 pl-3 text-right font-mono whitespace-nowrap text-slate-200 tabular-nums" title={formatNumber(row.requests)}>
              {compact(row.requests)}
            </td>
            <td className="py-2 pl-3 text-right font-mono whitespace-nowrap text-slate-200 tabular-nums" title={`${formatNumber(row.cpuMs)} ms`}>
              {compact(row.cpuMs)}
            </td>
            <td className="hidden py-2 pl-6 md:table-cell">
              <div className="flex items-center gap-3">
                <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-orange-400/80" style={{ width: `${Math.max((row.cpuMs / maxCpu) * 100, row.cpuMs > 0 ? 2 : 0)}%` }} />
                </div>
                <span className="w-11 text-right font-mono text-[13px] text-slate-300 tabular-nums">{formatPercent(usage.cpuMs.used > 0 ? row.cpuMs / usage.cpuMs.used : 0)}</span>
              </div>
            </td>
          </tr>
        ))}
        {rest.length > 0 && (
          <tr className="border-t border-white/[0.06] text-slate-400">
            <td className="py-2">{rest.length} more</td>
            <td className="py-2 pl-3 text-right font-mono tabular-nums">{compact(rest.reduce((sum, row) => sum + row.requests, 0))}</td>
            <td className="py-2 pl-3 text-right font-mono tabular-nums">{compact(rest.reduce((sum, row) => sum + row.cpuMs, 0))}</td>
            <td className="hidden md:table-cell" />
          </tr>
        )}
      </tbody>
    </table>
  )
}

async function Workers() {
  const result = await getWorkersUsage()
  if (!result.ok) {
    if (result.permission) {
      return (
        <NotConnected
          kind="needs-permission"
          why={`Cloudflare refused the token: ${result.message}. It needs Account, Account Analytics, Read on the owner's account.`}
          setupId="cloudflare-analytics"
        />
      )
    }
    return <PanelError message={result.message} />
  }
  const usage = result.data
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-2">
        <AllowanceTile title="Requests" allowance={usage.requests} monthEnd={usage.monthEnd} />
        <AllowanceTile title="CPU time" unit="ms" allowance={usage.cpuMs} monthEnd={usage.monthEnd} />
      </div>
      <WorkerTable usage={usage} />
      <p className="text-[13px] leading-relaxed text-slate-400">
        Since {monthName(usage.at)} 1, 00:00 UTC; updated {timeAgo(usage.at)}, refreshed every {CACHE_SECONDS / 60} minutes. Needs attention at {formatPercent(WARN_AT)} and {formatPercent(BAD_AT)} of
        either, used or projected.
      </p>
    </div>
  )
}

function AiBody({ usage }: { usage: AiUsage }) {
  const tone: Tone = usage.neurons >= usage.free ? 'bad' : usage.level === 'good' ? 'good' : usage.level
  return (
    <div className="flex flex-col gap-5">
      <div className={TILE}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h3 className="text-[14px] font-medium text-slate-300">Neurons today, whole account</h3>
          <StatusPill tone={tone}>{usage.neurons >= usage.free ? 'Past the free' : usage.level === 'good' ? `${formatNumber(usage.free - usage.neurons)} free left` : `${formatPercent(usage.share)} used`}</StatusPill>
        </div>
        <p className={BIG}>
          <span className={TONE_TEXT[usage.level]}>{formatNumber(usage.neurons)}</span> <span className="text-[17px] font-normal text-slate-400">/ {formatNumber(usage.free)}</span>
        </p>
        <Meter value={usage.neurons} max={usage.free} label={`Workers AI neurons today: ${Math.round(usage.neurons)} of the free ${usage.free}`} />
        <p className="text-[13px] leading-relaxed text-slate-400">
          Free up to {formatNumber(usage.free)} a UTC day; resets at 00:00 UTC. PortfolioRank stops itself at {formatNumber(usage.slice)} of them ({formatPercent(usage.slice / usage.free)}). Cloudflare doesn&apos;t
          split neurons by Worker, so this is every app together.
        </p>
      </div>
      {usage.models.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[14px] font-medium text-slate-300">By model</h3>
          <BarList rows={usage.models.map((row) => ({ label: row.model.replace(/^@cf\//, ''), value: row.neurons }))} format={formatNumber} />
        </div>
      ) : (
        <p className="text-[15px] text-slate-400">No Workers AI calls today yet.</p>
      )}
    </div>
  )
}

async function WorkersAi() {
  const result = await getAiUsage()
  if (!result.ok) {
    if (result.permission) {
      return (
        <NotConnected
          kind="needs-permission"
          title="Workers AI: not connected"
          why={`The token can't read Workers AI analytics (${result.message}). Add Account, Workers AI, Read to the same token; the Workers numbers above don't need it.`}
          setupId="cloudflare-analytics"
        />
      )
    }
    return <PanelError message={result.message} />
  }
  return <AiBody usage={result.data} />
}

async function Email() {
  const usage = await getEmailUsage()
  const cap = usage?.ok ? usage.data.globalMonth : undefined
  return (
    <div className="flex flex-col gap-4">
      {cap ? (
        <div className={TILE}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h3 className="text-[14px] font-medium text-slate-300">All apps, last {cap.windowDays} days</h3>
            <StatusPill tone={cap.used >= cap.cap ? 'bad' : cap.attention ? 'warn' : 'good'}>{cap.used >= cap.cap ? 'Cap reached' : cap.attention ? 'Needs attention' : `${formatNumber(cap.cap - cap.used)} left`}</StatusPill>
          </div>
          <p className={BIG}>
            {formatNumber(cap.used)} <span className="text-[17px] font-normal text-slate-400">/ {formatNumber(cap.cap)}</span>
          </p>
          <Meter value={cap.used} max={cap.cap} label={`Emails sent through mailroom in the last ${cap.windowDays} days of the ${cap.cap} cap`} />
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed text-slate-300">
          mailroom stops every app at {formatNumber(MAILROOM_MONTHLY_CAP)} emails a month, under the 3,000 the plan includes.{' '}
          {usage === null ? 'This copy has no MAILROOM binding, so the count shows on the deployed admin.' : 'Its count shows on the Mailroom page.'}
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-slate-400">Email has its own cap and alerts in mailroom, so it isn&apos;t counted again here.</p>
      <div>
        <InternalAction href="/mailroom" describe="The Mailroom page: email per app and the 2,500 cap">
          Open Mailroom
        </InternalAction>
      </div>
    </div>
  )
}

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  const connected = isCloudflareUsageConnected()
  const month = monthName(new Date().toISOString())
  return (
    <>
      <PageHeader
        area={area}
        actions={
          <ExternalAction href={`https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT}/workers-and-pages`} describe="Workers and Pages in the Cloudflare dashboard">
            Cloudflare
          </ExternalAction>
        }
      />
      <div className="flex flex-col gap-6">
        <Panel id="workers" title={`Workers in ${month}`} description={`The plan includes ${compact(WORKERS_INCLUDED.requests)} requests and ${compact(WORKERS_INCLUDED.cpuMs)} CPU milliseconds a month, for every Worker together.`}>
          {connected ? (
            <Slot rows={5}>
              <Workers />
            </Slot>
          ) : (
            <CloudflareNotConnected />
          )}
        </Panel>
        <div className="grid gap-6 lg:grid-cols-5">
          <Panel id="ai" title="Workers AI today" className="lg:col-span-3">
            {connected ? (
              <Slot rows={4}>
                <WorkersAi />
              </Slot>
            ) : (
              <p className="text-[15px] leading-relaxed text-slate-400">Shows once the token above is set: neurons today against the free {formatNumber(AI_FREE_NEURONS_PER_DAY)}, and PortfolioRank&apos;s {formatNumber(PORTFOLIORANK_AI_SLICE)}.</p>
            )}
          </Panel>
          <Panel id="email" title="Email" className="lg:col-span-2">
            <Slot rows={3}>
              <Email />
            </Slot>
          </Panel>
        </div>
      </div>
    </>
  )
}
