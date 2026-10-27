import type { Metadata } from 'next'
import { ActionsMinutes } from '@/components/panels/github'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'Actions minutes' }

export default async function MinutesPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="Actions minutes"
        description="Minutes used this month against the free 2,000 for the Appturnity org and the personal account. Public repos are free and not counted."
        source={{ label: 'Billing', href: 'https://github.com/organizations/Appturnity/settings/billing/usage' }}
      />
      <Panel id="minutes" title="This month" className="max-w-3xl">
        <Slot>
          <ActionsMinutes />
        </Slot>
      </Panel>
    </>
  )
}
