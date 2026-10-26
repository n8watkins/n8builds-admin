import { Suspense, type ReactNode } from 'react'
import { PanelBoundary } from '@/components/PanelBoundary'
import { AiCrawlersCard, ContactPanel, ReferralsPanel, SentryPanel, TrafficPanel, TrendsPanel } from '@/components/panels/connectors'
import { DemoStatus, LatestDeploys, LatestReleases, MonthActivity, SecurityAlerts } from '@/components/panels/extras'
import { ActionsMinutes, CiStatus, RepoStats } from '@/components/panels/github'
import { CiTile, DemosTile, MinutesTile, StarsTile, TileSkeleton, ViewsTile } from '@/components/panels/kpis'
import { Panel, PanelSkeleton, SectionHeading } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'
import { VERCEL_TEAM } from '@/lib/links'

/** One panel body: its own Suspense boundary (streams in when its data arrives) and its own error boundary. */
function Slot({ children, rows }: { children: ReactNode; rows?: number }) {
  return (
    <PanelBoundary>
      <Suspense fallback={<PanelSkeleton rows={rows} />}>{children}</Suspense>
    </PanelBoundary>
  )
}

function TileSlot({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <PanelBoundary>
        <Suspense fallback={<TileSkeleton label={label} />}>{children}</Suspense>
      </PanelBoundary>
    </div>
  )
}

export default async function DashboardPage() {
  // The layout checks too; this keeps the page safe if it is ever moved out of the group.
  await requireOwner()
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' })
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="col-span-full mb-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Dashboard</h1>
        <p className="text-xs text-slate-475">Data cached up to 5 minutes · {now} PT</p>
      </div>

      <div className="col-span-full grid grid-cols-2 divide-white/[0.06] rounded-2xl border bg-panel/80 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x [&>*:nth-child(5)]:col-span-2 sm:[&>*:nth-child(5)]:col-span-1">
        <TileSlot label="CI">
          <CiTile />
        </TileSlot>
        <TileSlot label="Stars">
          <StarsTile />
        </TileSlot>
        <TileSlot label="Views 14d">
          <ViewsTile />
        </TileSlot>
        <TileSlot label="Org minutes">
          <MinutesTile />
        </TileSlot>
        <TileSlot label="Live demos">
          <DemosTile />
        </TileSlot>
      </div>

      <SectionHeading title="GitHub" note="n8watkins public repos and the Appturnity org" />
      <Panel id="ci" index="01" title="CI status" source={{ label: 'Actions', href: 'https://github.com/n8watkins' }} className="lg:col-span-7">
        <Slot rows={9}>
          <CiStatus />
        </Slot>
      </Panel>
      <Panel id="minutes" index="01" title="Actions minutes this month" source={{ label: 'Billing', href: 'https://github.com/organizations/Appturnity/settings/billing/usage' }} className="lg:col-span-5">
        <Slot>
          <ActionsMinutes />
        </Slot>
      </Panel>
      <Panel id="repos" index="01" title="Stars and traffic" source={{ label: 'Repos', href: 'https://github.com/n8watkins?tab=repositories' }} className="lg:col-span-12">
        <Slot rows={9}>
          <RepoStats />
        </Slot>
      </Panel>

      <SectionHeading title="Errors and traffic" />
      <Panel id="sentry" index="02" title="Errors (Sentry)" source={{ label: 'Sentry', href: 'https://sentry.io' }} className="lg:col-span-5">
        <Slot>
          <SentryPanel />
        </Slot>
      </Panel>
      <Panel id="traffic" index="03" title="Traffic (Google Analytics)" source={{ label: 'GA4', href: 'https://analytics.google.com/analytics/web/' }} className="lg:col-span-7">
        <Slot>
          <TrafficPanel />
        </Slot>
      </Panel>

      <SectionHeading title="Our own counters" note="Daily totals only, in a separate Upstash database" />
      <Panel id="referrals" index="04" title="Referrals to Appturnity" className="lg:col-span-4">
        <Slot>
          <ReferralsPanel />
        </Slot>
      </Panel>
      <Panel id="contact" index="05" title="Contact messages" className="lg:col-span-4">
        <Slot>
          <ContactPanel />
        </Slot>
      </Panel>
      <Panel id="trends" index="06" title="Stars and minutes trend" className="lg:col-span-4">
        <Slot>
          <TrendsPanel />
        </Slot>
      </Panel>

      <SectionHeading title="Extras" note="Cheap additions beyond the plan, from data the dashboard already reads" />
      <Panel id="demos" title="Live demos (OpenPing)" extra source={{ label: 'Status', href: 'https://openping.n8builds.dev/status' }} className="lg:col-span-4">
        <Slot rows={3}>
          <DemoStatus />
        </Slot>
      </Panel>
      <Panel id="deploys" title="Latest deploys" extra source={{ label: 'Vercel', href: `https://vercel.com/${VERCEL_TEAM}` }} className="lg:col-span-4">
        <Slot rows={6}>
          <LatestDeploys />
        </Slot>
      </Panel>
      <Panel id="activity" title="Activity this month" extra source={{ label: 'Build log', href: 'https://n8builds.dev/builds' }} className="lg:col-span-4">
        <Slot>
          <MonthActivity />
        </Slot>
      </Panel>
      <Panel id="releases" title="Latest releases" extra className="lg:col-span-4">
        <Slot rows={6}>
          <LatestReleases />
        </Slot>
      </Panel>
      <Panel id="security" title="Security alerts" extra source={{ label: 'Dependabot', href: 'https://github.com/n8watkins' }} className="lg:col-span-4">
        <Slot rows={3}>
          <SecurityAlerts />
        </Slot>
      </Panel>
      <Panel id="crawlers" index="07" title="AI crawlers" source={{ label: 'Firewall', href: `https://vercel.com/${VERCEL_TEAM}/n8builds-web/firewall` }} className="lg:col-span-4">
        <AiCrawlersCard />
      </Panel>
    </div>
  )
}
