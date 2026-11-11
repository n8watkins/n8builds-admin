import { Suspense } from 'react'
import { AppStatsCards } from '@/components/AppStatsCards'
import { OverviewCards, OverviewSkeleton, OverviewStrip, StripSkeleton } from '@/components/Overview'
import { PanelBoundary } from '@/components/PanelBoundary'
import { PageHeader } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

export default async function OverviewPage() {
  await requireOwner()
  const now = new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
  return (
    <>
      <PageHeader area={AREAS.overview} lead={`${now} (Pacific). What needs attention comes first; numbers refresh every 5 minutes.`} />
      <PanelBoundary>
        <Suspense fallback={<StripSkeleton />}>
          <OverviewStrip />
        </Suspense>
      </PanelBoundary>
      <PanelBoundary>
        <Suspense fallback={<OverviewSkeleton />}>
          <OverviewCards />
        </Suspense>
      </PanelBoundary>
      <PanelBoundary>
        <Suspense fallback={<div aria-busy="true" aria-label="Loading" className="mt-12 h-[320px] animate-pulse rounded-2xl bg-white/[0.03]" />}>
          <AppStatsCards />
        </Suspense>
      </PanelBoundary>
    </>
  )
}
