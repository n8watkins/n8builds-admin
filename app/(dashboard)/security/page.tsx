import type { Metadata } from 'next'
import { SecurityAlerts } from '@/components/panels/extras'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'Security alerts' }

export default async function SecurityPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="Security alerts"
        description="Open Dependabot alerts across the tracked repos."
      />
      <Panel id="security" title="Dependabot" className="max-w-3xl">
        <Slot rows={3}>
          <SecurityAlerts />
        </Slot>
      </Panel>
    </>
  )
}
