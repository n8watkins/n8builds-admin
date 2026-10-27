import type { Metadata } from 'next'
import { DemoStatus } from '@/components/panels/extras'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'Live demos' }

export default async function DemosPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="Live demos"
        description="The developer portfolio's Render demos, watched by OpenPing. Grey days are scheduled off-hours."
        source={{ label: 'Status page', href: 'https://openping.n8builds.dev/status' }}
      />
      <Panel id="demos" title="Last 30 days" className="max-w-3xl">
        <Slot rows={3}>
          <DemoStatus />
        </Slot>
      </Panel>
    </>
  )
}
