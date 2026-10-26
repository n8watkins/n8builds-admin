import { formatDuration, formatNumber, formatPercent, timeAgo } from '@/lib/format'
import { ga4Config, getTraffic } from '@/lib/ga4'
import { getSentrySummary, sentryConfig } from '@/lib/sentry'
import { isStoreConnected, readDailyCounts, readDailyHashTotals, readSnapshots } from '@/lib/store'
import { ExternalIcon } from '../icons'
import { Sparkline } from '../Sparkline'
import { BarList, NotConnected, PanelError, Stat, errorMessage } from '../ui'

const STORE_VARS = ['ANALYTICS_REDIS_REST_URL', 'ANALYTICS_REDIS_REST_TOKEN']

// ---------------------------------------------------------------------------
// 02 Sentry

export async function SentryPanel() {
  const config = sentryConfig()
  if (!config) {
    return (
      <NotConnected
        why="Sentry already collects errors from n8builds.dev (and the portfolio). Reading them back needs a read-only token; the dashboard never writes to Sentry."
        willShow={['Unresolved issues', 'New this week', 'Events per issue', 'Errors in 30 days vs the free 5k']}
        needs={['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECTS']}
        plan={['Create a personal token with only org:read, project:read and event:read.', 'Set the org slug and the project slugs (comma-separated) next to it.']}
        setupStep="step 4"
      />
    )
  }
  let summary
  try {
    summary = await getSentrySummary()
  } catch (error) {
    return <PanelError message={errorMessage(error)} />
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Unresolved" value={formatNumber(summary.unresolved.length)} />
        <Stat label="New 7d" value={formatNumber(summary.newThisWeek)} />
        <Stat label="Errors 30d" value={summary.errors30d === null ? 'n/a' : formatNumber(summary.errors30d)} hint="free plan: 5k / month" />
      </div>
      <ul className="-mx-2 divide-y divide-white/[0.05]">
        {summary.unresolved.slice(0, 6).map((issue) => (
          <li key={issue.id} className="px-2 py-2 text-[13px]">
            <a href={issue.url} target="_blank" rel="noreferrer" className="block truncate text-slate-100 hover:text-cyan-300">
              {issue.title}
            </a>
            <p className="font-mono text-[11px] text-slate-475">
              {issue.shortId} · {formatNumber(issue.events)} events · {issue.users} users · last {timeAgo(issue.lastSeen)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 03 Traffic

export async function TrafficPanel() {
  if (!ga4Config()) {
    return (
      <NotConnected
        why="Google Analytics (G-JZQGKY9Q37) already collects visits for all of n8builds.dev, subdomains included. Reading them needs a Google Cloud service account with Viewer access on the GA4 property."
        willShow={['Visitors (28 days)', 'Countries', 'Top pages', 'Referrers', 'Time on site', 'Scroll depth (90% reached)']}
        needs={['GA4_PROPERTY_ID', 'GOOGLE_SA_CLIENT_EMAIL', 'GOOGLE_SA_PRIVATE_KEY']}
        plan={[
          'Enable the Google Analytics Data API in a Google Cloud project and create a service account with a JSON key.',
          'Add its email as a Viewer on the GA4 property (Admin, Property access management).',
          'Set the numeric property ID (not the G- measurement ID) and the key\'s two fields in Vercel.',
        ]}
        setupStep="step 3"
      />
    )
  }
  let traffic
  try {
    traffic = await getTraffic()
  } catch (error) {
    return <PanelError message={errorMessage(error)} />
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Visitors 28d" value={formatNumber(traffic.visitors)} hint={`${formatNumber(traffic.pageViews)} page views`} />
        <Stat label="Avg session" value={formatDuration(traffic.avgSessionSeconds)} />
        <Stat label="Engaged" value={formatPercent(traffic.engagementRate)} />
        <Stat label="Scrolled 90%" value={traffic.scrolledShare === null ? 'n/a' : formatPercent(traffic.scrolledShare)} hint="of page views" />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {(
          [
            ['Top pages', traffic.pages],
            ['Referrers', traffic.referrers],
            ['Countries', traffic.countries],
          ] as const
        ).map(([title, rows]) => (
          <div key={title} className="min-w-0">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-slate-450 uppercase">{title}</p>
            <BarList rows={[...rows]} format={formatNumber} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 04 Referrals to Appturnity

export async function ReferralsPanel() {
  const plan = [
    <>n8builds-web tags each Appturnity link with its placement (hero ad, &quot;Two ways&quot; card, footer, navbar) and adds <code className="font-mono text-xs text-slate-300">utm_source=n8builds</code>.</>,
    <>One idle-loaded click listener sends <code className="font-mono text-xs text-slate-300">navigator.sendBeacon(&apos;/api/ref&apos;)</code>; the click is never delayed.</>,
    <>The route checks the placement against an allow-list and runs <code className="font-mono text-xs text-slate-300">HINCRBY ref:appturnity:&lt;date&gt;</code> in the analytics database. No IP, no ID, no cookie.</>,
    'The same click also sends a GA event (appturnity_click) as a cross-check, and the utm tags show up in Appturnity\'s own analytics.',
  ]
  if (!isStoreConnected()) {
    return (
      <NotConnected
        why="Counts the visitors n8builds.dev sends to appturnity.com. A first-party daily count works with ad blockers and without Google's cookies; Google Analytics alone would miss many."
        willShow={['Clicks today, 7 and 30 days', 'By placement', '30-day trend']}
        needs={STORE_VARS}
        plan={plan}
        setupStep="step 5"
      />
    )
  }
  let days
  try {
    days = await readDailyHashTotals('ref:appturnity', 30)
  } catch (error) {
    return <PanelError message={errorMessage(error)} />
  }
  const total = days.reduce((sum, day) => sum + day.total, 0)
  if (total === 0) {
    return <NotConnected title="Waiting for the counter" why="The analytics database is connected, but n8builds-web doesn't count Appturnity clicks yet." plan={plan} />
  }
  const byPlacement = new Map<string, number>()
  for (const day of days) for (const [field, value] of Object.entries(day.byField)) byPlacement.set(field, (byPlacement.get(field) ?? 0) + value)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Today" value={formatNumber(days.at(-1)?.total ?? 0)} />
        <Stat label="7 days" value={formatNumber(days.slice(-7).reduce((sum, day) => sum + day.total, 0))} />
        <Stat label="30 days" value={formatNumber(total)} />
      </div>
      <Sparkline values={days.map((day) => day.total)} label="Appturnity clicks per day, last 30 days" />
      <BarList rows={[...byPlacement.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} format={formatNumber} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 05 Contact messages

export async function ContactPanel() {
  const plan = [
    <>After a message is delivered, n8builds-web&apos;s contact route runs <code className="font-mono text-xs text-slate-300">INCR contact:sent:&lt;date&gt;</code> in the analytics database.</>,
    'A failed count never fails the send, and the counter lives apart from the form\'s rate-limit database so it can\'t use up its quota.',
  ]
  if (!isStoreConnected()) {
    return (
      <NotConnected
        why="How many contact messages arrived, without opening Gmail. Only a daily number is stored, never the message."
        willShow={['Messages this week and month', 'Against the 50 / day cap']}
        needs={STORE_VARS}
        plan={plan}
        setupStep="step 5"
      />
    )
  }
  let days
  try {
    days = await readDailyCounts('contact:sent', 30)
  } catch (error) {
    return <PanelError message={errorMessage(error)} />
  }
  const total = days.reduce((sum, day) => sum + day.count, 0)
  if (total === 0) return <NotConnected title="Waiting for the counter" why="The analytics database is connected, but n8builds-web doesn't count sent messages yet (or none arrived in 30 days)." plan={plan} />
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="7 days" value={formatNumber(days.slice(-7).reduce((sum, day) => sum + day.count, 0))} />
        <Stat label="30 days" value={formatNumber(total)} />
      </div>
      <Sparkline values={days.map((day) => day.count)} label="Contact messages per day, last 30 days" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 06 Trends

export async function TrendsPanel() {
  const plan = [
    <>Vercel Cron calls <code className="font-mono text-xs text-slate-300">/api/cron/snapshot</code> daily at 06:15 UTC with the CRON_SECRET (already built, in vercel.json).</>,
    <>It saves stars per repo and this month&apos;s minutes as <code className="font-mono text-xs text-slate-300">snapshot:&lt;date&gt;</code>, kept 400 days.</>,
    'This card then draws the last 30 days, so trends outlive GitHub\'s 14-day windows.',
  ]
  if (!isStoreConnected()) {
    return (
      <NotConnected
        why="Stars and Actions minutes over time (&quot;+3 stars this week&quot;). GitHub only keeps the current numbers, so the dashboard saves one snapshot a day."
        willShow={['Stars, 30-day trend', 'Minutes used, by day', 'Week-over-week change']}
        needs={[...STORE_VARS, 'CRON_SECRET']}
        plan={plan}
        setupStep="step 5"
      />
    )
  }
  let snapshots
  try {
    snapshots = await readSnapshots(30)
  } catch (error) {
    return <PanelError message={errorMessage(error)} />
  }
  const stars = snapshots.map((snap) => (snap ? Object.values(snap.stars).reduce((sum, value) => sum + value, 0) : null))
  const minutes = snapshots.map((snap) => snap?.minutes.appturnity ?? null)
  const known = stars.filter((value): value is number => value !== null)
  if (known.length === 0) return <NotConnected title="Waiting for the first snapshot" why="The database is connected; the first daily snapshot lands after the cron's next run (or open /api/cron/snapshot while signed in)." />
  const weekAgo = stars.at(-8) ?? known[0]
  const change = (known.at(-1) ?? 0) - (weekAgo ?? 0)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Stars" value={formatNumber(known.at(-1) ?? 0)} hint={`${change >= 0 ? '+' : ''}${change} this week`} />
        <Stat label="Appturnity minutes" value={formatNumber(minutes.filter((value): value is number => value !== null).at(-1) ?? 0)} hint="this month so far" />
      </div>
      <Sparkline values={stars} label="Total stars, last 30 days" />
      <Sparkline values={minutes} label="Appturnity Actions minutes, last 30 days" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 07 AI crawlers (a link, by the owner's call)

export function AiCrawlersCard() {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-slate-400">
        Vercel&apos;s Firewall shows AI crawler traffic once the <b className="font-semibold text-slate-200">AI Bots</b> managed ruleset is on in <b className="font-semibold text-slate-200">Log</b> mode: it logs GPTBot, ClaudeBot and friends without blocking them. No counter of our own, so crawler hits cost nothing extra.
      </p>
      <a
        href="https://vercel.com/natkins23s-projects/n8builds-web/firewall"
        target="_blank"
        rel="noreferrer"
        className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/[0.06] px-3 py-1.5 text-[13px] font-medium text-cyan-200 transition-colors hover:border-cyan-400/60 hover:bg-cyan-400/10">
        Open the Vercel Firewall
        <ExternalIcon />
      </a>
    </div>
  )
}
