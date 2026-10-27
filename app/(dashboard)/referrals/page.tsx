import type { Metadata } from 'next'
import { ReferralsPanel } from '@/components/panels/connectors'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'Referrals to Appturnity' }

export default async function ReferralsPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="Referrals to Appturnity"
        description="How many visitors n8builds.dev sends to appturnity.com, counted on our side."
      />
      <Panel id="referrals" title="Clicks to appturnity.com" className="max-w-3xl">
        <Slot>
          <ReferralsPanel />
        </Slot>
      </Panel>
    </>
  )
}
