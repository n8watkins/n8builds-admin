import { Suspense } from 'react'
import { OverviewCards, OverviewSkeleton } from '@/components/Overview'
import { PanelBoundary } from '@/components/PanelBoundary'
import { PageHeader } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export default async function OverviewPage() {
  await requireOwner()
  const now = new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
  return (
    <>
      <PageHeader title="Overview" description={`${now} PT. Data is cached for up to 5 minutes.`} />
      <PanelBoundary>
        <Suspense fallback={<OverviewSkeleton />}>
          <OverviewCards />
        </Suspense>
      </PanelBoundary>
    </>
  )
}
