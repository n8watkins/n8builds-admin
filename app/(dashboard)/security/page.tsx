import type { Metadata } from 'next'
import { SecurityAlerts } from '@/components/panels/extras'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.security

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        area={area}
      />
      <Panel id="security" title="Dependabot, by repo" description="Open alerts per repo, most first, with how many are critical or high. Each button opens them on GitHub.">
        <Slot rows={6}>
          <SecurityAlerts />
        </Slot>
      </Panel>
    </>
  )
}
