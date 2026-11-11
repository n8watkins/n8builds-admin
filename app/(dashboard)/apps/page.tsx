import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppStatsCards } from '@/components/AppStatsCards'
import { PanelBoundary } from '@/components/PanelBoundary'
import { PageHeader } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.apps

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader area={area} />
      {/* The cards' own section sits right under the header here. */}
      <div className="[&>section]:mt-0">
        <PanelBoundary>
          <Suspense fallback={<div aria-busy="true" aria-label="Loading" className="h-[320px] animate-pulse rounded-2xl bg-white/[0.03]" />}>
            <AppStatsCards />
          </Suspense>
        </PanelBoundary>
      </div>
    </>
  )
}
