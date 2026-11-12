import { Suspense } from 'react'
import { OverviewSkeleton, OverviewTiles } from '@/components/Overview'
import { PanelBoundary } from '@/components/PanelBoundary'
import { PageHeader } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

export default async function OverviewPage() {
  await requireOwner()
  const now = new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
  return (
    <>
      <PageHeader area={AREAS.overview} lead={`${now} Pacific · refreshes every 5 minutes`} />
      <PanelBoundary>
        <Suspense fallback={<OverviewSkeleton />}>
          <OverviewTiles />
        </Suspense>
      </PanelBoundary>
    </>
  )
}
