import { LuBot } from 'react-icons/lu'
import { formatDuration, formatNumber, formatPercent, timeAgo } from '@/lib/format'
import { ga4Config, getTraffic } from '@/lib/ga4'
import { VERCEL_TEAM } from '@/lib/repos'
import { getSentrySummary, sentryConfig } from '@/lib/sentry'
import { isStoreConnected, readDailyCounts, readDailyHashTotals, readSnapshots } from '@/lib/store'
import { Sparkline } from '../Sparkline'
import { Actions, BarList, ExternalAction, NotConnected, OutLink, PanelError, Stat, errorMessage } from '../ui'

const STORE_VARS = ['ANALYTICS_REDIS_REST_URL', 'ANALYTICS_REDIS_REST_TOKEN']
const code = 'rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.9em] text-slate-100 [overflow-wrap:anywhere]'

// ---------------------------------------------------------------------------
// Errors (Sentry)

export async function SentryPanel() {
  const config = sentryConfig()
  if (!config) {
    return (
      <NotConnected
        why="Sentry already records errors from n8builds.dev and the portfolio. Showing them here needs a read-only token; the dashboard never changes anything in Sentry."
        willShow={['Unresolved issues', 'New this week', 'Events per issue', 'Errors this month vs the free 5,000']}
        needs={['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECTS']}
        setupId="sentry"
        actions={<ExternalAction href="https://sentry.io/settings/account/api/auth-tokens/" describe="Create a Sentry auth token">
            Sentry tokens
          </ExternalAction>}
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
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <Stat label="Unresolved" value={formatNumber(summary.unresolved.length)} />
        <Stat label="New this week" value={formatNumber(summary.newThisWeek)} tone={summary.newThisWeek > 0 ? 'warn' : 'good'} />
        <Stat label="Errors, 30 days" value={summary.errors30d === null ? 'n/a' : formatNumber(summary.errors30d)} hint="free plan: 5,000 a month" />
      </div>
      <ul className="-my-2 divide-y divide-white/[0.06]">
        {summary.unresolved.slice(0, 8).map((issue) => (
          <li key={issue.id} className="py-4">
            <OutLink href={issue.url} className="text-[15px] font-medium text-slate-50 hover:text-cyan-200">
              {issue.title}
            </OutLink>
            <p className="mt-1 text-[14px] text-slate-400">
              <span className="font-mono">{issue.shortId}</span> · {formatNumber(issue.events)} events · {issue.users} users · last seen {timeAgo(issue.lastSeen)}
            </p>
          </li>
        ))}
      </ul>
      <Actions>
        <ExternalAction href={`https://${summary.org}.sentry.io/issues/`} variant="primary" describe="View the issues on Sentry">
          Sentry
        </ExternalAction>
      </Actions>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Website traffic (GA4)

export async function TrafficPanel() {
  if (!ga4Config()) {
    return (
      <NotConnected
        why="Google Analytics (G-JZQGKY9Q37) already counts visits for all of n8builds.dev, subdomains included. Reading them here needs a Google Cloud service account with Viewer access to that property."
        willShow={['Visitors, 28 days', 'Countries', 'Top pages', 'Referrers', 'Time on site', 'Scroll depth']}
        needs={['GA4_PROPERTY_ID', 'GOOGLE_SA_CLIENT_EMAIL', 'GOOGLE_SA_PRIVATE_KEY']}
        setupId="ga4"
        actions={
          <>
            <ExternalAction href="https://analytics.google.com/analytics/web/" describe="Open Google Analytics">
              Analytics
            </ExternalAction>
            <ExternalAction href="https://console.cloud.google.com/iam-admin/serviceaccounts" describe="Google Cloud service accounts">
              Service accounts
            </ExternalAction>
          </>
        }
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
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Visitors" value={formatNumber(traffic.visitors)} hint={`${formatNumber(traffic.pageViews)} page views`} />
        <Stat label="Average visit" value={formatDuration(traffic.avgSessionSeconds)} />
        <Stat label="Engaged visits" value={formatPercent(traffic.engagementRate)} hint="10s+, or 2+ pages" />
        <Stat label="Scrolled to the end" value={traffic.scrolledShare === null ? 'n/a' : formatPercent(traffic.scrolledShare)} hint="of page views (90%)" />
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        {(
          [
            ['Top pages', traffic.pages],
            ['Where visitors come from', traffic.referrers],
            ['Countries', traffic.countries],
          ] as const
        ).map(([title, rows]) => (
          <div key={title} className="min-w-0">
            <p className="mb-3 text-[15px] font-medium text-slate-200">{title}</p>
            <BarList rows={[...rows]} format={formatNumber} />
          </div>
        ))}
      </div>
      <Actions>
        <ExternalAction href="https://analytics.google.com/analytics/web/" variant="primary" describe="Open Google Analytics">
          Analytics
        </ExternalAction>
      </Actions>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Referrals to Appturnity

const REFERRAL_PLAN = [
  <>n8builds-web tags each Appturnity link with its placement (hero ad, &quot;Two ways&quot; card, footer, navbar) and adds <code className={code}>utm_source=n8builds</code>.</>,
  <>A small click listener, loaded after the page, sends <code className={code}>navigator.sendBeacon(&apos;/api/ref&apos;)</code>, so the click is never slowed down.</>,
  <>The route checks the placement against an allow-list and adds one to <code className={code}>ref:appturnity:&lt;date&gt;</code> in the analytics database. No IP, ID or cookie.</>,
  'The same click also sends a Google Analytics event (appturnity_click) as a cross-check, and the utm tags show up in Appturnity\'s own analytics.',
]

export async function ReferralsPanel() {
  if (!isStoreConnected()) {
    return (
      <NotConnected
        why="Counting our own clicks works even with ad blockers and without Google's cookies; Google Analytics alone would miss many of them."
        willShow={['Clicks today, 7 and 30 days', 'Which placement works best', '30-day trend']}
        needs={STORE_VARS}
        plan={REFERRAL_PLAN}
        setupId="upstash"
        actions={<ExternalAction href="https://appturnity.com" describe="Open appturnity.com">
            appturnity.com
          </ExternalAction>}
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
    return <NotConnected title="Waiting for the counter" why="The analytics database is connected, but n8builds-web doesn't count Appturnity clicks yet." plan={REFERRAL_PLAN} />
  }
  const byPlacement = new Map<string, number>()
  for (const day of days) for (const [field, value] of Object.entries(day.byField)) byPlacement.set(field, (byPlacement.get(field) ?? 0) + value)
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-3 gap-6">
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
// Contact messages

const CONTACT_PLAN = [
  <>After a message is delivered, n8builds-web&apos;s contact route adds one to <code className={code}>contact:sent:&lt;date&gt;</code> in the analytics database.</>,
  'A failed count never fails the send, and the counter lives apart from the form\'s rate-limit database so it can\'t use up its quota.',
]

export async function ContactPanel() {
  if (!isStoreConnected()) {
    return (
      <NotConnected
        why="Shows how many people wrote in, without opening Gmail. Only a daily number is stored, never the message."
        willShow={['Messages this week and month', 'Against the 50-a-day cap']}
        needs={STORE_VARS}
        plan={CONTACT_PLAN}
        setupId="upstash"
        actions={<ExternalAction href="https://mail.google.com" describe="Open Gmail">
            Gmail
          </ExternalAction>}
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
  if (total === 0) return <NotConnected title="Waiting for the counter" why="The analytics database is connected, but n8builds-web doesn't count sent messages yet (or none arrived in 30 days)." plan={CONTACT_PLAN} />
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6">
        <Stat label="7 days" value={formatNumber(days.slice(-7).reduce((sum, day) => sum + day.count, 0))} />
        <Stat label="30 days" value={formatNumber(total)} />
      </div>
      <Sparkline values={days.map((day) => day.count)} label="Contact messages per day, last 30 days" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trends (daily snapshot)

export async function TrendsPanel() {
  if (!isStoreConnected()) {
    return (
      <NotConnected
        why="GitHub only keeps today's numbers, so the dashboard saves one snapshot a day to show stars and minutes over time."
        willShow={['Stars over 30 days', 'Minutes used by day', 'Change this week']}
        needs={[...STORE_VARS, 'CRON_SECRET']}
        plan={[
          <>Vercel Cron calls <code className={code}>/api/cron/snapshot</code> daily at 06:15 UTC (already built, in vercel.json).</>,
          <>It saves stars per repo and this month&apos;s minutes as <code className={code}>snapshot:&lt;date&gt;</code>, kept 400 days.</>,
        ]}
        setupId="upstash"
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
  if (known.length === 0) return <NotConnected title="Waiting for the first snapshot" why="The database is connected; the first snapshot lands after the cron's next run (or open /api/cron/snapshot while signed in)." />
  const weekAgo = stars.at(-8) ?? known[0]
  const change = (known.at(-1) ?? 0) - (weekAgo ?? 0)
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6">
        <Stat label="Stars" value={formatNumber(known.at(-1) ?? 0)} hint={`${change >= 0 ? '+' : ''}${change} this week`} />
        <Stat label="Appturnity minutes" value={formatNumber(minutes.filter((value): value is number => value !== null).at(-1) ?? 0)} hint="this month so far" />
      </div>
      <Sparkline values={stars} label="Total stars, last 30 days" />
      <Sparkline values={minutes} label="Appturnity Actions minutes, last 30 days" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI crawlers (a link, by the owner's call)

export function AiCrawlersCard() {
  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-start gap-3 text-[15px] leading-relaxed text-slate-300">
        <LuBot aria-hidden className="mt-0.5 size-5 shrink-0 text-blue-300" />
        <span>
          Vercel&apos;s Firewall shows AI crawlers (GPTBot, ClaudeBot and others) once its <b className="font-semibold text-slate-100">AI Bots</b> ruleset is on in <b className="font-semibold text-slate-100">Log</b> mode, which records them without blocking. No counter of our own, so crawler visits cost nothing extra.
        </span>
      </p>
      <Actions>
        <ExternalAction href={`https://vercel.com/${VERCEL_TEAM}/n8builds-web/firewall`} variant="primary" describe="Open the Vercel Firewall for n8builds-web">
          Firewall
        </ExternalAction>
      </Actions>
    </div>
  )
}
